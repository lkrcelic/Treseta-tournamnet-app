"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import AdminTonight from "@/app/_ui/admin/AdminTonight";
import DesktopHome from "@/app/_ui/home/DesktopHome";
import PhoneHome from "@/app/_ui/home/PhoneHome";
import useManagePhone from "@/app/_hooks/useManagePhone";

// Početna; an admin's phone opens on Večer lige instead (admin-mobile 01), unless they switched to "Prikaz igrača"
export default function Home() {
  const isDesktop = useIsDesktop();
  const adminPhone = useManagePhone("league.manage");
  if (isDesktop) return <DesktopHome />;
  return adminPhone ? <AdminTonight /> : <PhoneHome />;
}
