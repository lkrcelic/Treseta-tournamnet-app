import {createHmac} from "crypto";
import {Cookie} from "lucia";
import {RequestCookie} from "next/dist/compiled/@edge-runtime/cookies";

// No hardcoded fallback in production: a known key would let anyone forge the signature
function secretKey(): string {
  const key = process.env.SECRET_KEY ?? (process.env.NODE_ENV === "production" ? undefined : "local-dev-secret");
  if (!key) {
    throw new Error("SECRET_KEY is not set");
  }
  return key;
}

export function signCookie(cookie: Cookie): void {
  const cookieData = JSON.stringify(cookie);
  const signedCookie = createHmac("sha256", secretKey()).update(cookieData).digest("hex");
  cookie.value = `${cookieData}.${signedCookie}`;
}

export async function verifyCookie(cookie: Cookie): Promise<Cookie | null> {
  if (!cookie) {
    return null;
  }

  // Extract session data and the signature from the cookie
  const [cookieData, providedSignature] = cookie.value.split(".");

  if (!cookieData || !providedSignature) {
    return null; // Invalid cookie format
  }

  const verified = await verifySignature(cookieData, providedSignature);

  if (!verified) {
    return null; // Signature does not match, invalid session
  }

  // signatures match, return cookieData
  return JSON.parse(cookieData) as Cookie;
}

export function extractCookieWithoutSignature(signedCookie: RequestCookie): Cookie {
  const [cookieData] = signedCookie.value.split(".");
  return JSON.parse(cookieData) as Cookie;
}

async function verifySignature(cookieData: string, providedSignature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secretKey()), {name: "HMAC", hash: "SHA-256"}, false, [
    "sign",
  ]);

  const signatureArrayBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(cookieData));

  const computedSignature = Array.from(new Uint8Array(signatureArrayBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(computedSignature, providedSignature);
}

// Compares without stopping at the first different character, so the time taken doesn't leak the signature
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
