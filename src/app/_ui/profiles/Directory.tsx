"use client";

import useAdminPlayers from "@/app/_hooks/useAdminPlayers";
import {useRestoredState, useScrollMemory} from "@/app/_hooks/useBackRestore";
import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useMoreFocus from "@/app/_hooks/useMoreFocus";
import useShortWindow from "@/app/_hooks/useShortWindow";
import useTeams from "@/app/_hooks/useTeams";
import type {AdminPlayerRow} from "@/app/_interfaces/player";
import {startNavStack} from "@/app/_lib/navStack";
import {
  directoryPage,
  directoryPages,
  DirectoryTeam,
  filterPlayers,
  filterTeams,
  nextAfterDelete,
  playerDirectorySub,
  teamDirectorySub,
} from "@/app/_lib/ui/directory";
import {teamInitial} from "@/app/_lib/ui/profiles";
import {NOUN, NounForms} from "@/app/_lib/ui/text";
import {pathOfHref, plainClick, TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {
  buttonBase,
  DesktopOnlyNote,
  DesktopShell,
  ellipsis,
  EmptyState,
  ErrorNote,
  ErrorState,
  InitialsAvatar,
  LoadingRows,
  LoadMoreButton,
  MessageState,
  PageSkeleton,
  rowFocus,
  scrollIntoMiddle,
  SearchInput,
  Tag,
} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {Box, useMediaQuery} from "@mui/material";
import {useParams, usePathname} from "next/navigation";
import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";
import {DirectoryFrame, DirectoryFrameContext, PLAYER_GRID, TEAM_GRID, useDirectoryFrame} from "./PageParts";

// The admin's Ekipe and Igrači (handoff §6 "Desktop admin", design 13h, 13j, Profiles P:153-169): on the desktop, a
// 290 px list of every team or player next to the page of the one picked. /teams and /teams/<id> share it (the list
// stays as it is, search and scroll, while the page beside it changes), as do /players and /players/<id>; Back to it
// from another page brings back its search, its pages and where it was scrolled. Anyone else, and an admin on the
// phone, gets the page alone.

type Kind = "teams" | "players";

// DirectoryFrame.nextAfterDelete, as the list beside the page answers it
type AfterDelete = (id: number) => number | null;

// A narrower window gives the page next to the list two columns instead of three (PageColumns)
const STACKED = "(max-width: 1359.98px)";

export function DirectoryLayout({kind, children}: {kind: Kind; children: React.ReactNode}) {
  const isDesktop = useIsDesktop();
  const isAdmin = useIsAdmin();
  if (!isDesktop || !isAdmin) return <>{children}</>;
  return <DirectoryShell kind={kind}>{children}</DirectoryShell>;
}

function DirectoryShell({kind, children}: {kind: Kind; children: React.ReactNode}) {
  const short = useShortWindow();
  const stacked = useMediaQuery(STACKED, {noSsr: true});
  const [leadSlot, setLeadSlot] = useState<HTMLElement | null>(null);
  const params = useParams<{teamId?: string; playerId?: string}>();
  const selectedId = Number(kind === "teams" ? params.teamId : params.playerId) || null;
  // the last team's (player's) page shown here: Nova ekipa's Escape goes back to it
  const pathname = usePathname();
  const [lastPage, setLastPage] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId != null) setLastPage(pathname);
  }, [selectedId, pathname]);
  // the list beside the page knows what it shows (its search)
  const afterDelete = useRef<AfterDelete>(() => null);
  const nextAfterDelete = useCallback((id: number) => afterDelete.current(id), []);
  const frame: DirectoryFrame = useMemo(() => ({stacked, leadSlot, lastPage, nextAfterDelete}), [stacked, leadSlot, lastPage, nextAfterDelete]);
  return (
    <DesktopShell
      active={kind}
      eyebrow="Admin"
      title={kind === "teams" ? "Ekipe" : "Igrači"}
      compact={short}
      // a page's back pill in a short window (DesktopFrame puts it here)
      lead={<Box ref={setLeadSlot} sx={{display: "contents"}} />}
    >
      <Box sx={{flex: 1, minHeight: 0, display: "flex", gap: "20px"}}>
        {kind === "teams" ? <TeamDirectory selectedId={selectedId} /> : <PlayerDirectory selectedId={selectedId} afterDelete={afterDelete} />}
        <DirectoryFrameContext.Provider value={frame}>{children}</DirectoryFrameContext.Provider>
      </Box>
    </DesktopShell>
  );
}

// ---------- /teams and /players ----------

