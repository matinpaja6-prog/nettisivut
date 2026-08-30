import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { activeSalePrice, discountCodeAmount, hasFreeShipping, normalizedDiscountCode } from "@/lib/commerce/discounts";
import { MASKINES_FEE_RATE } from "@/lib/commerce/fees";
import type { CheckoutRequest, Company, CompanyDiscountCode, PickupPoint, Product, ShippingMethod } from "@/lib/commerce/types";
import { calculateCartShippingPrice, canPublishProduct, formatPickupAddress, productShippingPriceForCountry, productSupportsPickup, productSupportsPosti } from "@/lib/commerce/validation";
import { SHIPPING_VAT_RATE, vatFromGrossCents } from "@/lib/commerce/vat";
import { integer, isEmail, normalizeText } from "@/lib/commerce/server";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin, requireUserFromRequest } from "@/lib/supabase-admin";
import { normalizeEmailLocale } from "@/lib/email-template";

function companyShippingPrice(company: Company, country: string) {
  if (country === "NO") return company.default_shipping_price_no_cents;
  return country === "SE" ? company.default_shipping_price_se_cents : company.default_shipping_price_fi_cents;
}

function maskinesPaymentMethodTypes(account: Stripe.Account) {
  const methods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ["card"];
  if (account.capabilities?.klarna_payments === "active") methods.push("klarna");
  if (account.capabilities?.mobilepay_payments === "active") methods.push("mobilepay");
  if (account.capabilities?.revolut_pay_payments === "active") methods.push("revolut_pay");
  if (account.capabilities?.pay_by_bank_payments === "active") methods.push("pay_by_bank");
  return methods;
}

function shippingForCompany(lines: Array<{ product: Product; quantity: number }>, company: Company, country: string) {
  if (country === "FI" || country === "SE") return calculateCartShippingPrice(lines, company.shipping_price_strategy, country);
  const price = companyShippingPrice(company, country);
  if (price == null) throw new Error(`Toimitushinta maahan ${country} puuttuu.`);
  const prices = lines.map(({ product, quantity }) => price * Math.ceil(quantity / Math.max(1, product.max_shipping_quantity || 1)));
  return company.shipping_price_strategy === "sum" ? prices.reduce((sum, value) => sum + value, 0) : Math.max(...prices);
}

type ProductWithCompany = Product & { company: Company };
type SellerSelection = { shippingMethod: ShippingMethod; pickupPoint: PickupPoint | null; discountCode: string };

function missingSchemaColumn(error: { code?: string; message?: string } | null) {
  if (error?.code !== "PGRST204") return null;
  const match = error.message?.match(/(?:Could not find the |the )['"]([^'"]+)['"] column/i);
  return match?.[1] ?? null;
}

function selectionMap(body: CheckoutRequest, companyIds: string[]) {
  const map = new Map<string, SellerSelection>();
  const validMethods = new Set<ShippingMethod>(["pickup", "posti"]);
  for (const selection of body.sellerSelections ?? []) {
    if (!companyIds.includes(selection.companyId) || !validMethods.has(selection.shippingMethod)) continue;
    map.set(selection.companyId, {
      shippingMethod: selection.shippingMethod,
      pickupPoint: selection.pickupPoint ?? null,
      discountCode: normalizedDiscountCode(selection.discountCode)
    });
  }
  if (companyIds.length === 1 && map.size === 0 && body.shippingMethod && validMethods.has(body.shippingMethod)) {
    map.set(companyIds[0], { shippingMethod: body.shippingMethod, pickupPoint: body.pickupPoint ?? null, discountCode: "" });
  }
  return map;
}

