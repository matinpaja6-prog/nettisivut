export function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, "");
}

export function sanitizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}
