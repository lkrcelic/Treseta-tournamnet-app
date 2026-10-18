import assert from "node:assert/strict";
import {test} from "node:test";
import {decodeImage, detectImageType, ImageError} from "../images";
import {PHOTO_FORMAT_ERROR, PHOTO_MAX_BYTES, PHOTO_SIDE, PHOTO_SIZE_ERROR} from "../../_interfaces/photo";
import {errorResponse} from "../apiErrors";

// Every uploaded image (sponsor logos, profile photos) is checked by its bytes and its size on the server

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const MESSAGES = {format: PHOTO_FORMAT_ERROR, size: PHOTO_SIZE_ERROR};

test("detectImageType knows PNG, JPEG and WebP by their first bytes, and nothing else", () => {
  assert.equal(detectImageType(PNG), "image/png");
  assert.equal(detectImageType(JPEG), "image/jpeg");
  assert.equal(detectImageType(WEBP), "image/webp");
  assert.equal(detectImageType(SVG), null);
  assert.equal(detectImageType(Buffer.from("GIF89a")), null);
  assert.equal(detectImageType(new Uint8Array()), null);
});

test("decodeImage takes base64 or a data: URL and refuses anything else, or over the limit", () => {
  assert.equal(decodeImage(PNG.toString("base64"), PHOTO_MAX_BYTES, MESSAGES).type, "image/png");
  const fromDataUrl = decodeImage(`data:image/webp;base64,${WEBP.toString("base64")}`, PHOTO_MAX_BYTES, MESSAGES);
  assert.equal(fromDataUrl.type, "image/webp");
  assert.deepEqual(fromDataUrl.bytes, WEBP);
  // the type the browser claims proves nothing
  assert.throws(() => decodeImage(`data:image/png;base64,${SVG.toString("base64")}`, PHOTO_MAX_BYTES, MESSAGES), new ImageError(PHOTO_FORMAT_ERROR));
  assert.throws(() => decodeImage("not base64 at all!", PHOTO_MAX_BYTES, MESSAGES), new ImageError(PHOTO_FORMAT_ERROR));
});

test("a profile photo may be at most 512 KB", () => {
  assert.equal(PHOTO_MAX_BYTES, 512 * 1024);
  assert.equal(PHOTO_SIDE, 512);
  const big = Buffer.concat([WEBP, Buffer.alloc(PHOTO_MAX_BYTES)]);
  assert.throws(() => decodeImage(big.toString("base64"), PHOTO_MAX_BYTES, MESSAGES), new ImageError(PHOTO_SIZE_ERROR));
  const justFits = Buffer.concat([WEBP, Buffer.alloc(PHOTO_MAX_BYTES - WEBP.length)]);
  assert.equal(decodeImage(justFits.toString("base64"), PHOTO_MAX_BYTES, MESSAGES).bytes.length, PHOTO_MAX_BYTES);
});

test("a wrong image is the uploader's mistake (400), not the server's", async () => {
  const response = errorResponse(new ImageError(PHOTO_FORMAT_ERROR), "Slika nije spremljena.");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error: PHOTO_FORMAT_ERROR});
});
