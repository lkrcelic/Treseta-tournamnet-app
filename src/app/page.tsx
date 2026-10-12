"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import DesktopHome from "@/app/_ui/home/DesktopHome";
import PhoneHome from "@/app/_ui/home/PhoneHome";

export default function Home() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopHome /> : <PhoneHome />;
}
