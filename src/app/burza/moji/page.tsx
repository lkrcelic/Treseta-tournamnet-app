"use client";

import {closeBurzaPostAPI, repostBurzaPostAPI} from "@/app/_fetchers/burza";
import {invalidateBurza} from "@/app/_hooks/useBurza";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useMyBurza from "@/app/_hooks/useMyBurza";
import {MyBurzaPost} from "@/app/_interfaces/burza";
import {leagueDateString} from "@/app/_lib/dates";
import {MyPostChange, myTabLabel, repostFormHref, repostOpensForm} from "@/app/_lib/ui/burza";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {DesktopShell, ErrorNote, PrimaryButton, Screen, Segmented, tabPanelProps, TopBar, visuallyHidden} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useEffect, useRef, useState} from "react";
import {burzaFeedHref, HeaderAction, KindPicker, rememberBurzaList} from "../ui/BurzaParts";
import {MyPostCard, MyPostSkeletons, MyPostsEmpty, postActions} from "../ui/MyPosts";

// Moji oglasi (Claude Design "Burza igrača · spojeno", 11c): the player's own ads, Aktivni and Prošli (?tab=prosli).
// An active ad can be looked at or closed, a past one published again. Needs a login (the middleware sends
// /burza/moji to the login page).

type Tab = "aktivni" | "prosli";

const href = (t: Tab) => `/burza/moji${t === "prosli" ? "?tab=prosli" : ""}`;

