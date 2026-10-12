"use client";

import {
  labelNavEntry,
  NavStack,
  NavStackControls,
  previewNavStack,
  previous,
  readNavStack,
  serverNavStack,
  subscribeNavStack,
} from "@/app/_lib/navStack";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {usePathname} from "next/navigation";
import {useCallback, useEffect, useMemo, useSyncExternalStore} from "react";

// A page in the page stack (_lib/navStack.ts). `label` is the page's own name, shown on the next page's back pill
// (null while it loads); `fallback` is where Back goes when the page was opened directly (a shared link).
export default function useNavStack(label: string | null | undefined, fallback = "/"): NavStackControls {
  const pathname = usePathname();
  const router = useTransitionRouter();
  const stored = useSyncExternalStore(subscribeNavStack, readNavStack, serverNavStack);
  // the page renders before <RouteTransitions /> records the navigation that brought it here: until then, count it in
  const stack: NavStack = useMemo(() => previewNavStack(stored, pathname), [stored, pathname]);

  useEffect(() => {
    if (label) labelNavEntry(pathname, label);
  }, [pathname, label]);

  const prev = previous(stack);
  const canGoBack = prev != null;
  const back = useCallback(() => {
    if (canGoBack) router.back();
    else router.push(fallback, "back");
  }, [canGoBack, router, fallback]);
  // Početna is a root of the stack once it is on screen (recordNavigation)
  const home = useCallback(() => router.push("/", "back"), [router]);

  return {canGoBack, previousLabel: prev?.label ?? null, back, home};
}
