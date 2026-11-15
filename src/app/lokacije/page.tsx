"use client";

import useCan from "@/app/_hooks/useCan";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import LocationsDesktop from "@/app/_ui/locations/LocationsDesktop";
import LocationsPhone from "@/app/_ui/locations/LocationsPhone";
import {useEffect, useRef} from "react";

// Lokacije (admin): the one list of places, under Admin in the computer's menu and behind "Sve lokacije" of a place
// picker (the phone's bottom bar is full). Anyone else is sent to Početna.
export default function LocationsRoute() {
  const allowed = useCan("location.manage");
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
  return isDesktop ? <LocationsDesktop /> : <LocationsPhone />;
}
