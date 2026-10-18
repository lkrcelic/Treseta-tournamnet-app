// Images people upload (sponsor logos, profile photos), framework free (checked by __tests__/images.test.ts)

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

// What the file is, from its first bytes (a file's name or the type the browser claims proves nothing). SVG isn't
// taken: it could carry a script.
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const at = (i: number, ...b: number[]) => b.every((v, k) => bytes[i + k] === v);
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // RIFF....WEBP
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

// A wrong image is the uploader's mistake: the API answers 400 with the message (apiErrors.ts)
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
    // instanceof holds even where the class is compiled to ES5 (the tests)
    Object.setPrototypeOf(this, ImageError.prototype);
  }
}

// The image a browser sent (base64, or a data: URL), as bytes with its type; throws an ImageError with messages.format
// when it isn't a PNG, JPEG or WebP, and with messages.size when it is over maxBytes
export function decodeImage(data: string, maxBytes: number, messages: {format: string; size: string}): {bytes: Buffer; type: ImageType} {
  const base64 = data.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new ImageError(messages.format);
  // checked before decoding: base64 is 4 characters for 3 bytes
  if (Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0) > maxBytes) {
    throw new ImageError(messages.size);
  }
  const bytes = Buffer.from(base64, "base64");
  const type = detectImageType(bytes);
  if (!type) throw new ImageError(messages.format);
  return {bytes, type};
}