export default function MyBurzaPage() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "prosli" ? "prosli" : "aktivni";
  const {list, error, reload, update} = useMyBurza();
  // what was just done to an ad here: its line says "Zatvoren upravo" / "Objavljeno ponovno" / "Već imaš ovakav oglas"
  const [changes, setChanges] = useState<Record<number, MyPostChange>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<{id: number; message: string} | null>(null);
  // read out after an action, and where the keyboard goes once the card has moved: the actions of an ad, or a tab
  const [announce, setAnnounce] = useState("");
  const [focus, setFocus] = useState<{post: number} | {tab: Tab} | null>(null);
  const [picking, setPicking] = useState(false);
  const newRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const today = leagueDateString();

  const go = (t: Tab) => router.router.replace(href(t), {scroll: false});
  // an ad's page and a new ad's form come back here, to this tab
  useEffect(() => rememberBurzaList(href(tab)), [tab]);
  // each tab opens at its top, where a card that has just moved there is
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [tab]);
  // once the card or tab is on the page (a card moved to the other tab is there after the tab has switched)
  useEffect(() => {
    if (!focus) return;
    const target = "post" in focus ? postActions(focus.post) : document.getElementById(`moji-tab-${focus.tab}`);
    if (!target) return;
    target.focus();
    setFocus(null);
  }, [focus, list, tab]);

  const close = async (p: MyBurzaPost) => {
    if (busy != null || !list) return;
    setBusy(p.id);
    setActionError(null);
    try {
      await closeBurzaPostAPI(p.id);
      invalidateBurza();
      const closed: MyBurzaPost = {...p, status: "CLOSED", closed: true, can_close: false, closed_at: new Date().toISOString()};
      // the keyboard goes on to the ad that takes its place (or the one before it), or to Prošli when none is left
      const rest = list.active.filter((x) => x.id !== p.id);
      const at = Math.min(list.active.findIndex((x) => x.id === p.id), rest.length - 1);
      update((l) => ({active: l.active.filter((x) => x.id !== p.id), past: [closed, ...l.past.filter((x) => x.id !== p.id)]}));
      setChanges((c) => ({...c, [p.id]: "closed"}));
      setAnnounce("Oglas je zatvoren.");
      setFocus(at >= 0 ? {post: rest[at].id} : {tab: "prosli"});
    } catch (e) {
      setActionError({id: p.id, message: e instanceof Error ? e.message : "Oglas nije zatvoren."});
    }
    setBusy(null);
  };

  const repost = async (p: MyBurzaPost) => {
    if (busy != null) return;
    // its night is gone (or it has no phone number): the form, filled in from the ad, picks a new one; publishing
    // there leaves the new ad in Aktivni, so that is where the form comes back to
    if (repostOpensForm(p)) {
      rememberBurzaList(href("aktivni"));
      router.push(repostFormHref(p));
      return;
    }
    setBusy(p.id);
    setActionError(null);
    try {
      // the ad that is up now: this one, or an open ad like it (shown on top with "Već imaš ovakav oglas")
      const up = await repostBurzaPostAPI(p.id);
      invalidateBurza();
      update((l) => ({active: [up, ...l.active.filter((x) => x.id !== up.id)], past: l.past.filter((x) => x.id !== up.id)}));
      const same = up.id === p.id;
      setChanges((c) => ({...c, [up.id]: same ? "reposted" : "already"}));
      setAnnounce(same ? "Oglas je ponovno objavljen." : "Već imaš ovakav oglas.");
      setFocus({post: up.id});
      go("aktivni");
    } catch (e) {
      setActionError({id: p.id, message: e instanceof Error ? e.message : "Oglas nije ponovno objavljen."});
    }
    setBusy(null);
  };

  const choose = (to: string) => {
    setPicking(false);
    router.push(to);
  };

  const shown = list ? (tab === "prosli" ? list.past : list.active) : [];
  const tabs = (
    <Segmented<Tab>
      items={[
        {key: "aktivni", label: list ? myTabLabel("active", list.active.length) : "Aktivni"},
        {key: "prosli", label: list ? myTabLabel("past", list.past.length) : "Prošli"},
      ]}
      value={tab}
      onChange={go}
      label="Moji oglasi"
      variant="track"
      size={44}
      idPrefix="moji"
      sx={{"& > button": {fontSize: 15}, ...(isDesktop ? {width: 360} : {})}}
    />
  );

  const content =
    error && !list ? (
      // the whole row of the desktop grid
      <Box sx={{gridColumn: "1 / -1"}}>
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      </Box>
    ) : !list ? (
      <MyPostSkeletons />
    ) : shown.length === 0 ? (
      <Box sx={{gridColumn: "1 / -1"}}>
        <MyPostsEmpty past={tab === "prosli"} />
      </Box>
    ) : (
      shown.map((p) => (
        <MyPostCard
          key={p.id}
          post={p}
          today={today}
          change={changes[p.id]}
          busy={busy === p.id}
          error={actionError?.id === p.id ? actionError.message : null}
          onClose={() => close(p)}
          onRepost={() => repost(p)}
        />
      ))
    );

  const picker = <KindPicker open={picking} onClose={() => setPicking(false)} onPick={choose} desktop={isDesktop} anchor={newRef.current} />;
  const live = (
    <Box role="status" aria-live="polite" sx={visuallyHidden}>
      {announce}
    </Box>
  );

  if (isDesktop) {
    return (
      <DesktopShell
        active="burza"
        back={{label: "Burza", href: burzaFeedHref()}}
        eyebrow="Burza"
        title="Moji oglasi"
        right={
          <HeaderAction ref={newRef} icon={<AddRoundedIcon />} onClick={() => setPicking(true)} open={picking}>
            Novi oglas
          </HeaderAction>
        }
      >
        {tabs}
        <Box
          ref={panelRef}
          {...tabPanelProps("moji", tab)}
          sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gridAutoRows: "max-content", alignContent: "start", gap: "16px", p: "2px", m: "-2px"}}
        >
          {content}
        </Box>
        {live}
        {picker}
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <TopBar eyebrow="Burza" title="Moji oglasi" onBack={() => router.push(burzaFeedHref(), "back")} />
      {tabs}
      <Box
        ref={panelRef}
        {...tabPanelProps("moji", tab)}
        sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "12px", mx: "-20px", px: "20px", pt: "2px", pb: "4px", "& > *": {flexShrink: 0}}}
      >
        {content}
      </Box>
      <PrimaryButton icon={<AddRoundedIcon />} onClick={() => setPicking(true)} aria-haspopup="dialog">
        Novi oglas
      </PrimaryButton>
      {live}
      {picker}
    </Screen>
  );
}
