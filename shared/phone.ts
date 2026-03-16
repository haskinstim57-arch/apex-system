// ─────────────────────────────────────────────
// E.164 Phone Number Validation
// Shared between server and client
// ─────────────────────────────────────────────

/**
 * E.164 format: + followed by 1-15 digits
 * Examples: +15551234567, +442071234567
 */
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/** Check if a phone number is valid E.164 format */
export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone.trim());
}

/**
 * Attempt to normalize a US phone number to E.164.
 * - "5551234567" → "+15551234567"
 * - "(555) 123-4567" → "+15551234567"
 * - "1-555-123-4567" → "+15551234567"
 * - "+15551234567" → "+15551234567" (already valid)
 *
 * Returns the normalized number, or null if it can't be normalized.
 */
export function normalizeToE164(phone: string): string | null {
  if (!phone) return null;

  // Strip all non-digit characters except leading +
  const stripped = phone.trim();
  if (isValidE164(stripped)) return stripped;

  // Remove everything except digits
  const digits = stripped.replace(/\D/g, "");

  // US number: 10 digits → prepend +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // US number with country code: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Other international: if it has 7-15 digits, prepend +
  if (digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/** User-friendly validation message */
export const E164_ERROR_MESSAGE =
  "Phone number must be in E.164 format (e.g., +15551234567). Include the country code with a + prefix.";
