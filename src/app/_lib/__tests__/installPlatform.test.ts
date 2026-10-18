import assert from "node:assert/strict";
import {test} from "node:test";
import {chromeIntentUrl, detectInstallEnv, installEnvLabel, type InstallEnv} from "../installPlatform";

const SAMSUNG = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/136.0.0.0 Mobile Safari/537.36";
const SAMSUNG_DESKTOP_MODE = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/136.0.0.0 Safari/537.36";
const SAMSUNG_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Safari/537.36";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1";
const IPHONE_EDGE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/140.3485.94 Mobile/15E148 Safari/605.1.15";
const IPHONE_FIREFOX = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.38.105 (iPhone15,2; iOS 18_5; hr_HR; hr; scale=3.00; 1179x2556; 812345678)";
const IPHONE_FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.40.107;FBBV/123456789;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/hr_HR;FBOP/5]";
const IPHONE_GOOGLE_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/385.0.789012345 Mobile/15E148 Safari/604.1";
const IPHONE_OPERA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 OPT/5.4.0";

const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0";
const ANDROID_EDGE = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.3485.81";
const ANDROID_OPERA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 OPR/91.0.4516.77959";
const ANDROID_XIAOMI = "Mozilla/5.0 (Linux; U; Android 14; hr-hr; 23090RA98G Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.119 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.32.1-gn";
const ANDROID_INSTAGRAM = "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.51 Mobile Safari/537.36 Instagram 400.0.0.40.80 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; hr_HR; 812345678)";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.51 Mobile Safari/537.36";

const env = (os: InstallEnv["os"], browser: InstallEnv["browser"]): InstallEnv => ({os, browser});

test("Samsung Internet is told apart from Chrome, though its user agent also says Android and Chrome", () => {
  assert.deepEqual(detectInstallEnv(SAMSUNG, 5), env("android", "samsung"));
  assert.deepEqual(detectInstallEnv(CHROME_ANDROID, 5), env("android", "chrome"));
});

test("Samsung Internet without Android in its user agent gets no Chrome detour", () => {
  // desktop mode on a Galaxy tablet: Chrome there sends a desktop user agent too and would show no install
  assert.equal(detectInstallEnv(SAMSUNG_DESKTOP_MODE, 5).os, "other");
  assert.equal(detectInstallEnv(SAMSUNG_WINDOWS, 10).os, "other");
});

test("iPhone and iPad, which reports itself as a Mac", () => {
  assert.deepEqual(detectInstallEnv(IPHONE, 5), env("ios", "safari"));
  assert.deepEqual(detectInstallEnv(MAC, 5), env("ios", "safari"));
  assert.equal(detectInstallEnv(MAC, 0).os, "other");
});

test("browsers on the iPhone, each with Share in its own place", () => {
  assert.deepEqual(detectInstallEnv(IPHONE_CHROME, 5), env("ios", "chrome"));
  assert.deepEqual(detectInstallEnv(IPHONE_EDGE, 5), env("ios", "edge"));
  assert.deepEqual(detectInstallEnv(IPHONE_FIREFOX, 5), env("ios", "firefox"));
  assert.deepEqual(detectInstallEnv(IPHONE_OPERA, 5), env("ios", "unknown"));
});

test("browsers inside apps, which can't install", () => {
  assert.deepEqual(detectInstallEnv(IPHONE_INSTAGRAM, 5), env("ios", "inapp"));
  assert.deepEqual(detectInstallEnv(IPHONE_FACEBOOK, 5), env("ios", "inapp"));
  assert.deepEqual(detectInstallEnv(IPHONE_GOOGLE_APP, 5), env("ios", "inapp"));
  assert.deepEqual(detectInstallEnv(ANDROID_INSTAGRAM, 5), env("android", "inapp"));
  assert.deepEqual(detectInstallEnv(ANDROID_WEBVIEW, 5), env("android", "inapp"));
});

test("browsers on Android", () => {
  assert.deepEqual(detectInstallEnv(ANDROID_FIREFOX, 5), env("android", "firefox"));
  assert.deepEqual(detectInstallEnv(ANDROID_EDGE, 5), env("android", "edge"));
  assert.deepEqual(detectInstallEnv(ANDROID_OPERA, 5), env("android", "opera"));
  assert.deepEqual(detectInstallEnv(ANDROID_XIAOMI, 5), env("android", "opera"));
});

test("the tag names the phone and the browser, and the other Android browsers by their own name", () => {
  assert.equal(installEnvLabel(detectInstallEnv(IPHONE_CHROME, 5), IPHONE_CHROME), "iPhone · Chrome");
  assert.equal(installEnvLabel(detectInstallEnv(SAMSUNG, 5), SAMSUNG), "Android · Samsung Internet");
  assert.equal(installEnvLabel(detectInstallEnv(ANDROID_OPERA, 5), ANDROID_OPERA), "Android · Opera");
  assert.equal(installEnvLabel(detectInstallEnv(ANDROID_XIAOMI, 5), ANDROID_XIAOMI), "Android · Mi Browser");
  assert.equal(installEnvLabel(detectInstallEnv(ANDROID_INSTAGRAM, 5), ANDROID_INSTAGRAM), "Preglednik u aplikaciji");
  assert.equal(installEnvLabel(detectInstallEnv(IPHONE_OPERA, 5), IPHONE_OPERA), "Nepoznat preglednik");
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
