"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import SponsorsDesktop from "@/app/_ui/sponsors/SponsorsDesktop";
import SponsorsPhone from "@/app/_ui/sponsors/SponsorsPhone";
import {useEffect, useRef} from "react";
import useCan from "@/app/_hooks/useCan";

// Sponzori (admin): the one list of sponsors, under Admin in the computer's menu and the fifth tab of the admin's
// phone bar. Players are sent to Početna.
export default function SponsorsRoute() {
  const allowed = useCan("sponsor.manage");
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.user);
  const router = useTransitionRouter();
  // an old stored user may not say yet (can undefined): /api/auth/me fills it in
  const notAllowed = user != null && (user.can != null || user.is_admin != null) && !allowed;
  const left = useRef(false);
  useEffect(() => {
    if (!notAllowed || left.current) return;
    left.current = true;
    router.replace("/", "back");
  }, [notAllowed, router]);
  if (!allowed) return null;
  return isDesktop ? <SponsorsDesktop /> : <SponsorsPhone />;
}
