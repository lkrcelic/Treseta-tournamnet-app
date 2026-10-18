"use client";

import {LOGO_FORMAT_ERROR, LOGO_MAX_BYTES, LOGO_SIZE_ERROR} from "@/app/_interfaces/sponsor";
import type {LogoUpload} from "@/app/_fetchers/sponsors";
import {CROP_OUT_HEIGHT, CropState, LogoShape, placement, shapeOf, trimBox, ZOOM_MAX} from "./logoCrop";

// A photo of a poster can be large; anything bigger than this isn't a logo
const SOURCE_MAX_BYTES = 25 * 1024 * 1024;

// The logo the admin picked (a file, a photo just taken, or one dropped on the dialog), ready for the cropper
export async function loadLogoFile(file: File): Promise<HTMLImageElement> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error(LOGO_FORMAT_ERROR);
  if (file.size > SOURCE_MAX_BYTES) throw new Error(LOGO_SIZE_ERROR);
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

// The sponsor's saved logo (this app's own address, so the cropper may draw it again)
export function loadLogoUrl(url: string): Promise<HTMLImageElement> {
  return loadImage(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(LOGO_FORMAT_ERROR));
    img.src = src;
  });
}

// The logo without its empty edges (trimBox), so it fills the crop frame from the start and its shape can be offered.
// The edges are found on a small copy, then cut from the full image, kept only as large as the deepest zoom can use.
// Anything that goes wrong leaves the logo as it was.
const PROBE = 400;
const TRIM_MAX = CROP_OUT_HEIGHT * ZOOM_MAX * 2;
export async function trimLogo(img: HTMLImageElement): Promise<{img: HTMLImageElement; trimmed: boolean}> {
  try {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const k = Math.min(1, PROBE / Math.max(iw, ih));
    const pw = Math.max(1, Math.round(iw * k));
    const ph = Math.max(1, Math.round(ih * k));
    const probe = document.createElement("canvas");
    probe.width = pw;
    probe.height = ph;
    const pctx = probe.getContext("2d", {willReadFrequently: true});
    if (!pctx) return {img, trimmed: false};
    pctx.drawImage(img, 0, 0, pw, ph);
    const box = trimBox(pctx.getImageData(0, 0, pw, ph).data, pw, ph);
    if (!box) return {img, trimmed: false};
    // back to the full image, a probe pixel wider on each side so nothing of the logo is lost
    const sx = Math.max(0, Math.floor((box.x - 1) / k));
    const sy = Math.max(0, Math.floor((box.y - 1) / k));
    const sw = Math.min(iw, Math.ceil((box.x + box.w + 1) / k)) - sx;
    const sh = Math.min(ih, Math.ceil((box.y + box.h + 1) / k)) - sy;
    const s = Math.min(1, TRIM_MAX / Math.max(sw, sh));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * s));
    out.height = Math.max(1, Math.round(sh * s));
    const octx = out.getContext("2d");
    if (!octx) return {img, trimmed: false};
    octx.imageSmoothingQuality = "high";
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) return {img, trimmed: false};
    const url = URL.createObjectURL(blob);
    try {
      return {img: await loadImage(url), trimmed: true};
    } catch {
      URL.revokeObjectURL(url);
      return {img, trimmed: false};
    }
  } catch {
    return {img, trimmed: false};
  }
}

// The cropped logo as it is sent: the frame in the chosen shape, CROP_OUT_HEIGHT px tall, transparent around the
// logo, as WebP (or PNG where the browser can't make WebP; both keep the transparency). preview: what the form shows
// meanwhile.
export function renderLogo(img: HTMLImageElement, crop: CropState, shape: LogoShape): LogoUpload & {preview: string} {
  const width = shapeOf(shape).width;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = CROP_OUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(LOGO_FORMAT_ERROR);
  const p = placement(img.naturalWidth, img.naturalHeight, width, CROP_OUT_HEIGHT, crop);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(p.cx, p.cy);
  ctx.rotate((p.rotate * Math.PI) / 180);
  ctx.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
  let data = canvas.toDataURL("image/webp", 0.9);
  // Safari before 17 answers PNG to a WebP request (and says so in the data: URL)
  if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/png");
  if (data.length * 0.75 > LOGO_MAX_BYTES) throw new Error(LOGO_SIZE_ERROR);
  return {data, width, height: CROP_OUT_HEIGHT, preview: data};
}
