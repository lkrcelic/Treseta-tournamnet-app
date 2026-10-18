import assert from "node:assert/strict";
import {test} from "node:test";
import {
  clampPhotoCrop,
  coverScale,
  dataUrlBytes,
  dragPhotoCrop,
  PHOTO_CROP_START,
  PhotoCrop,
  panLimits,
  photoPlacement,
  rotatePhotoLeft,
  Rotation,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../ui/photoCrop";

// Pomakni i zumiraj (M3, D2): the photo always covers the circle, however it is zoomed, turned or moved

const CIRCLE = 300;
const PHOTOS: [number, number][] = [
  [4032, 3024], // a phone's landscape photo
  [3024, 4032], // portrait
  [512, 512], // square
  [96, 96], // Google's small picture: scaled up, still covers
];

// the photo's box as drawn on the circle (turned), and whether it holds the whole circle's square
function covers(iw: number, ih: number, c: PhotoCrop): boolean {
  const p = photoPlacement(iw, ih, CIRCLE, c);
  const [w, h] = p.rotate % 180 ? [p.h, p.w] : [p.w, p.h];
  const eps = 1e-6;
  return p.cx - w / 2 <= eps && p.cy - h / 2 <= eps && p.cx + w / 2 >= CIRCLE - eps && p.cy + h / 2 >= CIRCLE - eps;
}

test("at zoom 1, 2 and 3, turned or not, moved as far as it goes in any direction, the photo covers the circle", () => {
  for (const [iw, ih] of PHOTOS) {
    for (const zoom of [1, 2, 3]) {
      for (const rotate of [0, 90, 180, 270] as Rotation[]) {
        for (const panX of [-1, 0, 1]) {
          for (const panY of [-1, 0, 1]) {
            assert.ok(covers(iw, ih, {zoom, panX, panY, rotate}), `${iw}×${ih} zoom ${zoom} turn ${rotate} pan ${panX},${panY}`);
          }
        }
      }
    }
  }
});

test("at zoom 1 the shorter side spans the circle exactly, so there is room to move only along the longer one", () => {
  const lim = panLimits(4032, 3024, CIRCLE, 1, 0);
  assert.equal(lim.y, 0);
  assert.equal(lim.x, (4032 * (CIRCLE / 3024) - CIRCLE) / 2);
  // turned a quarter, the room is along the other side
  const turned = panLimits(4032, 3024, CIRCLE, 1, 90);
  assert.equal(turned.x, 0);
  assert.ok(turned.y > 0);
  // a square photo can't move at zoom 1, and can at zoom 2
  assert.deepEqual(panLimits(512, 512, CIRCLE, 1, 0), {x: 0, y: 0});
  assert.deepEqual(panLimits(512, 512, CIRCLE, 2, 0), {x: CIRCLE / 2, y: CIRCLE / 2});
});

test("zoom stays between 1 and 3 and the pan between −1 and 1", () => {
  assert.deepEqual(clampPhotoCrop({zoom: 0.4, panX: -3, panY: 2, rotate: 0}), {zoom: ZOOM_MIN, panX: -1, panY: 1, rotate: 0});
  assert.equal(clampPhotoCrop({...PHOTO_CROP_START, zoom: 9}).zoom, ZOOM_MAX);
  // smaller than the circle is not allowed: the scale never drops below cover
  assert.equal(coverScale(512, 512, CIRCLE, 0.5, 0), coverScale(512, 512, CIRCLE, 1, 0));
});

test("dragging moves the photo until its edge meets the circle, and no further", () => {
  const start = {...PHOTO_CROP_START, zoom: 2};
  const lim = panLimits(512, 512, CIRCLE, 2, 0);
  const moved = dragPhotoCrop(start, lim.x / 2, 0, 512, 512, CIRCLE);
  assert.equal(moved.panX, 0.5);
  assert.equal(dragPhotoCrop(moved, 10_000, -10_000, 512, 512, CIRCLE).panX, 1);
  assert.equal(dragPhotoCrop(moved, 10_000, -10_000, 512, 512, CIRCLE).panY, -1);
  // no room along a side: the drag does nothing there
  assert.equal(dragPhotoCrop(PHOTO_CROP_START, 0, 50, 4032, 3024, CIRCLE).panY, 0);
});

test("Okreni turns a quarter to the left and goes back to the middle", () => {
  const c = rotatePhotoLeft({zoom: 2, panX: 0.4, panY: -0.2, rotate: 0});
  assert.deepEqual(c, {zoom: 2, panX: 0, panY: 0, rotate: 270});
  assert.equal(rotatePhotoLeft(rotatePhotoLeft(rotatePhotoLeft(c))).rotate, 0);
});

test("a data: URL's size is what it decodes to", () => {
  assert.equal(dataUrlBytes(`data:image/webp;base64,${Buffer.alloc(1000).toString("base64")}`), 1000);
  assert.equal(dataUrlBytes(`data:image/png;base64,${Buffer.alloc(1001).toString("base64")}`), 1001);
});