// The directory's own address (/teams, /players): the first team or player of the list (Croatian name order) opens
// beside it, or `children` shows there (Nova ekipa). Someone who isn't an admin goes to Početna; an admin on the phone
// gets the "on the computer" note (handoff §2).
export function AdminIndex({kind, children}: {kind: Kind; children?: React.ReactNode}) {
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.user);
  const router = useTransitionRouter();
  const frame = useDirectoryFrame();
  // an old stored user may not say yet (is_admin undefined): /api/auth/me fills it in
  const notAdmin = user != null && user.is_admin === false;
  // once (a second navigation would cut the first one's transition short)
  const left = useRef(false);
  useEffect(() => {
    if (!notAdmin || left.current) return;
    left.current = true;
    router.replace("/", "back");
  }, [notAdmin, router]);
  if (notAdmin || user?.is_admin !== true) return null;
  if (!isDesktop) return <DesktopOnlyNote />;
  if (!frame) return null;
  if (children) return <>{children}</>;
  return kind === "teams" ? <FirstTeam /> : <FirstPlayer />;
}

function FirstTeam() {
  const {list, error, reload} = useTeams();
  const router = useTransitionRouter();
  return (
    <OpenFirst
      base="/teams"
      ids={list?.map((t) => t.id) ?? null}
      error={error}
      onRetry={reload}
      errorTitle="Ekipe se nisu učitale"
      template={TEAM_GRID}
      empty={
        <MessageState
          icon={<GroupsRoundedIcon />}
          title="Još nema ekipa"
          text="Napravi prvu ekipu."
          action={{label: "Nova ekipa", icon: <AddRoundedIcon />, onClick: () => router.replace("/teams?new=1", "morph")}}
        />
      }
    />
  );
}

function FirstPlayer() {
  const {list, error, reload} = useAdminPlayers();
  return (
    <OpenFirst
      base="/players"
      ids={list?.map((p) => p.id) ?? null}
      error={error}
      onRetry={reload}
      errorTitle="Igrači se nisu učitali"
      template={PLAYER_GRID}
      empty={<MessageState icon={<PersonRoundedIcon />} title="Još nema igrača" text="Pozovi ih poveznicom za registraciju." />}
    />
  );
}

// Opens the first of the list in its place once the list is in (the address then names it); placeholders until then
function OpenFirst({
  base,
  ids,
  error,
  onRetry,
  errorTitle,
  template,
  empty,
}: {
  base: string;
  ids: number[] | null;
  error: string | null;
  onRetry: () => void;
  errorTitle: string;
  template: string;
  empty: React.ReactNode;
}) {
  const router = useTransitionRouter();
  const first = ids?.[0] ?? null;
  const opened = useRef(false);
  useEffect(() => {
    if (first == null || opened.current) return;
    opened.current = true;
    router.replace(`${base}/${first}`, "morph");
  }, [first, base, router]);
  return (
    <Box sx={{flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: ids?.length === 0 || (error && !ids) ? "center" : undefined}}>
      {error && !ids ? <ErrorState title={errorTitle} onRetry={onRetry} /> : ids?.length === 0 ? empty : <PageSkeleton desktop template={template} />}
    </Box>
  );
}

// ---------- Ekipe ----------

function TeamDirectory({selectedId}: {selectedId: number | null}) {
  const {list, error, reload} = useTeams();
  const pathname = usePathname();
  const [query, setQuery] = useRestoredState("dir-teams-query", "");
  const visible = useMemo(() => (list ? filterTeams(list, query) : null), [list, query]);
  return (
    <DirectoryCard<DirectoryTeam>
      memory="dir-teams"
      title="Ekipe"
      total={list?.length ?? null}
      placeholder="Traži ekipe"
      query={query}
      onQuery={setQuery}
      rows={visible}
      error={error}
      onRetry={reload}
      noun={NOUN.ekipa}
      empty={query.trim() ? "Nijedna ekipa ne odgovara pretrazi." : "Još nema ekipa."}
      selectedId={selectedId}
      row={(t) => ({id: t.id, href: `/teams/${t.id}`, name: t.name, letters: teamInitial(t.name), sub: teamDirectorySub(t)})}
      footer={
        <Box
          component={TransitionLink}
          href="/teams?new=1"
          direction="morph"
          // a new team starts the page stack afresh, as picking a team does (Escape goes back to the team that was
          // open: DirectoryFrame.lastPage)
          onClick={(e: React.MouseEvent) => {
            if (plainClick(e)) startNavStack("/teams", pathname);
          }}
          sx={footerButton}
        >
          <AddRoundedIcon aria-hidden />
          Nova ekipa
        </Box>
      }
    />
  );
}

// ---------- Igrači ----------

