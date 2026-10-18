import assert from "node:assert/strict";
import {test} from "node:test";
import {
  LeagueSponsorsValidation,
  LOGO_FORMAT_ERROR,
  LOGO_MAX_BYTES,
  LOGO_REQUIRED,
  LOGO_SIZE_ERROR,
  SPONSOR_URL_ERROR,
  SponsorCreateValidation,
  SponsorEventValidation,
  SponsorUpdateValidation,
} from "../../_interfaces/sponsor";
import {errorResponse} from "../apiErrors";
import {decodeLogo, detectLogoType, LogoError, sponsorLogoPath} from "../sponsors";
import {clampCrop, CROP_ASPECT, CROP_OUT_HEIGHT, CROP_OUT_WIDTH, CROP_START, fitScale, LOGO_SHAPES, panLimits, placement, rotateLeft, shapeFor, trimBox, ZOOM_MAX} from "../ui/logoCrop";
import {bandRounds, bandSeconds, countsLabel, deleteSponsorText, groupDigits, leaguesLabel, logoAspect, logoTile, moveItem, NO_LEAGUE, pickSub, sponsorSub} from "../ui/sponsors";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "latin1");
const SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);

test("a logo's type comes from its bytes: PNG, JPEG and WebP only", () => {
  assert.equal(detectLogoType(PNG), "image/png");
  assert.equal(detectLogoType(JPEG), "image/jpeg");
  assert.equal(detectLogoType(WEBP), "image/webp");
  assert.equal(detectLogoType(SVG), null);
  assert.equal(detectLogoType(Buffer.from("GIF89a")), null);
  assert.equal(detectLogoType(new Uint8Array()), null);
});

test("decodeLogo takes base64 or a data: URL and refuses anything else, or over 1 MB", () => {
  assert.equal(decodeLogo(PNG.toString("base64")).type, "image/png");
  const fromDataUrl = decodeLogo(`data:image/webp;base64,${WEBP.toString("base64")}`);
  assert.equal(fromDataUrl.type, "image/webp");
  assert.deepEqual(fromDataUrl.bytes, WEBP);
  // the type the browser claims proves nothing
  assert.throws(() => decodeLogo(`data:image/png;base64,${SVG.toString("base64")}`), new LogoError(LOGO_FORMAT_ERROR));
  assert.throws(() => decodeLogo("not base64 at all!"), new LogoError(LOGO_FORMAT_ERROR));
  const big = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)]);
  assert.throws(() => decodeLogo(big.toString("base64")), new LogoError(LOGO_SIZE_ERROR));
  const justFits = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES - PNG.length)]);
  assert.equal(decodeLogo(justFits.toString("base64")).bytes.length, LOGO_MAX_BYTES);
});

test("a wrong logo is the admin's mistake (400), not the server's", async () => {
  const response = errorResponse(new LogoError(LOGO_FORMAT_ERROR), "Sponzor nije dodan.");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error: LOGO_FORMAT_ERROR});
});

test("the logo's address carries its version", () => {
  assert.equal(sponsorLogoPath(7, new Date(1760000000000)), "/api/sponsors/7/logo?v=1760000000000");
});

test("a new sponsor needs a name and a logo; the link must be http(s), the message 80 characters at most", () => {
  const logo = {data: PNG.toString("base64"), width: 128, height: 128};
  assert.ok(SponsorCreateValidation.safeParse({name: "KSS Burger One", logo}).success);
  assert.ok(SponsorCreateValidation.safeParse({name: "KSS", url: "", message: "", background: "dark", logo}).success);
  assert.ok(SponsorCreateValidation.safeParse({name: "KSS", background: "none", logo}).success);
  assert.equal(SponsorCreateValidation.safeParse({name: "KSS", background: "light", logo}).success, false);
  const noLogo = SponsorCreateValidation.safeParse({name: "KSS"});
  assert.equal(noLogo.success, false);
  assert.equal(!noLogo.success && noLogo.error.issues[0].message, LOGO_REQUIRED);
  assert.equal(SponsorCreateValidation.safeParse({name: "  ", logo}).success, false);
  const script = SponsorCreateValidation.safeParse({name: "KSS", url: "javascript:alert(1)", logo});
  assert.equal(!script.success && script.error.issues[0].message, SPONSOR_URL_ERROR);
  assert.equal(SponsorCreateValidation.safeParse({name: "KSS", message: "x".repeat(81), logo}).success, false);
  assert.ok(SponsorCreateValidation.safeParse({name: "KSS", message: "x".repeat(80), logo}).success);
});

test("an edit sends only what changes, and something must change", () => {
  assert.ok(SponsorUpdateValidation.safeParse({background: "none"}).success);
  assert.ok(SponsorUpdateValidation.safeParse({url: null}).success);
  assert.equal(SponsorUpdateValidation.safeParse({}).success, false);
});

