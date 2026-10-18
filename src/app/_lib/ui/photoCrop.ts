import {PHOTO_FORMAT_ERROR, PHOTO_MAX_BYTES, PHOTO_SIDE, PHOTO_SIZE_ERROR} from "@/app/_interfaces/photo";

// Cropping a profile photo to its circle (Claude Design "Pomakni i zumiraj" M3, the dialog D2). Framework free apart
// from cropToSquare's canvas (the geometry is checked by __tests__/photoCrop.test.ts). Unlike a sponsor's logo
// (logoCrop.ts) the photo always covers the circle: at zoom 1 its shorter side spans it, it can't be made smaller,
// and it can't be moved so far that an edge shows.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

export type Rotation = 0 | 90 | 180 | 270;
// zoom: ZOOM_MIN to ZOOM_MAX; pan: how far the photo is moved, as a share (−1 to 1) of how far it may go each way,
// so a zoom never needs the pan clamped again; rotate: quarter turns, clockwise
export type PhotoCrop = {zoom: number; panX: number; panY: number; rotate: Rotation};
export const PHOTO_CROP_START: PhotoCrop = {zoom: 1, panX: 0, panY: 0, rotate: 0};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The photo's sides as they stand (a quarter turn swaps them)
function turned(iw: number, ih: number, rotate: Rotation): [number, number] {
  return rotate % 180 ? [ih, iw] : [iw, ih];
}

// The scale at which the photo's shorter side (as turned) spans the circle, times the zoom
export function coverScale(iw: number, ih: number, circle: number, zoom: number, rotate: Rotation): number {
  const [w, h] = turned(iw, ih, rotate);
  return (circle / Math.min(w, h)) * clamp(zoom, ZOOM_MIN, ZOOM_MAX);
}

// How far, in px, the photo's centre may move from the circle's each way before an edge would show inside the circle's
// square (and so inside the circle). A pan of ±1 is that far.
export function panLimits(iw: number, ih: number, circle: number, zoom: number, rotate: Rotation): {x: number; y: number} {
  const s = coverScale(iw, ih, circle, zoom, rotate);
  const [w, h] = turned(iw, ih, rotate);
  return {x: Math.max(0, (w * s - circle) / 2), y: Math.max(0, (h * s - circle) / 2)};
}

export function clampPhotoCrop(c: PhotoCrop): PhotoCrop {
  return {...c, zoom: clamp(c.zoom, ZOOM_MIN, ZOOM_MAX), panX: clamp(c.panX, -1, 1), panY: clamp(c.panY, -1, 1)};
}

// A drag of dx, dy px on a circle of that size: the pan it gives (nothing along a side with no room to move)
export function dragPhotoCrop(c: PhotoCrop, dx: number, dy: number, iw: number, ih: number, circle: number): PhotoCrop {
  const lim = panLimits(iw, ih, circle, c.zoom, c.rotate);
  return clampPhotoCrop({...c, panX: lim.x ? c.panX + dx / lim.x : 0, panY: lim.y ? c.panY + dy / lim.y : 0});
}

// Okreni: a quarter turn to the left, back to the middle (the old pan means nothing on the turned photo)
export function rotatePhotoLeft(c: PhotoCrop): PhotoCrop {
  return {...c, rotate: ((c.rotate + 270) % 360) as Rotation, panX: 0, panY: 0};
}

// Where the photo goes on a circle of that size: its centre (from the circle's top left), its size before turning,
// and the turn
export function photoPlacement(iw: number, ih: number, circle: number, c: PhotoCrop): {cx: number; cy: number; w: number; h: number; rotate: Rotation} {
  const s = coverScale(iw, ih, circle, c.zoom, c.rotate);
  const lim = panLimits(iw, ih, circle, c.zoom, c.rotate);
  return {cx: circle / 2 + clamp(c.panX, -1, 1) * lim.x, cy: circle / 2 + clamp(c.panY, -1, 1) * lim.y, w: iw * s, h: ih * s, rotate: c.rotate};
}

// The crop as it is sent: the circle's square at `side` px (the avatars round it), WebP 0.85. Where the browser can't
// make WebP (Safari before 17), PNG; a PNG of a photo can be too big, and then JPEG.
export function cropToSquare(img: HTMLImageElement, c: PhotoCrop, side = PHOTO_SIDE): string {
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(PHOTO_FORMAT_ERROR);
  const p = photoPlacement(img.naturalWidth, img.naturalHeight, side, c);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(p.cx, p.cy);
  ctx.rotate((p.rotate * Math.PI) / 180);
  ctx.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h);
  const fits = (data: string) => dataUrlBytes(data) <= PHOTO_MAX_BYTES;
  let data = canvas.toDataURL("image/webp", 0.85);
  // a browser without WebP answers PNG (and says so in the data: URL)
  if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/png");
  if (!fits(data)) data = canvas.toDataURL("image/jpeg", 0.88);
  if (!fits(data)) throw new Error(PHOTO_SIZE_ERROR);
  return data;
}

// the bytes a base64 data: URL holds
export function dataUrlBytes(data: string): number {
  const base64 = data.slice(data.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
}

// A photo straight from a phone's camera can be large; anything bigger than this isn't one
const SOURCE_MAX_BYTES = 30 * 1024 * 1024;

// The photo picked (a file, one just taken, or dropped on the dialog), ready for the cropper
export async function loadPhotoFile(file: File): Promise<HTMLImageElement> {
  // some phones give a camera photo without a type; the browser then says whether it can draw it
  if (file.type && !/^image\//i.test(file.type)) throw new Error(PHOTO_FORMAT_ERROR);
  if (file.size > SOURCE_MAX_BYTES) throw new Error(PHOTO_SIZE_ERROR);
  const url = URL.createObjectURL(file);
  try {
    return await loadPhoto(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

// A photo at this app's own address (the saved one to crop again, the Google picture through the server)
export function loadPhoto(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(PHOTO_FORMAT_ERROR));
    img.src = src;
  });
}