// "Pozovi igrača" (not designed; plan Q12): a player needs an account before an admin can add them to a team, so the
// button copies a link for the admin to send. It is the login page: its Google login makes the account in one step (the
// better way in), and it still leads to the sign-up form.
const LOGIN_COPIED = "Poveznica za prijavu je kopirana.";

function PlayerDirectory({selectedId, afterDelete}: {selectedId: number | null; afterDelete: React.MutableRefObject<AfterDelete>}) {
  const {list, error, reload} = useAdminPlayers();
  const [query, setQuery] = useRestoredState("dir-players-query", "");
  const visible = useMemo(() => (list ? filterPlayers(list, query) : null), [list, query]);
  // a player deleted in "Uredi osobne podatke": the next one this list shows opens in its place, so the page and the
  // selected row stay together; a search that shows no other player is cleared
  useEffect(() => {
    afterDelete.current = (id) => {
      const {next, clearSearch} = nextAfterDelete(list ?? [], query.trim() ? visible : null, id);
      if (clearSearch) setQuery("");
      return next;
    };
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const invite = async () => {
    const link = `${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice({text: LOGIN_COPIED, done: true});
    } catch {
      // no clipboard (an insecure origin, a refused permission): the link to copy by hand
      setNotice({text: `Poveznica za prijavu: ${link}`, done: false});
    }
  };

  return (
    <DirectoryCard<AdminPlayerRow>
      memory="dir-players"
      title="Igrači"
      total={list?.length ?? null}
      placeholder="Traži igrače"
      query={query}
      onQuery={setQuery}
      rows={visible}
      error={error}
      onRetry={reload}
      noun={NOUN.igrač}
      empty={query.trim() ? "Nijedan igrač ne odgovara pretrazi." : "Još nema igrača."}
      selectedId={selectedId}
      row={(p) => ({id: p.id, href: `/players/${p.id}`, name: p.name, sub: playerDirectorySub(p), inactive: !p.active})}
      notice={notice}
      footer={
        <Box component="button" type="button" onClick={invite} sx={footerButton}>
          <AddRoundedIcon aria-hidden />
          Pozovi igrača
        </Box>
      }
    />
  );
}

// ---------- the card ----------

// a line over the footer button for a few seconds (Pozovi igrača); done: it worked (a tick), else a link icon
type Notice = {text: string; done: boolean};

type RowData = {id: number; href: string; name: string; letters?: string; sub: string; inactive?: boolean};

const footerButton = {
  ...buttonBase,
  width: "100%",
  height: 46,
  boxSizing: "border-box",
  border: `1.5px solid ${color.borderControl}`,
  borderRadius: "12px",
  background: color.white,
  color: color.navy,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  fontSize: 15,
  fontWeight: 600,
  textDecoration: "none",
  transition: "background 150ms ease",
  "&:hover": {background: color.paper},
  "& svg": {fontSize: 20},
} as const;

// The directory's card (P:153-169): the title and how many there are, the search, the rows (12 at a time, "Učitaj
// još"; the selected one is always shown, with half a page after it, and scrolled into view when the page is opened
// by a link) and the footer button. memory: the name its pages and scroll are kept under for Back.
function DirectoryCard<T>({
  memory,
  title,
  total,
  placeholder,
  query,
  onQuery,
  rows,
  error,
  onRetry,
  noun,
  empty,
  selectedId,
  row,
  footer,
  notice,
}: {
  memory: string;
  title: string;
  total: number | null;
  placeholder: string;
  query: string;
  onQuery: (q: string) => void;
  rows: T[] | null;
  error: string | null;
  onRetry: () => void;
  noun: NounForms;
  empty: string;
  selectedId: number | null;
  row: (item: T) => RowData;
  footer: React.ReactNode;
  notice?: Notice | null;
}) {
  const titleId = useId();
  const [asked, setPages] = useRestoredState(`${memory}-pages`, 1);
  // a new search starts again from the first page (not the first render: Back brings the pages back)
  const searched = useRef(query);
  useEffect(() => {
    if (searched.current === query) return;
    searched.current = query;
    setPages(1);
  }, [query, setPages]);
  const data = rows?.map(row) ?? null;
  const selectedAt = data && selectedId != null ? data.findIndex((r) => r.id === selectedId) : -1;
  // the selected row may need more pages than asked for; they stay when another row is picked
  const pages = directoryPages(asked, selectedAt);
  useEffect(() => {
    if (pages > asked) setPages(pages);
  }, [pages, asked, setPages]);
  const {shown, left} = data ? directoryPage(data, pages) : {shown: [], left: 0};

  // Back to the page puts the list where it was; otherwise the selected row is scrolled into view once it is there (a
  // page opened from a link, not from the list)
  const scroller = useScrollMemory(`${memory}-list`);
  const more = useMoreFocus(scroller.element, ":scope > li", shown.length, () => setPages(pages + 1));
  const scrolledTo = useRef<number | null>(null);
  const hasSelected = selectedAt >= 0;
  useEffect(() => {
    if (!hasSelected || selectedId == null || scrolledTo.current === selectedId) return;
    scrolledTo.current = selectedId;
    if (scroller.restored()) return;
    const box = scroller.element();
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !el) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) scrollIntoMiddle(el, box);
  }, [hasSelected, selectedId, scroller]);

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{
        width: 290,
        flex: "none",
        minHeight: 0,
        background: color.white,
        borderRadius: "24px",
        boxShadow: shadow.card,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{flex: "none", p: "18px 16px 10px", display: "flex", flexDirection: "column", gap: "10px"}}>
        <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px"}}>
          <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800, letterSpacing: "-.01em"}}>
            {title}
          </Box>
          {total != null && (
            <Box component="span" sx={{fontSize: 13, fontWeight: 600, color: color.muted, fontVariantNumeric: "tabular-nums"}}>
              {total}
            </Box>
          )}
        </Box>
        <SearchInput
          variant="paper"
          height={44}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onClear={() => onQuery("")}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
          sx={{"& input::placeholder": {color: color.muted}}}
        />
      </Box>
      <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
        {error && !data ? (
          <ErrorNote onRetry={onRetry} sx={{m: "4px 12px"}}>
            {error}
          </ErrorNote>
        ) : !data ? (
          <LoadingRows rows={8} height={56} sx={{px: "8px", "& > *": {borderBottom: "none"}}} />
        ) : data.length === 0 ? (
          <EmptyState sx={{py: "28px", fontSize: 14}}>{empty}</EmptyState>
        ) : (
          <Box
            component="ul"
            ref={scroller.ref}
            aria-label={title}
            sx={{listStyle: "none", m: 0, p: "0 8px 8px", flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column"}}
          >
            {shown.map((r) => (
              <DirectoryRow key={r.id} row={r} selected={r.id === selectedId} />
            ))}
            {left > 0 && (
              <Box component="li" sx={{pt: "6px", flex: "none"}}>
                <LoadMoreButton left={left} noun={noun} onClick={more} sx={{borderRadius: "14px"}} />
              </Box>
            )}
          </Box>
        )}
      </Box>
      <Box sx={{flex: "none", p: "10px 16px 16px", borderTop: `1px solid ${color.line}`}}>
        {/* over the button, so it covers no row of the list */}
        <Box
          role="status"
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1.35,
            color: color.ink2,
            overflowWrap: "anywhere",
            "&:not(:empty)": {mb: "10px"},
            "& svg": {flex: "none", fontSize: 18, mt: "-0.5px"},
          }}
        >
          {notice && (
            <>
              {notice.done ? <CheckCircleRoundedIcon aria-hidden sx={{color: color.green}} /> : <LinkRoundedIcon aria-hidden sx={{color: color.navy}} />}
              <span>{notice.text}</span>
            </>
          )}
        </Box>
        {footer}
      </Box>
    </Box>
  );
}

// One team or player: a link to their page. Picking one starts the page stack afresh (it is a root, like a nav drawer
// item: no Back pill), and the page beside the list crossfades instead of sliding.
function DirectoryRow({row, selected}: {row: RowData; selected: boolean}) {
  const pathname = usePathname();
  return (
    <Box component="li" sx={{flex: "none"}}>
      <Box
        component={TransitionLink}
        href={row.href}
        direction="morph"
        aria-current={selected ? "page" : undefined}
        onClick={(e: React.MouseEvent) => {
          if (plainClick(e)) startNavStack(pathOfHref(row.href), pathname);
        }}
        sx={{
          ...buttonBase,
          minHeight: 56,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          p: "6px 10px",
          borderRadius: "14px",
          background: selected ? color.paper : "transparent",
          boxShadow: selected ? `inset 0 0 0 1.5px ${tint.navy[25]}` : undefined,
          color: color.ink,
          textAlign: "left",
          textDecoration: "none",
          transition: "background 150ms ease",
          "&:hover": {background: color.paper},
          "&:focus-visible": rowFocus,
        }}
      >
        <InitialsAvatar name={row.name} letters={row.letters} size={36} variant={selected ? "navy" : "paper"} />
        <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
          <Box component="span" sx={{fontSize: 15, fontWeight: selected ? 700 : 600, ...ellipsis}}>
            {row.name}
          </Box>
          <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", minWidth: 0}}>
            {row.inactive && <Tag variant="inactive" size="row" />}
            <Box component="span" sx={{minWidth: 0, fontSize: 12.5, color: color.muted, ...ellipsis}}>
              {row.sub}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
