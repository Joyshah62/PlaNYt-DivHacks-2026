import { z } from "zod";

/**
 * A phone number in E.164 ("+12125550123"), or null if it isn't one. Ten
 * digits are a US number; anything else needs its country code ("+44 …").
 */
export function normalizePhone(input: string): string | null {
  const s = input.trim();
  if (!s || /[a-z@]/i.test(s)) return null;
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** A phone number as typed, stored in E.164; the message is shown to the traveler as is. */
export const PhoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Enter a valid phone number, like (212) 555-0123 or +44 20 7946 0958." });
    return z.NEVER;
  }
  return phone;
});

/** "+12125550123" -> "(212) 555-0123"; other countries stay in E.164. */
export function formatPhone(phone: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : phone;
}
