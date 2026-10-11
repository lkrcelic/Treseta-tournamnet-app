import assert from "node:assert/strict";
import {test} from "node:test";
import {chromeIntentUrl, detectPlatform} from "../installPlatform";

const SAMSUNG = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/136.0.0.0 Mobile Safari/537.36";
const SAMSUNG_DESKTOP_MODE = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/136.0.0.0 Safari/537.36";
const SAMSUNG_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Safari/537.36";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

test("Samsung Internet is told apart from Chrome, though its user agent also says Android and Chrome", () => {
  assert.equal(detectPlatform(SAMSUNG, 5), "samsung");
  assert.equal(detectPlatform(CHROME_ANDROID, 5), "android");
});

test("Samsung Internet without Android in its user agent gets no Chrome detour", () => {
  // desktop mode on a Galaxy tablet: Chrome there sends a desktop user agent too and would show no install
  assert.equal(detectPlatform(SAMSUNG_DESKTOP_MODE, 5), "other");
  assert.equal(detectPlatform(SAMSUNG_WINDOWS, 10), "other");
});

test("iPhone and iPad, which reports itself as a Mac", () => {
  assert.equal(detectPlatform(IPHONE, 5), "ios");
  assert.equal(detectPlatform(MAC, 5), "ios");
  assert.equal(detectPlatform(MAC, 0), "other");
});

test("the Chrome intent keeps the address and falls back to Chrome on the Play Store", () => {
  assert.equal(
    chromeIntentUrl("https://bela-liga.vercel.app/login"),
    "intent://bela-liga.vercel.app/login#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.android.chrome;end"
  );
  assert.equal(
    chromeIntentUrl("http://localhost:3000/login?next=%2F"),
    "intent://localhost:3000/login?next=%2F#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.android.chrome;end"
  );
});
