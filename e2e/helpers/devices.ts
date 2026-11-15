// The two screens the app supports (CLAUDE.md): a phone in portrait and a computer. No landscape.
import {devices} from "@playwright/test";

const zagreb = {locale: "hr-HR", timezoneId: "Europe/Zagreb"} as const;

export const PHONE = {
  ...zagreb,
  viewport: {width: 390, height: 844},
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
};

export const DESKTOP = {...zagreb, viewport: {width: 1440, height: 900}};
