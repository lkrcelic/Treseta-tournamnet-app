"use client";

import useAdminPlayers from "@/app/_hooks/useAdminPlayers";
import {useRestoredState, useScrollMemory} from "@/app/_hooks/useBackRestore";
import useTeams from "@/app/_hooks/useTeams";
import {DIRECTORY_PAGE, filterPlayers, filterTeams} from "@/app/_lib/ui/directory";
import {teamInitial} from "@/app/_lib/ui/profiles";
import {count, NOUN, NounForms} from "@/app/_lib/ui/text";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ellipsis, EmptyState, ErrorState, IconCircleButton, InitialsAvatar, LoadingRows, LoadMoreButton, Screen, SearchInput, SuccessNote} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import {Box} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import {AdminTabBar, AdminTab} from "./AdminTabBar";

// src: the photo for the avatar
type Row = {id: number; href: string; name: string; letters?: string; src?: string | null; sub: string; tag?: "admin" | "inactive"};

// Ekipe and Igrači on the admin's phone (admin-mobile 31, 34): every team or player with a search, 12 at a time
// ("Učitaj još"), each opening its page. The search and the scroll come back with Back.
function DirectoryPhone({
  tab,
  eyebrow,
  title,
  memory,
  placeholder,
  rows,
  error,
  errorTitle,
  onRetry,
  noun,
  empty,
  action,
  notice,
}: {
  tab: AdminTab;
  eyebrow: string;
  title: string;
  memory: string;
  placeholder: string;
  // null while loading; the rows of the search (query) are made by the caller from `query`
  rows: (query: string) => Row[] | null;
  error: string | null;
  errorTitle: string;
  onRetry: () => void;
  noun: NounForms;
  empty: (searching: boolean) => string;
  action: React.ReactNode;
  notice?: React.ReactNode;
}) {
  const [query, setQuery] = useRestoredState(`${memory}-query`, "");
  const [pages, setPages] = useRestoredState(`${memory}-pages`, 1);
  const scroller = useScrollMemory(memory);
  const all = rows(query);
  const shown = all ? all.slice(0, pages * DIRECTORY_PAGE) : null;
  const left = all && shown ? all.length - shown.length : 0;

  return (
    <Screen fill gap={14}>
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>{eyebrow}</Box>
          <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em"}}>
            {title}
          </Box>
        </Box>
        {action}
      </Box>
      <SearchInput
        variant="white"
        height={52}
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPages(1);
        }}
        onClear={() => {
          setQuery("");
          setPages(1);
        }}
      />
      {notice}
      <Box ref={shown ? scroller.ref : undefined} sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", mx: "-20px", px: "20px", pb: "4px"}}>
        {error && !all ? (
          <ErrorState title={errorTitle} onRetry={onRetry} />
        ) : !shown ? (
          <Box sx={{background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
            <LoadingRows rows={8} height={68} />
          </Box>
        ) : shown.length === 0 ? (
          <EmptyState>{empty(query.trim() !== "")}</EmptyState>
        ) : (
          <Box sx={{background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
            <Box component="ul" aria-label={title} sx={{listStyle: "none", m: 0, p: 0}}>
              {shown.map((r, i) => (
                <Box component="li" key={r.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                  <Box
                    component={TransitionLink}
                    href={r.href}
                    sx={{...buttonBase, minHeight: 68, display: "flex", alignItems: "center", gap: "12px", p: "10px 10px 10px 16px", textAlign: "left", textDecoration: "none", color: color.ink, opacity: r.tag === "inactive" ? 0.6 : 1, "&:active": {background: color.paper2}}}
                  >
                    <InitialsAvatar name={r.name} letters={r.letters} src={r.src} size={40} variant="paper" />
                    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                      <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                        {r.name}
                      </Box>
                      <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                        {r.sub}
                      </Box>
                    </Box>
                    {r.tag && (
                      <Box
                        component="span"
                        sx={{flex: "none", height: 24, display: "flex", alignItems: "center", px: "8px", borderRadius: "8px", fontSize: 12, fontWeight: 700, ...(r.tag === "admin" ? {background: color.navy, color: color.white} : {background: tint.red[12], color: color.red})}}
                      >
                        {r.tag === "admin" ? "Admin" : "Neaktivan"}
                      </Box>
                    )}
                    <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy}} />
                  </Box>
                </Box>
              ))}
            </Box>
            {left > 0 && <LoadMoreButton left={left} noun={noun} onClick={() => setPages(pages + 1)} />}
          </Box>
        )}
      </Box>
      <AdminTabBar active={tab} />
    </Screen>
  );
}

// Ekipe (31): "2 igrača · Liga Utorak, Liga Četvrtak", + makes a new team
export function TeamsDirectoryPhone() {
  const router = useTransitionRouter();
  const {list, error, reload} = useTeams();
  const rows = (query: string): Row[] | null =>
    list
      ? filterTeams(list, query).map((t) => ({
          id: t.id,
          href: `/teams/${t.id}`,
          name: t.name,
          letters: teamInitial(t.name),
          src: t.photo_url,
          sub: `${count(t.players.length, NOUN.igrač)} · ${t.leagues.length ? t.leagues.map((l) => l.name).join(", ") : "bez lige"}`,
        }))
      : null;
  return (
    <DirectoryPhone
      tab="ekipe"
      eyebrow="Sve lige"
      title="Ekipe"
      memory="phone-teams"
      placeholder="Traži ekipu ili igrača"
      rows={rows}
      error={error}
      errorTitle="Ekipe se nisu učitale"
      onRetry={reload}
      noun={NOUN.ekipa}
      empty={(searching) => (searching ? "Nijedna ekipa ne odgovara pretrazi." : "Još nema ekipa.")}
      action={
        <IconCircleButton label="Nova ekipa" onClick={() => router.push("/teams?new=1")}>
          <AddRoundedIcon />
        </IconCircleButton>
      }
    />
  );
}

// "Pozovi igrača" (as on the desktop): a player needs an account before they can be added to a team, so the link to
// the login page (its Google login makes the account) is copied for the admin to send
const LOGIN_COPIED = "Poveznica za prijavu je kopirana.";

// Igrači (34): "Dalmatinci · rejting 1712", the Admin and Neaktivan tags
export function PlayersDirectoryPhone() {
  const {list, error, reload} = useAdminPlayers();
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);
  const invite = async () => {
    const link = `${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice(LOGIN_COPIED);
    } catch {
      setNotice(`Poveznica za prijavu: ${link}`);
    }
  };
  const rows = useMemo(
    () =>
      (query: string): Row[] | null =>
        list
          ? filterPlayers(list, query).map((p) => {
              const teams = p.teams.map((t) => t.team_name).join(", ");
              return {
                id: p.id,
                href: `/players/${p.id}`,
                name: p.name,
                src: p.photo_url,
                sub: [teams || `@${p.username}`, p.rating != null ? `rejting ${p.rating}` : null].filter(Boolean).join(" · "),
                tag: !p.active ? ("inactive" as const) : p.admin ? ("admin" as const) : undefined,
              };
            })
          : null,
    [list]
  );
  return (
    <DirectoryPhone
      tab="igraci"
      eyebrow="Svi igrači"
      title="Igrači"
      memory="phone-players"
      placeholder="Traži igrača"
      rows={rows}
      error={error}
      errorTitle="Igrači se nisu učitali"
      onRetry={reload}
      noun={NOUN.igrač}
      empty={(searching) => (searching ? "Nijedan igrač ne odgovara pretrazi." : "Još nema igrača.")}
      action={
        <IconCircleButton label="Pozovi igrača: kopiraj poveznicu za prijavu" onClick={invite}>
          <LinkRoundedIcon />
        </IconCircleButton>
      }
      notice={notice && <SuccessNote>{notice}</SuccessNote>}
    />
  );
}
