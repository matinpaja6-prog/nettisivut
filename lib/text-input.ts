const CONTROL_CHARACTERS_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanUserText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";

  return value
    .replace(CONTROL_CHARACTERS_EXCEPT_WHITESPACE, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function cleanOptionalUserText(value: unknown, maxLength: number) {
  const cleaned = cleanUserText(value, maxLength);
  return cleaned || null;
}
