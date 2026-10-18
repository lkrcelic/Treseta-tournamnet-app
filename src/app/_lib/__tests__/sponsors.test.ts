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
import {bandRounds, bandSeconds, countsLabel, deleteSponsorText, groupDigits, leaguesLabel, logoTile, moveItem, NO_LEAGUE, pickSub, sponsorSub} from "../ui/sponsors";

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
  assert.equal(SponsorCreateValidation.safeParse({name: "KSS", background: "grey", logo}).success, false);
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
  assert.ok(SponsorUpdateValidation.safeParse({background: "light"}).success);
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

test("every logo's tile is the same rounded rectangle, 1.9 : 1, with room around the logo", () => {
  assert.deepEqual(logoTile(60), {width: 114, height: 60, padY: 8, padX: 12, radius: 16});
  assert.deepEqual(logoTile(56), {width: 106, height: 56, padY: 8, padX: 11, radius: 15});
  assert.equal(logoTile(40).width, 76);
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
