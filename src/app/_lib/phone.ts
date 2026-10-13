// Phone numbers in Burza igrača: typed the Croatian way ("091 234 5678"), stored and shown with the country code
// ("+385 91 234 5678"), and called or opened in WhatsApp from an ad. Framework free so they can be unit tested.

export const PHONE_MIN_DIGITS = 9;
const PHONE_MAX_DIGITS = 15; // the longest international number (E.164)

export const PHONE_HINT = "Obavezno. Broj piše na oglasu da te mogu nazvati.";
// (the example number doesn't break across lines: no-break spaces)
export const PHONE_ERROR = "Upiši cijeli broj, npr. 091\u00a0234\u00a05678.";

// What a phone field keeps while typing: digits, spaces and a plus
export function phoneInput(value: string): string {
  return value.replace(/[^\d+ ]/g, "");
}

export function phoneDigits(value: string | null | undefined): number {
  return (value ?? "").replace(/\D/g, "").length;
}

// The number with its country code, as digits only ("385912345678"); null when it can't be a phone number
function internationalDigits(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < PHONE_MIN_DIGITS) return null;
  let intl: string;
  if (raw.startsWith("+")) intl = digits;
  else if (digits.startsWith("00")) intl = digits.slice(2);
  else if (digits.startsWith("385")) intl = digits;
  // a Croatian number without the country code: "091 234 5678", or "91 234 5678"
  else intl = `385${digits.startsWith("0") ? digits.slice(1) : digits}`;
  return intl.length >= PHONE_MIN_DIGITS && intl.length <= PHONE_MAX_DIGITS ? intl : null;
}

export function isValidPhone(value: string | null | undefined): boolean {
  return internationalDigits(value) != null;
}

// "+385 91 234 5678" (Zagreb: "+385 1 234 5678"); another country's number keeps its own spacing
export function normalizePhone(value: string | null | undefined): string | null {
  const intl = internationalDigits(value);
  if (!intl) return null;
  if (intl.startsWith("385")) {
    const national = intl.slice(3);
    const area = national.startsWith("1") ? 1 : 2;
    const rest = national.slice(area);
    return ["+385", national.slice(0, area), rest.slice(0, 3), rest.slice(3)].filter(Boolean).join(" ");
  }
  const typed = (value ?? "").trim().replace(/^(\+|00)/, "").replace(/[^\d ]/g, "").replace(/\s+/g, " ").trim();
  return `+${typed}`;
}

// Whether an ad's number also goes on the player's profile: a valid new number always does when the profile has
// none; one that would replace the profile's only while "Zamijeni i broj na profilu" stays checked
export function savesToProfile(value: string, profile: string | null, replace: boolean): boolean {
  const phone = normalizePhone(value);
  return phone != null && phone !== profile && (profile == null || replace);
}

export function telHref(phone: string): string {
  return `tel:+${internationalDigits(phone) ?? phone.replace(/\D/g, "")}`;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${internationalDigits(phone) ?? phone.replace(/\D/g, "")}`;
}
