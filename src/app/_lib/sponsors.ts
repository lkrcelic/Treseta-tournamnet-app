import {LOGO_FORMAT_ERROR, LOGO_MAX_BYTES, LOGO_SIZE_ERROR, LogoType} from "@/app/_interfaces/sponsor";

// Sponsor logos, framework free (checked by __tests__/sponsors.test.ts)

// What the file is, from its first bytes (a logo's name or the type the browser claims proves nothing). SVG isn't
// taken: it could carry a script.
export function detectLogoType(bytes: Uint8Array): LogoType | null {
  const at = (i: number, ...b: number[]) => b.every((v, k) => bytes[i + k] === v);
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // RIFF....WEBP
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

export class LogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoError";
    // instanceof holds even where the class is compiled to ES5 (the tests)
    Object.setPrototypeOf(this, LogoError.prototype);
  }
}

// The logo the admin's browser sent (base64, or a data: URL), as bytes with its type; throws a LogoError the admin can
// read when it isn't a PNG, JPEG or WebP, or is over 1 MB
export function decodeLogo(data: string): {bytes: Buffer; type: LogoType} {
  const base64 = data.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new LogoError(LOGO_FORMAT_ERROR);
  // checked before decoding: base64 is 4 characters for 3 bytes
  if (Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0) > LOGO_MAX_BYTES) {
    throw new LogoError(LOGO_SIZE_ERROR);
  }
  const bytes = Buffer.from(base64, "base64");
  const type = detectLogoType(bytes);
  if (!type) throw new LogoError(LOGO_FORMAT_ERROR);
  return {bytes, type};
}

// The logo's address; the version (when the sponsor last changed) makes a new logo a new address, so the old one can
// be cached for good
export function sponsorLogoPath(id: number, updatedAt: Date): string {
  return `/api/sponsors/${id}/logo?v=${updatedAt.getTime()}`;
}
