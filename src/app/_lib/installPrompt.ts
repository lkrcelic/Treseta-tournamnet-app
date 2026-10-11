"use client";

import {detectPlatform, type InstallPlatform} from "@/app/_lib/installPlatform";
import {useEffect, useState, useSyncExternalStore} from "react";

// Installing the app from the browser (the manifest is in public/). Chrome on Android announces that it can install
// with "beforeinstallprompt"; the event can come before any page has mounted, so it is caught as soon as this module
// loads (the root layout imports it) and kept until the install sheet uses it. Safari has no such event: there the
// sheet lists the steps. Samsung Internet may fire it too, but the sheet never prompts there, since Play Protect blocks
// what Samsung's install builds; it sends the page to Chrome instead (installPlatform.ts).

type InstallPromptEvent = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: "accepted" | "dismissed"}>};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // our sheet asks instead of Chrome's own mini bar
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Opened from the home screen (or already installed), so there is nothing to offer
function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;
}

export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred != null, () => false);
  const justInstalled = useSyncExternalStore(subscribe, () => installed, () => false);
  const [env, setEnv] = useState<{platform: InstallPlatform; standalone: boolean} | null>(null);
  useEffect(() => setEnv({platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints), standalone: isStandalone()}), []);

  // Chrome's own install dialog; resolves true when the user accepted it
  const prompt = async (): Promise<boolean> => {
    const e = deferred;
    if (!e) return false;
    deferred = null; // an event can prompt only once
    notify();
    await e.prompt();
    const {outcome} = await e.userChoice;
    if (outcome === "accepted") {
      installed = true;
      notify();
    }
    return outcome === "accepted";
  };

  return {platform: env?.platform ?? null, standalone: env?.standalone ?? true, canPrompt, installed: justInstalled, prompt};
}