test("a league's sponsors are a list of different ids; a count names its league, kind and sponsors", () => {
  assert.ok(LeagueSponsorsValidation.safeParse({sponsor_ids: []}).success);
  assert.ok(LeagueSponsorsValidation.safeParse({sponsor_ids: [3, 1, 2]}).success);
  assert.equal(LeagueSponsorsValidation.safeParse({sponsor_ids: [1, 1]}).success, false);
  assert.equal(LeagueSponsorsValidation.safeParse({sponsor_ids: [0]}).success, false);
  assert.ok(SponsorEventValidation.safeParse({league_id: 3, kind: "view", sponsor_ids: [1, 2]}).success);
  assert.equal(SponsorEventValidation.safeParse({league_id: 3, kind: "like", sponsor_ids: [1]}).success, false);
  assert.equal(SponsorEventValidation.safeParse({league_id: 3, kind: "click", sponsor_ids: []}).success, false);
});

test("a logo's tile is as wide as its shape, from a square logo's to 1.9 : 1, with room around the logo", () => {
  assert.deepEqual(logoTile(60), {width: 114, height: 60, padY: 8, padX: 12, radius: 16});
  assert.deepEqual(logoTile(56), {width: 106, height: 56, padY: 8, padX: 11, radius: 15});
  assert.equal(logoTile(40).width, 76);
  // the three shapes the cropper makes: 512 × 246, 369 × 246 and 246 × 246
  assert.equal(logoTile(56, logoAspect({logo_width: 512, logo_height: 246})).width, 106);
  assert.equal(logoTile(56, logoAspect({logo_width: 369, logo_height: 246})).width, 83);
  assert.equal(logoTile(56, logoAspect({logo_width: 246, logo_height: 246})).width, 63);
  // older logos of any shape: never narrower than a square's tile or wider than the widest
  assert.equal(logoTile(56, 0.5).width, 63);
  assert.equal(logoTile(56, 5).width, 106);
  assert.equal(logoTile(56, NaN).width, 106);
  assert.equal(logoAspect({logo_width: 10, logo_height: 0}), CROP_ASPECT);
});

test("the counts read as the design writes them", () => {
  assert.equal(groupDigits(1210), "1 210");
  assert.equal(groupDigits(950), "950");
  assert.equal(countsLabel({views: 1210, clicks: 22}), "1 210 prikaza · 22 otvaranja");
  assert.equal(countsLabel({views: 1, clicks: 1}), "1 prikaz · 1 otvaranje");
  assert.equal(countsLabel(undefined), "0 prikaza · 0 otvaranja");
  assert.equal(countsLabel({views: 1958, clicks: 9}, true), "1 958 prikaza · 9 otv.");
});

test("the leagues, the picking list's line and the delete question", () => {
  const leagues = [
    {id: 1, name: "Liga Srijeda"},
    {id: 2, name: "Liga Utorak"},
  ];
  assert.equal(leaguesLabel(leagues), "Liga Srijeda · Liga Utorak");
  assert.equal(leaguesLabel(leagues, ", "), "Liga Srijeda, Liga Utorak");
  assert.equal(leaguesLabel([]), NO_LEAGUE);
  assert.equal(pickSub({leagues, message: "Domaćin lige", url: null}, 1), "Još u: Liga Utorak");
  assert.equal(pickSub({leagues: [leagues[0]], message: "10 % popusta", url: null}, 1), "10 % popusta");
  assert.equal(pickSub({leagues: [], message: "", url: "https://x.hr"}, 1), "link");
  assert.equal(sponsorSub({message: "", url: null}), "bez linka");
  assert.equal(
    deleteSponsorText("Macaklin Social Club", leagues),
    "Macaklin Social Club se briše s popisa sponzora i iz liga Liga Srijeda, Liga Utorak. Brojke prikaza i otvaranja se brišu."
  );
  assert.equal(deleteSponsorText("DH", [leagues[0]]), "DH se briše s popisa sponzora i iz lige Liga Srijeda. Brojke prikaza i otvaranja se brišu.");
  assert.equal(deleteSponsorText("DH", []), "DH se briše s popisa sponzora. Brojke prikaza i otvaranja se brišu.");
});

test("the band repeats its logos until a round fills it, and slides slowly", () => {
  assert.equal(bandRounds(1000, 448), 3);
  assert.equal(bandRounds(318, 448), 1);
  assert.equal(bandRounds(0, 448), 1);
  assert.equal(bandRounds(500, 0), 1);
  // 12 px a second
  assert.equal(bandSeconds(504), 42);
  assert.equal(bandSeconds(10), 8);
});

test("moveItem moves one row and leaves the rest in order", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b"], 1, 1), ["a", "b"]);
});