export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  let checkoutGroupId: string | null = null;
  try {
    const body = await request.json().catch(() => ({})) as CheckoutRequest;
    const locale = normalizeEmailLocale(body.locale);
    const customerName = normalizeText(body.customerName, 160);
    let customerEmail = normalizeText(body.customerEmail, 180).toLowerCase();
    const customerPhone = normalizeText(body.customerPhone, 40) || null;
    const customerAddress = normalizeText(body.customerAddress, 180);
    const customerPostalCode = normalizeText(body.customerPostalCode, 20);
    const customerCity = normalizeText(body.customerCity, 100);
    const customerCountry = normalizeText(body.customerCountry, 2).toUpperCase() || "FI";
    const requestedBuyerType = body.buyerType === "company" ? "company" : "private";
    let buyerType: "private" | "company" = requestedBuyerType;
    let customerCompany = "";
    let customerBusinessId = "";
    let customerVatId = "";
    let customerCompanyAddress = "";
    let customerCompanyEmail = "";
    let customerCompanyPhone = "";
    let customerCompanyContactPerson = "";
    let customerCompanyWebsite = "";
    let authenticatedUser: Awaited<ReturnType<typeof requireUserFromRequest>> | null = null;
    try {
      authenticatedUser = await requireUserFromRequest(request);
    } catch {
      authenticatedUser = null;
    }
    if (!authenticatedUser && requestedBuyerType === "company") {
      return NextResponse.json({ error: "Yrityksenä ostaminen vaatii kirjautumisen yritystilille." }, { status: 401 });
    }
    if (authenticatedUser) {
      const { data: buyerProfile, error: buyerProfileError } = await admin
        .from("profiles")
        .select("account_type,company_name,business_id,company_website,email,phone,address,postal_code,city,country,first_name,last_name")
        .eq("id", authenticatedUser.user.id)
        .maybeSingle<{
          account_type: string | null; company_name: string | null; business_id: string | null;
          company_website: string | null; email: string | null; phone: string | null;
          address: string | null; postal_code: string | null; city: string | null; country: string | null;
          first_name: string | null; last_name: string | null;
        }>();
      if (buyerProfileError) throw buyerProfileError;
      buyerType = buyerProfile?.account_type === "company" ? "company" : "private";
      if (buyerType === "private") {
        const accountEmail = normalizeText(buyerProfile?.email || authenticatedUser.user.email, 180).toLowerCase();
        if (isEmail(accountEmail)) customerEmail = accountEmail;
      }
      if (requestedBuyerType === "company" && buyerType !== "company") {
        return NextResponse.json({ error: "Yritysoston voi tehdä vain yritystilillä." }, { status: 403 });
      }
      if (buyerType === "company") {
        const { data: buyerCompany, error: buyerCompanyError } = await admin
          .from("companies")
          .select("name,business_id,vat_id,address_line,postal_code,city,country,email,phone,contact_person,website")
          .eq("owner_user_id", authenticatedUser.user.id)
          .maybeSingle<{
            name: string; business_id: string; vat_id: string | null; address_line: string;
            postal_code: string; city: string; country: string; email: string; phone: string;
            contact_person: string; website: string | null;
          }>();
        if (buyerCompanyError) throw buyerCompanyError;
        customerCompany = normalizeText(buyerCompany?.name || buyerProfile?.company_name, 160);
        customerBusinessId = normalizeText(buyerCompany?.business_id || buyerProfile?.business_id, 80);
        customerVatId = normalizeText(buyerCompany?.vat_id, 80);
        customerCompanyAddress = [
          normalizeText(buyerCompany?.address_line || buyerProfile?.address, 180),
          [normalizeText(buyerCompany?.postal_code || buyerProfile?.postal_code, 20), normalizeText(buyerCompany?.city || buyerProfile?.city, 100)].filter(Boolean).join(" "),
          normalizeText(buyerCompany?.country || buyerProfile?.country, 2).toUpperCase(),
        ].filter(Boolean).join(", ");
        customerCompanyEmail = normalizeText(buyerCompany?.email || buyerProfile?.email || customerEmail, 180).toLowerCase();
        customerCompanyPhone = normalizeText(buyerCompany?.phone || buyerProfile?.phone || customerPhone, 40);
        customerCompanyContactPerson = normalizeText(
          buyerCompany?.contact_person || [buyerProfile?.first_name, buyerProfile?.last_name].filter(Boolean).join(" ") || customerName,
          160,
        );
        customerCompanyWebsite = normalizeText(buyerCompany?.website || buyerProfile?.company_website, 300);
        if (!customerCompany || !customerBusinessId) {
          return NextResponse.json({ error: "Täydennä yritystilille yrityksen nimi ja Y-tunnus ennen tilaamista." }, { status: 400 });
        }
      }
    } else if (buyerType === "company") {
        return NextResponse.json({ error: "Yrityksenä ostaminen vaatii kirjautumisen yritystilille." }, { status: 401 });
    }
    if (!customerName || !isEmail(customerEmail)) return NextResponse.json({ error: "Anna ostajan nimi ja kelvollinen sähköpostiosoite." }, { status: 400 });
    if (customerEmail.endsWith("@maskines.com")) {
      return NextResponse.json({ error: "Käytä omaa sähköpostiosoitettasi. @maskines.com-osoite ei ole asiakasosoite." }, { status: 400 });
    }
    const postalValid = customerCountry === "NO" ? /^\d{4}$/.test(customerPostalCode) : /^\d{5}$/.test(customerPostalCode);
    if (!customerAddress || !postalValid || !customerCity || !["FI", "SE", "NO"].includes(customerCountry)) {
      return NextResponse.json({ error: "Täytä kelvollinen toimitusosoite tuettuun toimitusmaahan." }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) return NextResponse.json({ error: "Ostoskori on tyhjä tai liian suuri." }, { status: 400 });

    const quantities = new Map<string, number>();
    for (const item of body.items) {
      const id = normalizeText(item.productId, 80);
      if (id) quantities.set(id, (quantities.get(id) ?? 0) + integer(item.quantity, 1, 1000));
    }
    const ids = [...quantities.keys()];
    const { data, error } = await admin.from("products").select("*,company:companies(*)").in("id", ids).returns<ProductWithCompany[]>();
    if (error) throw error;
    if (!data || data.length !== ids.length) return NextResponse.json({ error: "Yhtä tai useampaa tuotetta ei löytynyt." }, { status: 400 });
    const products = new Map(data.map((product) => [product.id, product]));
    const lines = ids.map((id) => ({ product: products.get(id)!, quantity: quantities.get(id)! }));
    for (const { product, quantity } of lines) {
      if (!canPublishProduct(product.company)) return NextResponse.json({ error: `${product.company.name} ei voi vastaanottaa maksuja tällä hetkellä.` }, { status: 409 });
      if (!product.active) return NextResponse.json({ error: `${product.name} ei ole enää myynnissä.` }, { status: 409 });
      if (product.stock_quantity < quantity) return NextResponse.json({ error: `Tuotteen ${product.name} varastosaldo ei riitä.` }, { status: 409 });
    }

    const companyIds = [...new Set(lines.map(({ product }) => product.company_id))];
    if (companyIds.length !== 1) {
      return NextResponse.json({
        error: "Eri yritysten tuotteet maksetaan erikseen. Tämä varmistaa, että maksu, Stripe-kulut ja mahdolliset palautukset kuuluvat aina oikealle myyjäyritykselle.",
      }, { status: 409 });
    }
    const stripe = getStripe();
    let sellerStripeAccount: Stripe.Account | null = null;
    for (const companyId of companyIds) {
      const company = lines.find(({ product }) => product.company_id === companyId)!.product.company;
      try {
        if (!company.stripe_account_id) throw new Error("Stripe-tili puuttuu.");
        const account = await stripe.accounts.retrieve(company.stripe_account_id);
        if (account.deleted || !account.details_submitted || !account.charges_enabled || !account.payouts_enabled) {
          throw new Error("Stripe-tili ei ole valmis vastaanottamaan tilityksiä.");
        }
        if (
          account.metadata?.maskines_charge_model !== "direct_charge_v1"
          || account.metadata?.maskines_fees_collector !== "stripe"
          || account.metadata?.maskines_losses_collector !== "stripe"
        ) {
          throw new Error("Stripe-yhteys pitää päivittää yrityksen omalla vastuulla toimivaan maksumalliin.");
        }
        sellerStripeAccount = account;
      } catch (stripeAccountError) {
        console.error(`Company ${company.id} Stripe account validation failed`, stripeAccountError);
        return NextResponse.json({
          error: `${company.name} ei voi vastaanottaa maksua juuri nyt. Myyjän pitää yhdistää Stripe-maksut uudelleen.`,
        }, { status: 409 });
      }
    }
    const selections = selectionMap(body, companyIds);
    if (selections.size !== companyIds.length) return NextResponse.json({ error: "Valitse toimitustapa jokaiselle yritykselle." }, { status: 400 });

    const sellerGroups = [] as Array<{
      company: Company; lines: typeof lines; selection: SellerSelection; productTotal: number;
      productDiscount: number; couponDiscount: number; shipping: number; vat: number; total: number;
      discount: CompanyDiscountCode | null;
    }>;
    for (const companyId of companyIds) {
      const sellerLines = lines.filter(({ product }) => product.company_id === companyId);
      const company = sellerLines[0].product.company;
      const selection = selections.get(companyId)!;
      const allPickup = sellerLines.every(({ product }) => productSupportsPickup(product));
      const allPosti = sellerLines.every(({ product }) => productSupportsPosti(product));
      if (selection.shippingMethod === "pickup" && !allPickup) return NextResponse.json({ error: `Nouto ei ole saatavilla yrityksen ${company.name} kaikille tuotteille.` }, { status: 409 });
      if (selection.shippingMethod === "posti" && !company.posti_enabled) return NextResponse.json({ error: `Posti ei ole käytössä yrityksellä ${company.name}.` }, { status: 409 });
      if (selection.shippingMethod === "posti" && !allPosti) return NextResponse.json({ error: `Postitus ei ole saatavilla yrityksen ${company.name} kaikille tuotteille.` }, { status: 409 });
      if (selection.shippingMethod !== "pickup" && (!selection.pickupPoint?.id || !selection.pickupPoint.name || !selection.pickupPoint.address)) return NextResponse.json({ error: `Valitse yrityksen ${company.name} toimitukselle noutopiste.` }, { status: 400 });

      const originalTotal = sellerLines.reduce((sum, { product, quantity }) => sum + product.price_cents * quantity, 0);
      const productTotal = sellerLines.reduce((sum, { product, quantity }) => sum + activeSalePrice(product) * quantity, 0);
      let discount: CompanyDiscountCode | null = null;
      let couponDiscount = 0;
      if (selection.discountCode) {
        const { data: code } = await admin.from("company_discount_codes").select("*").eq("company_id", companyId).eq("code", selection.discountCode).maybeSingle<CompanyDiscountCode>();
        if (!code) return NextResponse.json({ error: `Alennuskoodi ei kelpaa yritykselle ${company.name}.` }, { status: 400 });
        couponDiscount = discountCodeAmount(code, productTotal);
        if (couponDiscount <= 0) return NextResponse.json({ error: `Alennuskoodi ${code.code} ei ole voimassa tai tilauksen ehdot eivät täyty.` }, { status: 400 });
        discount = code;
      }
      const afterDiscount = productTotal - couponDiscount;
      if (selection.shippingMethod !== "pickup" && !(company.shipping_countries?.length ? company.shipping_countries : ["FI"]).includes(customerCountry)) {
        return NextResponse.json({ error: `${company.name} ei toimita valittuun maahan.` }, { status: 400 });
      }
      const baseShipping = selection.shippingMethod !== "pickup" ? shippingForCompany(sellerLines, company, customerCountry) : 0;
      const shipping = hasFreeShipping(company.free_shipping_threshold_cents, afterDiscount) ? 0 : baseShipping;
      const productVatBeforeCoupon = sellerLines.reduce((sum, { product, quantity }) => sum + vatFromGrossCents(activeSalePrice(product) * quantity, product.vat_rate), 0);
      const productVat = productTotal > 0 ? Math.round(productVatBeforeCoupon * afterDiscount / productTotal) : 0;
      const shippingVat = vatFromGrossCents(shipping, SHIPPING_VAT_RATE);
      sellerGroups.push({ company, lines: sellerLines, selection, productTotal, productDiscount: originalTotal - productTotal, couponDiscount, shipping, vat: productVat + shippingVat, total: afterDiscount + shipping, discount });
    }

    const productTotal = sellerGroups.reduce((sum, group) => sum + group.productTotal, 0);
    const discountTotal = sellerGroups.reduce((sum, group) => sum + group.productDiscount + group.couponDiscount, 0);
    const shippingTotal = sellerGroups.reduce((sum, group) => sum + group.shipping, 0);
    const total = sellerGroups.reduce((sum, group) => sum + group.total, 0);
    const vat = sellerGroups.reduce((sum, group) => sum + group.vat, 0);
    if (total < 50) return NextResponse.json({ error: "Maksettavan summan pitää olla vähintään 0,50 €." }, { status: 400 });

    const checkoutGroupPayload = {
      customer_email: customerEmail, customer_name: customerName, customer_phone: customerPhone,
      customer_address: customerAddress, customer_postal_code: customerPostalCode, customer_city: customerCity,
      customer_country: customerCountry, product_total_cents: productTotal, discount_total_cents: discountTotal,
      customer_locale: locale,
      shipping_total_cents: shippingTotal, vat_cents: vat, total_cents: total,
      buyer_type: buyerType,
      buyer_company_name: buyerType === "company" ? customerCompany : null,
      buyer_business_id: buyerType === "company" ? customerBusinessId : null,
      buyer_vat_id: buyerType === "company" ? customerVatId || null : null,
      buyer_company_address: buyerType === "company" ? customerCompanyAddress || null : null,
      buyer_company_email: buyerType === "company" ? customerCompanyEmail || customerEmail : null,
      buyer_company_phone: buyerType === "company" ? customerCompanyPhone || null : null,
      buyer_company_contact_person: buyerType === "company" ? customerCompanyContactPerson || customerName : null,
      buyer_company_website: buyerType === "company" ? customerCompanyWebsite || null : null,
    };
    let checkoutGroupResult = await admin.from("checkout_groups").insert(checkoutGroupPayload)
      .select("id,checkout_number").single<{ id: string; checkout_number: string }>();
    if (checkoutGroupResult.error?.code === "PGRST204") {
      const legacyCheckoutGroupPayload = { ...checkoutGroupPayload } as Record<string, unknown>;
      delete legacyCheckoutGroupPayload.customer_locale;
      checkoutGroupResult = await admin.from("checkout_groups").insert(legacyCheckoutGroupPayload)
        .select("id,checkout_number").single<{ id: string; checkout_number: string }>();
    }
    const { data: checkoutGroup, error: groupError } = checkoutGroupResult;
    if (groupError) throw groupError;
    checkoutGroupId = checkoutGroup.id;

    let createdOrderId = "";
    for (const group of sellerGroups) {
      const maskinesFee = Math.round(group.total * MASKINES_FEE_RATE);
      const { data: returnPolicy, error: returnPolicyError } = await admin
        .from("company_return_policies")
        .select("*")
        .eq("company_id", group.company.id)
        .maybeSingle<Record<string, unknown>>();
      if (returnPolicyError && !new Set(["42P01", "PGRST205"]).has(returnPolicyError.code ?? "")) throw returnPolicyError;
      const orderPayload = {
        checkout_group_id: checkoutGroup.id, company_id: group.company.id,
        customer_user_id: authenticatedUser?.user.id ?? null,
        customer_email: customerEmail, customer_name: customerName, customer_phone: customerPhone,
        customer_address: customerAddress, customer_postal_code: customerPostalCode,
        customer_city: customerCity, customer_country: customerCountry,
        customer_locale: locale,
        return_policy_snapshot: returnPolicy ?? null,
        buyer_type: buyerType,
        buyer_company_name: buyerType === "company" ? customerCompany : null,
        buyer_business_id: buyerType === "company" ? customerBusinessId : null,
        buyer_vat_id: buyerType === "company" ? customerVatId || null : null,
        buyer_company_address: buyerType === "company" ? customerCompanyAddress || null : null,
        buyer_company_email: buyerType === "company" ? customerCompanyEmail || customerEmail : null,
        buyer_company_phone: buyerType === "company" ? customerCompanyPhone || null : null,
        buyer_company_contact_person: buyerType === "company" ? customerCompanyContactPerson || customerName : null,
        buyer_company_website: buyerType === "company" ? customerCompanyWebsite || null : null,
        product_total_cents: group.productTotal, discount_code: group.discount?.code ?? null,
        discount_cents: group.productDiscount + group.couponDiscount,
        subtotal_cents: group.total - group.vat, vat_cents: group.vat, total_cents: group.total,
        maskines_fee_cents: maskinesFee, seller_transfer_cents: Math.max(0, group.total - maskinesFee),
        stripe_transfer_status: "direct_charge",
        shipping_method: group.selection.shippingMethod, shipping_price_cents: group.shipping,
        pickup_point_id: group.selection.shippingMethod !== "pickup" ? normalizeText(group.selection.pickupPoint?.id, 120) : null,
        pickup_point_name: group.selection.shippingMethod !== "pickup" ? normalizeText(group.selection.pickupPoint?.name, 180) : null,
        pickup_point_address: group.selection.shippingMethod !== "pickup" ? normalizeText(group.selection.pickupPoint?.address, 500) : null,
        seller_name_snapshot: group.company.name, seller_business_id_snapshot: group.company.business_id,
        seller_vat_id_snapshot: group.company.vat_id, seller_address_snapshot: formatPickupAddress(group.company)
      };
      const compatibleOrderPayload = { ...orderPayload } as Record<string, unknown>;
      let orderResult = await admin.from("orders").insert(compatibleOrderPayload).select("id").single<{ id: string }>();
      for (let retry = 0; orderResult.error?.code === "PGRST204" && retry < 8; retry += 1) {
        const missingColumn = missingSchemaColumn(orderResult.error);
        if (!missingColumn || !(missingColumn in compatibleOrderPayload)) break;
        delete compatibleOrderPayload[missingColumn];
        orderResult = await admin.from("orders").insert(compatibleOrderPayload).select("id").single<{ id: string }>();
      }
      const { data: order, error: orderError } = orderResult;
      if (orderError) throw orderError;
      createdOrderId = order.id;
      let allocatedCoupon = 0;
      const rows = group.lines.map(({ product, quantity }, index) => {
        const unit = activeSalePrice(product);
        const lineBeforeCoupon = unit * quantity;
        const couponShare = index === group.lines.length - 1 ? group.couponDiscount - allocatedCoupon : Math.round(group.couponDiscount * lineBeforeCoupon / group.productTotal);
        allocatedCoupon += couponShare;
        const lineTotal = lineBeforeCoupon - couponShare;
        return {
          order_id: order.id, product_id: product.id, product_name: product.name,
          product_description_snapshot: product.description, image_url_snapshot: product.image_urls?.[0] ?? null,
          quantity, original_unit_price_cents: product.price_cents, unit_price_cents: unit,
          product_discount_cents: (product.price_cents - unit) * quantity, coupon_discount_cents: couponShare,
          vat_rate: product.vat_rate, vat_cents: vatFromGrossCents(lineTotal, product.vat_rate), line_total_cents: lineTotal,
          pickup_available_snapshot: product.pickup_available,
          pickup_address_snapshot: product.pickup_available ? (product.pickup_address_override || formatPickupAddress(group.company)) : null,
          pickup_instructions_snapshot: product.pickup_instructions,
          shipping_available_snapshot: product.shipping_available && product.posti_enabled,
          shipping_price_cents_snapshot: customerCountry === "FI" || customerCountry === "SE" ? productShippingPriceForCountry(product, customerCountry) : companyShippingPrice(group.company, customerCountry), weight_grams_snapshot: product.weight_grams,
          package_size_snapshot: product.shipping_available ? { length_cm: product.package_length_cm, width_cm: product.package_width_cm, height_cm: product.package_height_cm } : null,
          shipping_notes_snapshot: product.shipping_notes?.replace(/\[\[maskines:no_shipping_cents=\d+\]\]/g, "").trim() || null
        };
      });
      const { error: itemError } = await admin.from("order_items").insert(rows);
      if (itemError) throw itemError;
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    for (const group of sellerGroups) {
      lineItems.push({ quantity: 1, price_data: { currency: "eur", unit_amount: group.productTotal - group.couponDiscount, product_data: { name: `${group.company.name} – tuotteet`, description: group.discount ? `Alennuskoodi ${group.discount.code} huomioitu` : `${group.lines.length} tuoteriviä` } } });
      if (group.shipping > 0) lineItems.push({ quantity: 1, price_data: { currency: "eur", unit_amount: group.shipping, product_data: { name: `${group.company.name} – toimitus`, description: group.selection.pickupPoint?.name } } });
    }
    if (!createdOrderId) throw new Error("Tilausta ei voitu muodostaa.");
    if (!sellerStripeAccount) throw new Error("Myyjän Stripe-tilin maksutapoja ei voitu tarkistaa.");
    const seller = sellerGroups[0];
    const metadata = {
      order_id: createdOrderId,
      checkout_number: checkoutGroup.checkout_number,
      charge_model: "direct_charge_v1",
      buyer_type: buyerType,
      locale,
      ...(buyerType === "company" ? { buyer_company: customerCompany, buyer_business_id: customerBusinessId } : {})
    };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment", ui_mode: "embedded_page", customer_email: customerEmail, line_items: lineItems,
        payment_method_types: maskinesPaymentMethodTypes(sellerStripeAccount),
        payment_intent_data: {
          receipt_email: customerEmail,
          application_fee_amount: Math.round(total * MASKINES_FEE_RATE),
          metadata,
        },
        metadata,
        return_url: absoluteSiteUrl("/tilaus/onnistui?session_id={CHECKOUT_SESSION_ID}"),
        locale: locale === "no" ? "nb" : locale,
      },
      { stripeAccount: seller.company.stripe_account_id! },
    );
    const { error: sessionError } = await admin.from("checkout_groups").update({ stripe_checkout_session_id: session.id }).eq("id", checkoutGroup.id);
    if (sessionError) throw sessionError;
    await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("checkout_group_id", checkoutGroup.id);
    if (!session.client_secret) throw new Error("Upotetun maksusivun avaaminen epäonnistui.");
    return NextResponse.json({ clientSecret: session.client_secret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, checkoutGroupId: checkoutGroup.id });
  } catch (error) {
    const errorReference = crypto.randomUUID();
    console.error(`Commerce checkout failed [${errorReference}]`, error);
    if (checkoutGroupId) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
      await admin.from("checkout_groups").update({ payment_status: "cancelled", payment_error: message }).eq("id", checkoutGroupId);
      await admin.from("orders").update({ payment_status: "cancelled", payment_error: message }).eq("checkout_group_id", checkoutGroupId);
    }
    return NextResponse.json({
      error: "Maksuun siirtyminen epäonnistui. Yritä uudelleen. Jos ongelma jatkuu, ilmoita virhetunnus asiakaspalvelulle.",
      errorReference,
    }, { status: 500 });
  }
}
