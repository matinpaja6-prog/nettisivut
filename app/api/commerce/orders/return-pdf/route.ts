import { NextResponse } from "next/server";
import type { Company, Order, OrderItem } from "@/lib/commerce/types";
import { createReturnInstructionsPdf, defaultReturnPolicy, normalizeReturnPolicy, returnLanguageForCountry, returnPdfFilename, type ReturnPolicy } from "@/lib/commerce/returns";
import { errorResponse, getOwnedCompany, requireCommerceUser } from "@/lib/commerce/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const { admin, user } = await requireCommerceUser(request); const ownedCompany = await getOwnedCompany(user);
    const url = new URL(request.url); const id = url.searchParams.get("id") || ""; const language = url.searchParams.get("lang") || "en";
    const { data: order, error } = await admin.from("orders").select("*,order_items(*)").eq("id", id).maybeSingle<Order>();
    if (error) throw error; if (!order) return NextResponse.json({ error: "Tilausta ei löytynyt." }, { status: 404 });
    const isSeller = ownedCompany?.id === order.company_id; const isBuyer = order.customer_user_id === user.id;
    if (!isSeller && !isBuyer) return NextResponse.json({ error: "Sinulla ei ole oikeutta tähän tiedostoon." }, { status: 403 });
    const { data: company, error: companyError } = await admin.from("companies").select("*").eq("id", order.company_id).single<Company>();
    if (companyError) throw companyError;
    const snapshot = (order as Order & { return_policy_snapshot?: ReturnPolicy | null }).return_policy_snapshot;
    let policy = snapshot ? normalizeReturnPolicy(snapshot, company) : defaultReturnPolicy(company);
    if (!snapshot) { const result = await admin.from("company_return_policies").select("*").eq("company_id", company.id).maybeSingle<ReturnPolicy>(); if (result.error) throw result.error; if (result.data) policy = normalizeReturnPolicy(result.data, company); }
    if (isBuyer && !policy.customer_download) return NextResponse.json({ error: "Myyjä ei ole sallinut palautusohjeen lataamista tilaussivulta." }, { status: 403 });
    const pdfLanguage = isBuyer ? returnLanguageForCountry(order.customer_country, language) : language;
    const pdf = await createReturnInstructionsPdf({ order, items: (order.order_items ?? []) as OrderItem[], company, policy, language: pdfLanguage });
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${returnPdfFilename(order.order_number)}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error, "Palautusohjeiden PDF:n luominen epäonnistui."); }
}
