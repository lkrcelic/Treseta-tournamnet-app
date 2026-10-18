import {TILE_RATIO} from "@/app/_lib/ui/sponsors";

// Cropping a sponsor's logo (Claude Design "Profilna slika · dijalog", for logos), framework free (checked by
// __tests__/sponsors.test.ts). Unlike a profile photo, a logo never has to cover its frame: at the smallest zoom it is
// whole, so nothing of it is ever cut off; zoomed in, it can be moved but always fills the frame along a side where it
// is larger than the frame.

// The frame is the inside of the logo's tile (logoTile: 1.9 : 1, less 0.2 of the height on each side and 0.14 above
// and below), so the cropped logo fills it exactly
export const CROP_ASPECT = (TILE_RATIO - 0.4) / (1 - 0.28);
export const CROP_OUT_WIDTH = 512;
export const CROP_OUT_HEIGHT = Math.round(CROP_OUT_WIDTH / CROP_ASPECT);
export const ZOOM_MAX = 4;

export type Rotation = 0 | 90 | 180 | 270;
// zoom: 1 (the whole logo, as large as fits) to ZOOM_MAX; pan: the logo's centre moved by a share of the frame's
// width and height; rotate: quarter turns, clockwise
export type CropState = {zoom: number; panX: number; panY: number; rotate: Rotation};
export const CROP_START: CropState = {zoom: 1, panX: 0, panY: 0, rotate: 0};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The image's sides as they stand (a quarter turn swaps them)
function turned(iw: number, ih: number, rotate: Rotation): [number, number] {
  return rotate % 180 ? [ih, iw] : [iw, ih];
}

// The scale at zoom 1: the whole image, as large as fits in the frame
export function fitScale(iw: number, ih: number, fw: number, fh: number, rotate: Rotation): number {
  const [w, h] = turned(iw, ih, rotate);
  return Math.min(fw / w, fh / h);
}

// How far the logo may move, as a share of the frame: it stays inside the frame along a side where it is smaller, and
// fills the frame along a side where it is larger
export function panLimits(iw: number, ih: number, fw: number, fh: number, c: CropState): {x: number; y: number} {
  const s = fitScale(iw, ih, fw, fh, c.rotate) * c.zoom;
  const [w, h] = turned(iw, ih, c.rotate);
  return {x: Math.abs(fw - w * s) / 2 / fw, y: Math.abs(fh - h * s) / 2 / fh};
}

export function clampCrop(c: CropState, iw: number, ih: number, fw: number, fh: number): CropState {
  const zoomed = {...c, zoom: clamp(c.zoom, 1, ZOOM_MAX)};
  const lim = panLimits(iw, ih, fw, fh, zoomed);
  return {...zoomed, panX: clamp(zoomed.panX, -lim.x, lim.x), panY: clamp(zoomed.panY, -lim.y, lim.y)};
}

// Okreni: a quarter turn to the left, back to the middle (the old pan means nothing on the turned logo)
export function rotateLeft(c: CropState): CropState {
  return {...c, rotate: ((c.rotate + 270) % 360) as Rotation, panX: 0, panY: 0};
}

// Where the logo goes in a frame of fw × fh: its centre, its size before turning, and the turn
export function placement(iw: number, ih: number, fw: number, fh: number, c: CropState): {cx: number; cy: number; w: number; h: number; rotate: Rotation} {
  const s = fitScale(iw, ih, fw, fh, c.rotate) * c.zoom;
  return {cx: fw / 2 + c.panX * fw, cy: fh / 2 + c.panY * fh, w: iw * s, h: ih * s, rotate: c.rotate};
}
