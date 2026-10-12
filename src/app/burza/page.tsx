"use client";

import useBurza from "@/app/_hooks/useBurza";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {BurzaKind} from "@/app/_interfaces/burza";
import {nightLabel} from "@/app/_lib/nights";
import {adCount, substituteNights, teamsLooking} from "@/app/_lib/ui/burza";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import {color, shadow} from "@/app/_styles/tokens";
import {buttonBase, Card, DesktopShell, EmptyState, ErrorNote, Screen, Segmented, tabPanelProps, TopBar} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {DateArrows, HeaderAction, KindPicker, LoadingCards, MyAdsButton, PostCard, rememberBurzaList} from "./ui/BurzaParts";

// Burza igrača (Claude Design "Burza igrača · spojeno"): every open ad, filtered by kind; substitute ads also by night.
// Public: anyone can read the ads and call. ?tab=zamjene|partneri|dostupni, &date=YYYY-MM-DD (Zamjene).

type Tab = "sve" | "zamjene" | "partneri" | "dostupni";
const TABS: {key: Tab; label: string; kind: BurzaKind | null}[] = [
  {key: "sve", label: "Sve", kind: null},
  {key: "zamjene", label: "Zamjene", kind: "SUBSTITUTE"},
  {key: "partneri", label: "Partneri", kind: "PARTNER"},
  {key: "dostupni", label: "Dostupni", kind: "AVAILABLE"},
];
const EMPTY: Record<Tab, string> = {
  sve: "Trenutno nema oglasa.",
  zamjene: "Nitko ne traži zamjenu.",
  partneri: "Nitko ne traži partnera.",
  dostupni: "Nitko se nije javio kao dostupan.",
};

export default function BurzaPage() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const params = useSearchParams();
  const {posts, error, reload} = useBurza();
  const loggedIn = useAuthStore((s) => s.user != null);
  const [picking, setPicking] = useState(false);
  const publishRef = useRef<HTMLButtonElement>(null);

  const tab: Tab = TABS.some((t) => t.key === params.get("tab")) ? (params.get("tab") as Tab) : "sve";
  const kind = TABS.find((t) => t.key === tab)!.kind;
  const nights = useMemo(() => substituteNights(posts ?? []), [posts]);
  // a night whose ads are gone falls back to every night
  const dateParam = params.get("date");
  const date = tab === "zamjene" && dateParam && nights.includes(dateParam) ? dateParam : null;

  const listHref = (next: Tab, nextDate: string | null = null) =>
    `/burza${next === "sve" ? "" : `?tab=${next}`}${next === "zamjene" && nextDate ? `&date=${nextDate}` : ""}`;
  const go = (next: Tab, nextDate: string | null = null) => router.router.replace(listHref(next, nextDate), {scroll: false});
  // an ad's back button returns to the list as it was
  const href = listHref(tab, date);
  useEffect(() => rememberBurzaList(href), [href]);

  const shown = (posts ?? []).filter((p) => (!kind || p.kind === kind) && (!date || p.night === date));
  const substitutes = (posts ?? []).filter((p) => p.kind === "SUBSTITUTE");
  const counts: Record<Tab, number> = {
    sve: posts?.length ?? 0,
    zamjene: substitutes.length,
    partneri: (posts ?? []).filter((p) => p.kind === "PARTNER").length,
    dostupni: (posts ?? []).filter((p) => p.kind === "AVAILABLE").length,
  };

  // the arrows step through "Svi datumi" and every night with a substitute ad
  const steps: (string | null)[] = [null, ...nights];
  const at = steps.indexOf(date);
  const dateArrows = tab === "zamjene" && (
    <DateArrows
      label={date ? nightLabel(date) : "Svi datumi"}
      count={teamsLooking(date ? substitutes.filter((p) => p.night === date).length : substitutes.length)}
      onPrev={at > 0 ? () => go("zamjene", steps[at - 1]) : null}
      onNext={at < steps.length - 1 ? () => go("zamjene", steps[at + 1]) : null}
      sx={isDesktop ? {width: 380} : undefined}
    />
  );

  const tabs = (
    <Segmented<Tab>
      items={TABS.map((t) => ({key: t.key, label: t.label, count: isDesktop && posts ? counts[t.key] : undefined}))}
      value={tab}
      onChange={(t) => go(t)}
      label="Vrsta oglasa"
      variant="track"
      size={isDesktop ? 44 : 42}
      idPrefix="burza"
      sx={isDesktop ? {width: 520} : undefined}
    />
  );

  const list = error && !posts ? (
    <ErrorNote onRetry={reload}>{error}</ErrorNote>
  ) : !posts ? (
    <LoadingCards />
  ) : shown.length === 0 ? (
    <Card>
      <EmptyState>{EMPTY[tab]}</EmptyState>
    </Card>
  ) : (
    shown.map((p) => <PostCard key={p.id} post={p} href={`/burza/${p.id}`} />)
  );

  const choose = (href: string) => {
    setPicking(false);
    router.push(href);
  };
  const picker = <KindPicker open={picking} onClose={() => setPicking(false)} onPick={choose} desktop={isDesktop} anchor={publishRef.current} />;
  // the player's open ads (the list has them all, marked mine); Burza is public, so only for a logged-in player
  const myAds = loggedIn && <MyAdsButton count={(posts ?? []).filter((p) => p.mine).length} height={isDesktop ? 52 : 44} />;

  if (isDesktop) {
    return (
      <DesktopShell
        active="burza"
        eyebrow={posts ? `Sve lige · ${adCount(posts.length)}` : "Sve lige"}
        title="Burza igrača"
        right={
          <>
            {myAds}
            <HeaderAction ref={publishRef} icon={<AddRoundedIcon />} onClick={() => setPicking(true)} open={picking}>
              Objavi
            </HeaderAction>
          </>
        }
      >
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap"}}>
          {tabs}
          {dateArrows}
        </Box>
        <Box
          {...tabPanelProps("burza", tab)}
          sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gridAutoRows: "max-content", alignContent: "start", gap: "16px", p: "2px", m: "-2px"}}
        >
          {list}
        </Box>
        {picker}
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <TopBar eyebrow="Sve lige" title="Burza" onBack={() => router.push("/", "back")} backLabel="Početna" backIcon={<HomeRoundedIcon />} right={myAds} />
      {tabs}
      {dateArrows}
      <Box
        {...tabPanelProps("burza", tab)}
        sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "12px", mx: "-20px", px: "20px", pt: "2px", pb: "90px", "& > *": {flexShrink: 0}}}
      >
        {list}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        sx={{
          ...buttonBase,
          position: "fixed",
          zIndex: 20,
          right: "max(20px, calc((100vw - 560px) / 2 + 20px))",
          bottom: "calc(24px + env(safe-area-inset-bottom))",
          height: 56,
          pl: "16px",
          pr: "22px",
          borderRadius: "28px",
          background: color.navy,
          color: color.white,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: 17,
          fontWeight: 600,
          boxShadow: shadow.fab,
          transition: "transform 120ms ease",
          "&:active": {transform: "scale(.97)"},
          "& svg": {fontSize: 26},
        }}
      >
        <AddRoundedIcon />
        Objavi
      </Box>
      {picker}
    </Screen>
  );
}
