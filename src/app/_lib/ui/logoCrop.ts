import {WIDE_ASPECT} from "@/app/_lib/ui/sponsors";

// Cropping a sponsor's logo (Claude Design "Profilna slika · dijalog", for logos), framework free (checked by
// __tests__/sponsors.test.ts). Unlike a profile photo, a logo never has to cover its frame: at the smallest zoom it is
// whole, so nothing of it is ever cut off; zoomed in, it can be moved but always fills the frame along a side where it
// is larger than the frame.

// The frame is the inside of the logo's tile (logoTile: less 0.2 of the height on each side and 0.14 above and below),
// so the cropped logo fills it exactly. Its shape (Oblik loga) is the admin's choice: Široki for a wide logo (the
// widest tile, 1.9 : 1), Srednji, or Kvadrat for a round or square one, so a narrow logo doesn't leave empty space
// beside it in the band. The cropped logo is always CROP_OUT_HEIGHT px tall.
export type LogoShape = "wide" | "medium" | "square";
export const LOGO_SHAPES: {key: LogoShape; label: string; aspect: number; width: number}[] = [
  {key: "wide", label: "Široki", aspect: WIDE_ASPECT, width: 512},
  {key: "medium", label: "Srednji", aspect: 1.5, width: 369},
  {key: "square", label: "Kvadrat", aspect: 1, width: 246},
];
export const CROP_ASPECT = WIDE_ASPECT;
export const CROP_OUT_WIDTH = 512;
export const CROP_OUT_HEIGHT = 246;
export const ZOOM_MAX = 4;

export function shapeOf(key: LogoShape) {
  return LOGO_SHAPES.find((s) => s.key === key) ?? LOGO_SHAPES[0];
}

// The shape a logo of this aspect (width over height) is offered first: the nearest of the three
export function shapeFor(aspect: number): LogoShape {
  if (!(aspect > 0)) return "wide";
  if (aspect >= Math.sqrt(WIDE_ASPECT * 1.5)) return "wide";
  if (aspect >= Math.sqrt(1.5)) return "medium";
  return "square";
}

// The part of an image that isn't empty edge (Prazni rubovi): where the corners are transparent, everything nearly
// transparent is edge; where all four corners are one solid colour (a logo on white), everything close to that colour
// is. rgba: the image's pixels, w × h. null when there is nothing to cut (no common edge, almost nothing to take off,
// or nothing but edge).
export function trimBox(rgba: ArrayLike<number>, w: number, h: number): {x: number; y: number; w: number; h: number} | null {
  if (w < 3 || h < 3) return null;
  const at = (x: number, y: number) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const clear = corners.every((i) => rgba[i + 3] < 16);
  const [r0, g0, b0] = [rgba[corners[0]], rgba[corners[0] + 1], rgba[corners[0] + 2]];
  const near = (i: number) => Math.abs(rgba[i] - r0) + Math.abs(rgba[i + 1] - g0) + Math.abs(rgba[i + 2] - b0) <= 48;
  const solid = !clear && corners.every((i) => rgba[i + 3] > 240 && near(i));
  if (!clear && !solid) return null;
  const edge = (i: number) => rgba[i + 3] < 16 || (solid && near(i));
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edge(at(x, y))) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const box = {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
  // less than 2 % off each way isn't worth a new image
  if (box.w > w * 0.98 && box.h > h * 0.98) return null;
  return box;
}

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
