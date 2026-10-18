import {LOGO_FORMAT_ERROR, LOGO_MAX_BYTES, LOGO_SIZE_ERROR, LogoType} from "@/app/_interfaces/sponsor";
import {decodeImage, detectImageType} from "@/app/_lib/images";

// Sponsor logos, framework free (checked by __tests__/sponsors.test.ts). The checks are the ones every uploaded image
// gets (images.ts).

export {ImageError as LogoError} from "@/app/_lib/images";

export const detectLogoType: (bytes: Uint8Array) => LogoType | null = detectImageType;

// The logo the admin's browser sent (base64, or a data: URL), as bytes with its type; throws a LogoError the admin can
// read when it isn't a PNG, JPEG or WebP, or is over 1 MB
export function decodeLogo(data: string): {bytes: Buffer; type: LogoType} {
  return decodeImage(data, LOGO_MAX_BYTES, {format: LOGO_FORMAT_ERROR, size: LOGO_SIZE_ERROR});
}

// The logo's address; the version (when the sponsor last changed) makes a new logo a new address, so the old one can
// be cached for good
export function sponsorLogoPath(id: number, updatedAt: Date): string {
  return `/api/sponsors/${id}/logo?v=${updatedAt.getTime()}`;
}
