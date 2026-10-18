"use client";

import {LOGO_FORMAT_ERROR, LOGO_MAX_BYTES, LOGO_SIZE_ERROR} from "@/app/_interfaces/sponsor";
import type {LogoUpload} from "@/app/_fetchers/sponsors";
import {CROP_OUT_HEIGHT, CROP_OUT_WIDTH, CropState, placement} from "./logoCrop";

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

// The cropped logo as it is sent: the frame drawn at CROP_OUT_WIDTH px, transparent around the logo, as WebP (or PNG
// where the browser can't make WebP; both keep the transparency). preview: what the form shows meanwhile.
export function renderLogo(img: HTMLImageElement, crop: CropState): LogoUpload & {preview: string} {
  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUT_WIDTH;
  canvas.height = CROP_OUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(LOGO_FORMAT_ERROR);
  const p = placement(img.naturalWidth, img.naturalHeight, CROP_OUT_WIDTH, CROP_OUT_HEIGHT, crop);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(p.cx, p.cy);
  ctx.rotate((p.rotate * Math.PI) / 180);
  ctx.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
  let data = canvas.toDataURL("image/webp", 0.9);
  // Safari before 17 answers PNG to a WebP request (and says so in the data: URL)
  if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/png");
  if (data.length * 0.75 > LOGO_MAX_BYTES) throw new Error(LOGO_SIZE_ERROR);
  return {data, width: CROP_OUT_WIDTH, height: CROP_OUT_HEIGHT, preview: data};
}
