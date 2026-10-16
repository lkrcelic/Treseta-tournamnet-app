"use client";

import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import SponsorsDesktop from "@/app/_ui/sponsors/SponsorsDesktop";
import SponsorsPhone from "@/app/_ui/sponsors/SponsorsPhone";
import {useEffect, useRef} from "react";

// Sponzori (admin): the one list of sponsors, under Admin in the computer's menu and the fifth tab of the admin's
// phone bar. Players are sent to Početna.
export default function SponsorsRoute() {
  const isAdmin = useIsAdmin();
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.user);
  const router = useTransitionRouter();
  // an old stored user may not say yet (is_admin undefined): /api/auth/me fills it in
  const notAdmin = user != null && user.is_admin === false;
  const left = useRef(false);
  useEffect(() => {
    if (!notAdmin || left.current) return;
    left.current = true;
    router.replace("/", "back");
  }, [notAdmin, router]);
  if (!isAdmin) return null;
  return isDesktop ? <SponsorsDesktop /> : <SponsorsPhone />;
}
