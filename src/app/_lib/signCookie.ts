import {createHmac} from "crypto";
import {Cookie} from "lucia";
import {RequestCookie} from "next/dist/compiled/@edge-runtime/cookies";

const SECRET_KEY = process.env.SECRET_KEY ?? "zbla";

export function signCookie(cookie: Cookie): void {
  const cookieData = JSON.stringify(cookie);
  const signedCookie = createHmac("sha256", SECRET_KEY).update(cookieData).digest("hex");
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
  const key = await crypto.subtle.importKey("raw", encoder.encode(SECRET_KEY), {name: "HMAC", hash: "SHA-256"}, false, [
    "sign",
  ]);

  const signatureArrayBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(cookieData));

  const computedSignature = Array.from(new Uint8Array(signatureArrayBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return computedSignature === providedSignature;
}