test("the crop frame is the inside of the logo's tile; the cropped logo is 246 px tall and as wide as its shape", () => {
  assert.ok(Math.abs(CROP_ASPECT - 1.5 / 0.72) < 1e-9);
  assert.equal(CROP_OUT_WIDTH, 512);
  assert.equal(CROP_OUT_HEIGHT, 246);
  assert.deepEqual(
    LOGO_SHAPES.map((s) => [s.key, s.label, s.width]),
    [
      ["wide", "Široki", 512],
      ["medium", "Srednji", 369],
      ["square", "Kvadrat", 246],
    ]
  );
  for (const s of LOGO_SHAPES) assert.ok(Math.abs(s.width / CROP_OUT_HEIGHT - s.aspect) < 0.01);
});

test("a logo is offered the shape nearest its own", () => {
  assert.equal(shapeFor(2.4), "wide");
  assert.equal(shapeFor(1.8), "wide");
  assert.equal(shapeFor(1.6), "medium");
  assert.equal(shapeFor(1.3), "medium");
  assert.equal(shapeFor(1), "square");
  assert.equal(shapeFor(0.6), "square");
  assert.equal(shapeFor(NaN), "wide");
});

// an image w × h of one colour (rgba), with a block of another from (x, y), bw × bh
function image(w: number, h: number, edge: number[], x: number, y: number, bw: number, bh: number, ink = [200, 30, 40, 255]) {
  const px: number[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px.push(...(i >= x && i < x + bw && j >= y && j < y + bh ? ink : edge));
  return px;
}

test("the empty edges are found on transparent and on one solid colour, and kept when there are none", () => {
  // a round badge in the middle of a transparent square
  assert.deepEqual(trimBox(image(20, 20, [0, 0, 0, 0], 5, 4, 10, 12), 20, 20), {x: 5, y: 4, w: 10, h: 12});
  // a logo on white, the white a little uneven (a JPEG)
  assert.deepEqual(trimBox(image(30, 10, [250, 252, 248, 255], 2, 1, 26, 8), 30, 10), {x: 2, y: 1, w: 26, h: 8});
  // nothing to take off: the logo reaches the edges
  assert.equal(trimBox(image(20, 20, [0, 0, 0, 0], 0, 0, 20, 20), 20, 20), null);
  // only edge: nothing to keep
  assert.equal(trimBox(image(20, 20, [255, 255, 255, 255], 0, 0, 0, 0), 20, 20), null);
  // corners that don't agree (a photo): left alone
  const photo = image(20, 20, [255, 255, 255, 255], 0, 0, 1, 1, [0, 0, 0, 255]);
  assert.equal(trimBox(photo, 20, 20), null);
});

test("at zoom 1 the whole logo fits the frame; a quarter turn swaps its sides", () => {
  // a square logo in a 208 × 100 frame: as tall as the frame
  assert.equal(fitScale(200, 200, 208, 100, 0), 0.5);
  // a wide logo: as wide as the frame
  assert.equal(fitScale(1000, 100, 208, 100, 0), 0.208);
  // turned, the wide logo stands up: as tall as the frame
  assert.equal(fitScale(1000, 100, 208, 100, 90), 0.1);
});

test("a logo smaller than the frame stays inside it; a larger one keeps filling it", () => {
  // square logo at zoom 1: 100 × 100 in a 208 × 100 frame, may slide 54 px left or right, not up or down
  const small = panLimits(200, 200, 208, 100, CROP_START);
  assert.ok(Math.abs(small.x - 54 / 208) < 1e-9);
  assert.equal(small.y, 0);
  // zoomed 3×: 300 × 300, may move 46 px sideways and 100 px up or down, always covering the frame
  const big = panLimits(200, 200, 208, 100, {...CROP_START, zoom: 3});
  assert.ok(Math.abs(big.x - 46 / 208) < 1e-9);
  assert.equal(big.y, 1);
  const clamped = clampCrop({zoom: 9, panX: 5, panY: -5, rotate: 0}, 200, 200, 208, 100);
  assert.equal(clamped.zoom, ZOOM_MAX);
  assert.ok(clamped.panX > 0 && clamped.panX <= 0.5);
  assert.ok(clamped.panY < 0 && clamped.panY >= -2);
  assert.deepEqual(clampCrop({zoom: 0.2, panX: 1, panY: 1, rotate: 0}, 200, 200, 208, 100), {zoom: 1, panX: 54 / 208, panY: 0, rotate: 0});
});

test("Okreni turns a quarter to the left and goes back to the middle; placement puts the logo where the pan says", () => {
  const turned = rotateLeft({zoom: 2, panX: 0.1, panY: 0.2, rotate: 0});
  assert.deepEqual(turned, {zoom: 2, panX: 0, panY: 0, rotate: 270});
  assert.equal(rotateLeft(rotateLeft(rotateLeft(turned))).rotate, 0);
  assert.deepEqual(placement(200, 200, 208, 100, {zoom: 1, panX: 0.25, panY: 0, rotate: 90}), {cx: 156, cy: 50, w: 100, h: 100, rotate: 90});
});
