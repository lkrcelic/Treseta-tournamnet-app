"use client";

import {LOGO_FORMAT_ERROR, LOGO_MAX_BYTES, LOGO_MAX_SIDE, LOGO_SIZE_ERROR} from "@/app/_interfaces/sponsor";
import type {LogoUpload} from "@/app/_fetchers/sponsors";

// A logo the admin picked, made ready to send: drawn at most LOGO_MAX_SIDE px on its longer side (a phone photo of a
// poster would be megabytes) and sent as WebP, or PNG where the browser can't make WebP (both keep a transparent
// background). Also its size, which sets the shape of its tile. preview: what the form shows meanwhile.
export async function prepareLogo(file: File): Promise<LogoUpload & {preview: string}> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error(LOGO_FORMAT_ERROR);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(LOGO_FORMAT_ERROR);
    ctx.drawImage(img, 0, 0, width, height);
    let data = canvas.toDataURL("image/webp", 0.9);
    // Safari before 17 answers PNG to a WebP request (and says so in the data: URL)
    if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/png");
    if (data.length * 0.75 > LOGO_MAX_BYTES) throw new Error(LOGO_SIZE_ERROR);
    return {data, width, height, preview: data};
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(LOGO_FORMAT_ERROR));
    img.src = src;
  });
}
