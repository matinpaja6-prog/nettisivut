export function sanitizePhoneInput(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  const hasPlus = compact.startsWith("+");
  const digits = compact.replace(/\+/g, "");

  return hasPlus ? `+${digits}` : digits;
}

export function sanitizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}
