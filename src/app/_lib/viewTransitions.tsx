"use client";

// Route transitions with the View Transitions API (Chrome, Edge, Safari 18+). Browsers without it navigate normally.
//
// document.startViewTransition takes a snapshot, runs the update and animates to the new state once the update's
// promise resolves. A Next.js navigation is asynchronous, so the promise resolves when <RouteTransitions /> (in the
// root layout) sees the new pathname committed — or after a short timeout, so a slow route never freezes the page.
//
// Directions (set on <html data-nav> for the CSS in theme.ts):
//   forward  new page slides in from the right, the old one drifts left
//   back     the reverse
//   morph    elements with the same view-transition-name morph (Start Game card -> scoreboard), the rest crossfades

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import React, {useCallback, useLayoutEffect, useMemo} from "react";

export type NavDirection = "forward" | "back" | "morph";

type ViewTransition = {finished: Promise<void>};
type DocumentWithVT = Document & {startViewTransition?: (update: () => Promise<void>) => ViewTransition};

let pendingCommit: (() => void) | null = null;

export function viewTransitionsSupported(): boolean {
  return typeof document !== "undefined" && typeof (document as DocumentWithVT).startViewTransition === "function";
}

// The direction of the transition running right now, if any (pages use it to skip their own CSS entry animation)
export function activeNavDirection(): NavDirection | null {
  if (typeof document === "undefined") return null;
  return (document.documentElement.dataset.nav as NavDirection) || null;
}

export function navigateWithTransition(navigate: () => void, direction: NavDirection) {
  const doc = document as DocumentWithVT;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!viewTransitionsSupported() || reduce) {
    navigate();
    return;
  }
  // a second navigation while one is animating just goes through
  if (pendingCommit) {
    pendingCommit();
    pendingCommit = null;
  }

  document.documentElement.dataset.nav = direction;
  const transition = doc.startViewTransition!(
    () =>
      new Promise<void>((resolve) => {
        const timeout = window.setTimeout(done, 1500);
        function done() {
          window.clearTimeout(timeout);
          if (pendingCommit === done) pendingCommit = null;
          resolve();
        }
        pendingCommit = done;
        navigate();
      })
  );
  transition.finished.finally(() => {
    if (document.documentElement.dataset.nav === direction) delete document.documentElement.dataset.nav;
  });
}

// Mounted once in the root layout: tells a running transition that the new route is on screen
export function RouteTransitions() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    pendingCommit?.();
  }, [pathname]);
  return null;
}

// useRouter with transitions: push/replace default to "forward", back to "back"
export function useTransitionRouter() {
  const router = useRouter();
  const push = useCallback(
    (href: string, direction: NavDirection = "forward") => navigateWithTransition(() => router.push(href), direction),
    [router]
  );
  const replace = useCallback(
    (href: string, direction: NavDirection = "forward") => navigateWithTransition(() => router.replace(href), direction),
    [router]
  );
  const back = useCallback(() => navigateWithTransition(() => router.back(), "back"), [router]);
  return useMemo(() => ({push, replace, back, router}), [push, replace, back, router]);
}

// next/link that animates the navigation (modified clicks — new tab etc. — behave as usual)
export const TransitionLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<typeof Link> & {direction?: NavDirection}
>(function TransitionLink({direction = "forward", onClick, href, ...rest}, ref) {
  const {push} = useTransitionRouter();
  return (
    <Link
      ref={ref}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        push(String(href), direction);
      }}
      {...rest}
    />
  );
});
