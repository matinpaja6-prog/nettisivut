export type VerificationStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type ShippingPriceStrategy = "max" | "sum";
export type ShippingMethod = "pickup" | "posti";
export type { FeeEstimateMethod, FeePricingStrategy } from "@/lib/commerce/fees";

import type { FeeEstimateMethod, FeePricingStrategy } from "@/lib/commerce/fees";

export type Company = {
  id: string;
  owner_user_id: string;
  name: string;
  business_id: string;
  vat_id: string | null;
  address_line: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  contact_person: string;
  website: string | null;
  description: string;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  admin_notes: string | null;
  verified_at: string | null;
  verified_by_admin_id: string | null;
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_requirements_due: string[];
  shipping_price_strategy: ShippingPriceStrategy;
  default_shipping_price_fi_cents: number | null;
  default_shipping_price_se_cents: number | null;
  default_shipping_price_no_cents: number | null;
  shipping_countries: string[];
  posti_enabled: boolean;
  pickup_email_message: string;
  fee_pricing_strategy: FeePricingStrategy;
  fee_estimate_method: FeeEstimateMethod;
  default_vat_rate: number;
  banner_image_url: string | null;
  social_share_image_url: string | null;
  storefront_headline: string;
  storefront_categories: string[];
  storefront_promo_enabled: boolean;
  storefront_promo_title: string;
  storefront_promo_subtitle: string;
  storefront_promo_image_url: string | null;
  storefront_promo_background_color: string;
  free_shipping_threshold_cents: number | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  storefront_category: string | null;
  price_cents: number;
  sale_price_cents: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  seller_target_price_cents: number | null;
  vat_rate: number;
  stock_quantity: number;
  reserved_quantity: number;
  active: boolean;
  published_at: string | null;
  image_urls: string[];
  pickup_available: boolean;
  pickup_address_override: string | null;
  pickup_instructions: string | null;
  shipping_available: boolean;
  posti_enabled: boolean;
  shipping_price_cents: number | null;
  shipping_price_fi_cents: number | null;
  shipping_price_se_cents: number | null;
  shipping_price_no_cents: number | null;
  free_shipping_threshold_cents: number | null;
  weight_grams: number | null;
  package_length_cm: number | null;
  package_width_cm: number | null;
  package_height_cm: number | null;
  max_shipping_quantity: number;
  shipping_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicProduct = Product & {
  company: Pick<
    Company,
    | "id"
    | "owner_user_id"
    | "name"
    | "business_id"
    | "address_line"
    | "postal_code"
    | "city"
    | "country"
    | "email"
    | "phone"
    | "shipping_price_strategy"
    | "posti_enabled"
    | "shipping_countries"
    | "free_shipping_threshold_cents"
  >;
};

export type PublicStorefront = {
  company_id: string;
  owner_user_id: string;
  name: string;
  description: string;
  business_id: string;
  address_line: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  contact_person: string;
  verified_at: string | null;
  created_at: string;
  website: string | null;
  banner_image_url: string | null;
  social_share_image_url: string | null;
  storefront_headline: string;
  storefront_categories: string[];
  storefront_promo_enabled: boolean;
  storefront_promo_title: string;
  storefront_promo_subtitle: string;
  storefront_promo_image_url: string | null;
  storefront_promo_background_color: string;
  shipping_price_strategy: ShippingPriceStrategy;
  default_shipping_price_fi_cents: number | null;
  default_shipping_price_se_cents: number | null;
  default_shipping_price_no_cents: number | null;
  posti_enabled: boolean;
  shipping_countries: string[];
  pickup_email_message: string;
  free_shipping_threshold_cents: number | null;
};

export type CartLine = {
  productId: string;
  quantity: number;
};

export type PickupPoint = {
  id: string;
  name: string;
  address: string;
  postalCode?: string;
  city?: string;
  parcelLocker?: boolean;
  distanceInMeters?: number | null;
};

export type CheckoutRequest = {
  locale?: "fi" | "en" | "sv" | "no";
  items: CartLine[];
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  customerPostalCode?: string;
  customerCity?: string;
  customerCountry?: string;
  buyerType?: "private" | "company";
  customerCompany?: string;
  customerBusinessId?: string;
  orderNotes?: string;
  shippingMethod?: ShippingMethod;
  pickupPoint?: PickupPoint | null;
  sellerSelections?: Array<{
    companyId: string;
    shippingMethod: ShippingMethod;
    pickupPoint?: PickupPoint | null;
    discountCode?: string;
  }>;
};

export type DiscountType = "percent" | "fixed";

export type CompanyDiscountCode = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_cents: number;
  maximum_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_description_snapshot: string | null;
  image_url_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  vat_rate: number;
  vat_cents: number;
  line_total_cents: number;
  pickup_available_snapshot: boolean;
  pickup_address_snapshot: string | null;
  pickup_instructions_snapshot: string | null;
  shipping_available_snapshot: boolean;
  shipping_price_cents_snapshot: number | null;
  weight_grams_snapshot: number | null;
  package_size_snapshot: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  shipping_notes_snapshot: string | null;
};

export type Order = {
  id: string;
  company_id: string;
  checkout_group_id?: string | null;
  customer_user_id?: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address?: string | null;
  customer_postal_code?: string | null;
  customer_city?: string | null;
  customer_country?: string | null;
  customer_locale?: "fi" | "en" | "sv" | "no" | null;
  buyer_type?: "private" | "company";
  buyer_company_name?: string | null;
  buyer_business_id?: string | null;
  buyer_vat_id?: string | null;
  buyer_company_address?: string | null;
  buyer_company_email?: string | null;
  buyer_company_phone?: string | null;
  buyer_company_contact_person?: string | null;
  buyer_company_website?: string | null;
  order_number: string;
  payment_status: string;
  payment_error: string | null;
  fulfillment_status: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  product_total_cents?: number;
  discount_code?: string | null;
  discount_cents?: number;
  maskines_fee_cents: number;
  stripe_processing_fee_cents: number | null;
  stripe_payment_method_type: string | null;
  currency: string;
  shipping_method: ShippingMethod;
  shipping_price_cents: number;
  pickup_point_id: string | null;
  pickup_point_name: string | null;
  pickup_point_address: string | null;
  posti_tracking_code: string | null;
  posti_tracking_url: string | null;
  shipping_label_url: string | null;
  internal_notes?: string;
  return_policy_snapshot?: import("@/lib/commerce/returns").ReturnPolicy | null;
  seller_name_snapshot: string;
  seller_business_id_snapshot: string;
  seller_vat_id_snapshot: string | null;
  seller_address_snapshot: string;
  receipt_sent_at: string | null;
  seller_notified_at: string | null;
  tracking_email_sent_at: string | null;
  pickup_ready_email_sent_at: string | null;
  paid_at: string | null;
  stripe_transfer_id?: string | null;
  stripe_transfer_status?: string;
  seller_transfer_cents?: number;
  stripe_payment_intent_id?: string | null;
  created_at: string;
  order_items?: OrderItem[];
};

export type ProductDraft = Omit<
  Product,
  "id" | "company_id" | "reserved_quantity" | "published_at" | "created_at" | "updated_at"
>;
