"use client";

import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useOpenTable from "@/app/_hooks/useOpenTable";
import DesktopHome from "@/app/_ui/home/DesktopHome";
import PhoneHome from "@/app/_ui/home/PhoneHome";

export default function Home() {
  const isDesktop = useIsDesktop();
  const isAdmin = useIsAdmin();
  const {table, loading} = useOpenTable();

  if (isDesktop) return <DesktopHome />;
  return <PhoneHome isAdmin={isAdmin} openTable={table} openTableLoading={loading} />;
}
