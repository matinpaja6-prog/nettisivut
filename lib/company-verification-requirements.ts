export const COMPANY_VERIFICATION_REQUIRED_FIELDS = [
  "company_name",
  "business_id",
  "email",
  "phone",
  "public_address",
  "bio",
  "address",
  "postal_code",
  "city",
  "country"
] as const;

export type CompanyVerificationRequiredField =
  typeof COMPANY_VERIFICATION_REQUIRED_FIELDS[number];

export function missingCompanyVerificationFields(
  profile: Partial<Record<CompanyVerificationRequiredField, string | null | undefined>>
) {
  return COMPANY_VERIFICATION_REQUIRED_FIELDS.filter(
    (field) => !String(profile[field] ?? "").trim()
  );
}
