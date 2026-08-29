export const RETURN_LANGUAGES = ["fi", "en", "sv", "no"] as const;
export type ReturnLanguage = typeof RETURN_LANGUAGES[number];
export type ReturnTranslation = { instructions: string; conditions: string; exclusions: string; packing: string; pickup_instructions: string };
export type ReturnPolicy = {
  company_id: string; enabled: boolean; return_window_days: number; recipient_name: string; company_name: string;
  address_line: string; postal_code: string; city: string; country: string; email: string; phone: string;
  shipping_method: string; shipping_payer: "customer" | "seller"; return_identifier: string; customer_service: string;
  translations: Record<string, ReturnTranslation>; automatic_pdf: boolean; attach_to_confirmation: boolean;
  attach_to_shipping: boolean; customer_download: boolean; updated_at?: string;
};
