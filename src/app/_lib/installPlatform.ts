// Which install flow the sheet offers, from the user agent. Samsung Internet is told apart from Chrome: on a Galaxy
// its own install has Samsung's server build an app package that targets an old Android, and Play Protect blocks it
// ("Nesigurna aplikacija blokirana · napravljena za stariju verziju Androida"). Nothing in the manifest changes that
// package, so Samsung Internet is sent to Chrome, whose package Google builds and the Play Store installs. Drop the
// detour once https://github.com/SamsungInternet/support/issues/123 is fixed.

export type InstallPlatform = "android" | "samsung" | "ios" | "other";

export function detectPlatform(ua: string, maxTouchPoints: number): InstallPlatform {
  // iPadOS reports itself as a Mac; a touch screen tells them apart
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return "ios";
  // before Android, as Samsung's user agent also says Android and Chrome. Its desktop mode (the default on big Galaxy
  // tablets) says Linux instead and stays "other", like Chrome's desktop mode there, which would offer no install.
  if (/SamsungBrowser\//.test(ua) && /Android/.test(ua)) return "samsung";
  if (/Android/.test(ua)) return "android";
  return "other";
}

// where the intent goes when Chrome is missing or disabled (a Galaxy can disable Chrome, not remove it)
const CHROME_ON_PLAY = "https://play.google.com/store/apps/details?id=com.android.chrome";

// An Android intent link that opens the same address in Chrome. Browsers follow it only from a tap, and Samsung
// Internet may first ask which browser to open it with.
export function chromeIntentUrl(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(CHROME_ON_PLAY)};end`;
}
