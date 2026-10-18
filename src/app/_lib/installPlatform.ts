// Which install flow the sheet offers, from the user agent: the OS, and the browser, since each puts "Add to Home
// Screen" in a different place (Chrome on the iPhone under Share in the address bar, Safari under ••• below the page,
// Firefox and Edge on Android in a menu at the bottom). Browsers inside apps (Instagram, Facebook…) can't install at
// all and send the page to a real browser.
//
// Samsung Internet is told apart from Chrome: on a Galaxy its own install has Samsung's server build an app package
// that targets an old Android, and Play Protect blocks it ("Nesigurna aplikacija blokirana · napravljena za stariju
// verziju Androida"). Nothing in the manifest changes that package, so Samsung Internet is sent to Chrome, whose
// package Google builds and the Play Store installs. Drop the detour once
// https://github.com/SamsungInternet/support/issues/123 is fixed.

export type InstallOs = "ios" | "android" | "other";
export type InstallBrowser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "opera" | "inapp" | "unknown";
export type InstallEnv = {os: InstallOs; browser: InstallBrowser};

// in-app browsers by their own token; Android's WebView by "; wv)"
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|MessengerForiOS|Line\/|Snapchat|musical_ly|BytedanceWebview|LinkedInApp|Viber|WhatsApp|GSA\//;
// Android browsers that don't follow Chrome's menu: "opera" stands for all of them (the sheet calls them by name)
const OTHER_ANDROID: [RegExp, string][] = [
  [/OPR\/|OPX\//, "Opera"],
  [/MiuiBrowser\//, "Mi Browser"],
  [/HuaweiBrowser\//, "Huawei Browser"],
  [/HeyTapBrowser\//, "HeyTap"],
  [/YaBrowser\//, "Yandex"],
  [/UCBrowser\//, "UC Browser"],
  [/Vivaldi\//, "Vivaldi"],
];

export function detectInstallEnv(ua: string, maxTouchPoints: number): InstallEnv {
  // iPadOS reports itself as a Mac; a touch screen tells them apart. Samsung's desktop mode (the default on big Galaxy
  // tablets) says Linux instead of Android and stays "other", like Chrome's desktop mode there, which offers no install.
  const os: InstallOs = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1) ? "ios" : /Android/.test(ua) ? "android" : "other";
  return {os, browser: detectBrowser(ua, os)};
}

function detectBrowser(ua: string, os: InstallOs): InstallBrowser {
  if (IN_APP.test(ua) || (os === "android" && /; wv\)/.test(ua))) return "inapp";
  if (os === "ios") {
    if (/CriOS\//.test(ua)) return "chrome";
    if (/EdgiOS\//.test(ua)) return "edge";
    if (/FxiOS\//.test(ua)) return "firefox";
    if (/OPiOS\/|OPT\/|DuckDuckGo|Ddg\//.test(ua)) return "unknown";
    // Brave and a few others send Safari's user agent: Share works there too, the arrow may just miss it
    return "safari";
  }
  // before Chrome, as Samsung's user agent also says Chrome
  if (/SamsungBrowser\//.test(ua)) return "samsung";
  if (/EdgA\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua) && !/Chrome\//.test(ua)) return "firefox";
  if (OTHER_ANDROID.some(([re]) => re.test(ua))) return "opera";
  // Brave sends Chrome's user agent and gets the install button like Chrome
  if (/Chrome\//.test(ua)) return "chrome";
  return "unknown";
}

const OS_NAME: Record<InstallOs, string> = {ios: "iPhone", android: "Android", other: ""};
const BROWSER_NAME: Record<Exclude<InstallBrowser, "opera" | "inapp" | "unknown">, string> = {
  safari: "Safari",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  samsung: "Samsung Internet",
};

// The tag under the sheet's title: "iPhone · Chrome", "Android · Mi Browser", "Preglednik u aplikaciji"…
export function installEnvLabel(env: InstallEnv, ua: string): string {
  if (env.browser === "inapp") return "Preglednik u aplikaciji";
  if (env.browser === "unknown") return "Nepoznat preglednik";
  const name = env.browser === "opera" ? (OTHER_ANDROID.find(([re]) => re.test(ua))?.[1] ?? "Opera") : BROWSER_NAME[env.browser];
  return `${OS_NAME[env.os]} · ${name}`;
}

// where the intent goes when Chrome is missing or disabled (a Galaxy can disable Chrome, not remove it)
const CHROME_ON_PLAY = "https://play.google.com/store/apps/details?id=com.android.chrome";

// An Android intent link that opens the same address in Chrome. Browsers follow it only from a tap, and Samsung
// Internet may first ask which browser to open it with.
export function chromeIntentUrl(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(CHROME_ON_PLAY)};end`;
}
