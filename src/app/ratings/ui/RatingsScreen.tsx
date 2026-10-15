"use client";

import useAdminPhone from "@/app/_hooks/useAdminPhone";
import {AdminTabBar} from "@/app/_ui/admin/AdminTabBar";
import {getPlayerRatingAPI} from "@/app/_fetchers/ratings";
import {type ScrollMemory, useRestoredState, useScrollMemory} from "@/app/_hooks/useBackRestore";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useMoreFocus from "@/app/_hooks/useMoreFocus";
import useNavStack from "@/app/_hooks/useNavStack";
import useRatings from "@/app/_hooks/useRatings";
import useShortWindow from "@/app/_hooks/useShortWindow";
import {PlayerRatingDetail, RatingRow} from "@/app/_interfaces/ratings";
import type {NavStackControls} from "@/app/_lib/navStack";
import {formatChange, RATING_COLUMNS, ratingIdFromPath, ratingPath, roundsLabel, visibleRatings} from "@/app/_lib/ui/ratings";
import {NOUN} from "@/app/_lib/ui/text";
import {replaceAddress, TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, ease, font, shadow, tint} from "@/app/_styles/tokens";
import {
  BackPill,
  buttonBase,
  Card,
  changeInk,
  DesktopShell,
  ellipsis,
  ErrorState,
  IconCircleButton,
  LoadMoreButton,
  MessageState,
  NARROW_DESKTOP,
  PrimaryButton,
  ProvisionalTag,
  Screen,
  scrollIntoMiddle,
  SearchInput,
  tabular,
} from "@/app/_ui/sp";
import {PhoneFrame} from "@/app/_ui/profiles/PageParts";
import {DetailSkeleton, infoTitle, InfoView, LastNights, NoRoundsCard, PlayerCard, RankDot, RatingChartCard, RatingSkeletonRows, RatingsInfo} from "./RatingParts";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import {Box, Drawer, Popover, Tooltip} from "@mui/material";
import {usePathname} from "next/navigation";
import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";

// Rejting igrača (Claude Design 8a–8m): one list across all leagues, highest rating first, 50 players at a time
// ("Učitaj još"). On the phone a row opens the player's detail (its own page); on the desktop the detail sits next to
// the list and the picked player is in the address (/ratings/<id>), so a reload or a shared link shows the same one.
// The (i) button explains every column, and on the desktop each column header has a tooltip too. The detail's cream
// card opens the player's page; a rating opened from a Player page goes back to it (the phone's Back, the desktop's
// back pill).

const EYEBROW = "Svi igrači · sve lige";

export default function RatingsScreen({playerId}: {playerId?: number}) {
  const isDesktop = useIsDesktop();
  // a Player page opened from the rating card says "‹ Rejting"; a detail opened from outside the app goes back to the list
  const nav = useNavStack("Rejting", "/ratings");
  const pathname = usePathname();
  // the player in the address: the desktop's pick changes it without a navigation, so it can differ from the route's
  const shownId = ratingIdFromPath(pathname) ?? playerId ?? null;
  const {list, error, reload} = useRatings();
  // the search and how many pages are open come back with Back to the list; a new search starts at the first page
  const [query, keepQuery] = useRestoredState("ratings-query", "");
  const [pages, setPages] = useRestoredState("ratings-pages", 1);
  const setQuery = useCallback(
    (q: string) => {
      keepQuery(q);
      setPages(1);
    },
    [keepQuery, setPages]
  );
  const me = list?.me ?? null;
  // the first page reaches my own row and, on the desktop, the player the page was opened for (a picked row is on screen
  // already), so both are there without "Učitaj još"
  const visible = useMemo(() => (list ? visibleRatings(list.players, query, pages, [me, isDesktop ? playerId : null]) : null), [list, query, pages, me, isDesktop, playerId]);
  const paging = {visible, query, setQuery, onMore: () => setPages(pages + 1)};

  if (isDesktop) return <DesktopRatings all={list?.players ?? null} me={me} {...paging} error={error} reload={reload} shownId={shownId} initial={playerId} nav={nav} />;
  if (shownId != null) return <PhoneDetail playerId={shownId} nav={nav} />;
  return <PhoneList all={list?.players ?? null} me={me} {...paging} error={error} reload={reload} />;
}

function usePlayerRating(playerId: number | null) {
  const [detail, setDetail] = useState<PlayerRatingDetail | null>(null);
  // the id that answered "no such player" (a deleted player, or a wrong link)
  const [missing, setMissing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the player asked for last: a late answer for one picked before (the desktop list, picked quickly) is dropped, so it
  // never replaces the detail of the player picked after it
  const asked = useRef<number | null>(null);
  const load = useCallback(async () => {
    asked.current = playerId;
    if (playerId == null) return;
    setError(null);
    try {
      const found = await getPlayerRatingAPI(playerId);
      if (asked.current !== playerId) return;
      if (found) setDetail(found);
      else setMissing(playerId);
    } catch (e) {
      if (asked.current !== playerId) return;
      setError(e instanceof Error ? e.message : "Rejting igrača nije moguće učitati.");
    }
  }, [playerId]);
  useEffect(() => {
    load();
  }, [load]);
  // the detail of another player stays on screen until the new one arrives, but never shows under the wrong name
  return {detail: detail && detail.player.id === playerId ? detail : null, missing: playerId != null && missing === playerId, error, reload: load};
}

// Empty list, no search match, the list didn't load (8g, 8h), or a rating link to a player who isn't there (a deleted
// player: Q9, DECISIONS #40). onCard: inside a card; the phone detail shows it on the paper background.
function ListMessage({kind, onRetry, onCard = true}: {kind: "empty" | "noMatch" | "error" | "notFound"; onRetry?: () => void; onCard?: boolean}) {
  if (kind === "error") return <ErrorState onCard={onCard} title="Rejting se nije učitao" onRetry={onRetry} />;
  const m = {
    empty: {icon: <LeaderboardRoundedIcon />, title: "Još nema rejtinga", text: "Rejting se pojavi kad se odigra prvo kolo."},
    noMatch: {icon: <PersonSearchRoundedIcon />, title: "Nema takvog igrača", text: "Provjeri kako si napisao ime."},
    notFound: {icon: <PersonOffRoundedIcon />, title: "Igrač ne postoji", text: "Možda je obrisan ili je poveznica pogrešna."},
  }[kind];
  return <MessageState onCard={onCard} icon={m.icon} title={m.title} text={m.text} />;
}

type ListProps = {
  // the whole list (null while it loads) and what of it is shown
  all: RatingRow[] | null;
  visible: ReturnType<typeof visibleRatings> | null;
  me: number | null;
  error: string | null;
  reload: () => void;
  query: string;
  setQuery: (q: string) => void;
  onMore: () => void;
};

// a new search shows its first matches: the list goes back to the top
function useSearch(setQuery: (q: string) => void, scroller: ScrollMemory) {
  return useCallback(
    (q: string) => {
      setQuery(q);
      const box = scroller.element();
      if (box) box.scrollTop = 0;
    },
    [setQuery, scroller]
  );
}

// ---------- phone ----------

function PhoneList({all, visible, me, error, reload, query, setQuery, onMore}: ListProps) {
  const router = useTransitionRouter();
  const adminPhone = useAdminPhone();
  const [info, setInfo] = useState<InfoView | null>(null);
  // Back from a player's detail finds the list where it was left
  const scroller = useScrollMemory("ratings");
  const search = useSearch(setQuery, scroller);
  const more = useMoreFocus(scroller.element, "ol > li", visible?.shown.length ?? 0, onMore);

  let body: React.ReactNode;
  if (error && !all) body = <ListMessage kind="error" onRetry={reload} />;
  else if (!all || !visible) body = <RatingSkeletonRows rows={8} height={62} />;
  else if (all.length === 0) body = <ListMessage kind="empty" />;
  else if (visible.shown.length === 0) body = <ListMessage kind="noMatch" />;
  else
    body = (
      <>
        <Box component="ol" aria-label="Rejting igrača" sx={{listStyle: "none", m: 0, p: 0}}>
          {visible.shown.map((p) => (
            <Box component="li" key={p.id}>
              <PhoneRow player={p} me={p.id === me} />
            </Box>
          ))}
        </Box>
        {visible.left > 0 && <LoadMoreButton left={visible.left} noun={NOUN.igrač} onClick={more} />}
      </>
    );

  return (
    <Screen fill gap={12}>
      <Box component="header" sx={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>{EYEBROW}</Box>
          <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em"}}>
            Rejting
          </Box>
        </Box>
        <IconCircleButton label="Što znače stupci?" size={44} onClick={() => setInfo("cols")}>
          <InfoOutlinedIcon />
        </IconCircleButton>
      </Box>
      <SearchInput variant="white" height={48} placeholder="Traži igrača" aria-label="Traži igrača" value={query} onChange={(e) => search(e.target.value)} onClear={() => search("")} />
      <Card ref={all ? scroller.ref : undefined} sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", borderRadius: "22px"}}>
        <Box aria-hidden sx={{position: "sticky", top: 0, zIndex: 3, background: color.white, height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", pl: "14px", pr: "16px", borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}>
          <span>#&nbsp;&nbsp;&nbsp;Igrač</span>
          <span>Rejting</span>
        </Box>
        {body}
      </Card>
      {/* the admin's phone has its bottom bar here instead (admin-mobile 30) */}
      {adminPhone ? (
        <AdminTabBar active="rejting" />
      ) : (
        <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
          Početni zaslon
        </PrimaryButton>
      )}
      <InfoSheet view={info} onChange={setInfo} />
    </Screen>
  );
}

function PhoneRow({player: p, me}: {player: RatingRow; me: boolean}) {
  return (
    <Box
      component={TransitionLink}
      href={ratingPath(p.id)}
      aria-current={me ? "true" : undefined}
      sx={{
        ...buttonBase,
        display: "grid",
        gridTemplateColumns: "30px minmax(0,1fr) auto",
        columnGap: "10px",
        rowGap: "1px",
        alignItems: "center",
        p: "9px 16px 9px 12px",
        borderBottom: `1px solid ${color.line}`,
        background: me ? color.cream2 : "transparent",
        boxShadow: me ? shadow.mineBar : "none",
        textDecoration: "none",
        textAlign: "left",
        color: color.ink,
        "&:active": {background: me ? color.cream2 : color.lineFill},
      }}
    >
      <Box sx={{gridRow: "1 / span 2"}}>
        <RankDot rank={p.rank} />
      </Box>
      <Box sx={{minWidth: 0, fontSize: 16, fontWeight: me ? 700 : 600, ...ellipsis}}>{p.name}</Box>
      <Box sx={{textAlign: "right", fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.05, ...tabular}}>{p.rating}</Box>
      <Box sx={{minWidth: 0, display: "flex", gap: "5px", fontSize: 12.5, color: color.muted, whiteSpace: "nowrap", ...tabular}}>
        {p.team && (
          <>
            <Box component="span" sx={{minWidth: 0, overflow: "hidden", textOverflow: "ellipsis"}}>
              {p.team}
            </Box>
            <span aria-hidden>·</span>
          </>
        )}
        <Box component="span" sx={{flex: "none"}}>
          {roundsLabel(p.rounds)}
        </Box>
        <span aria-hidden>·</span>
        <Box component="span" sx={{flex: "none", fontWeight: 700, color: changeInk(p.change)}}>
          {formatChange(p.rounds ? p.change : null)}
        </Box>
      </Box>
      <Box sx={{justifySelf: "end", minHeight: 18}}>{p.provisional && <ProvisionalTag />}</Box>
    </Box>
  );
}

// 8b / 8d: the column explanations and how the rating works, in a bottom sheet
function InfoSheet({view, onChange}: {view: InfoView | null; onChange: (view: InfoView | null) => void}) {
  const titleId = useId();
  // keep the last view while the sheet slides out
  const shown = useRef<InfoView>("cols");
  if (view) shown.current = view;
  return (
    <Drawer
      anchor="bottom"
      open={view != null}
      onClose={() => onChange(null)}
      transitionDuration={{enter: 240, exit: 200}}
      SlideProps={{easing: {enter: ease, exit: "cubic-bezier(.4,0,.6,1)"}}}
      slotProps={{backdrop: {sx: {background: tint.scrim[42]}}}}
      PaperProps={{
        role: "dialog",
        "aria-labelledby": titleId,
        sx: {maxWidth: 560, mx: "auto", maxHeight: "88%", borderRadius: "28px 28px 0 0", background: color.white, p: "10px 20px calc(24px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.sheet},
      }}
    >
      <Box aria-hidden sx={{alignSelf: "center", width: 36, height: 5, borderRadius: "3px", background: color.hairline}} />
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
        <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em"}}>
          {infoTitle(shown.current)}
        </Box>
        <IconCircleButton label="Zatvori" size={44} onClick={() => onChange(null)} sx={{background: color.paper, boxShadow: "none"}}>
          <CloseRoundedIcon />
        </IconCircleButton>
      </Box>
      <RatingsInfo view={shown.current} onSwitch={onChange} />
    </Drawer>
  );
}

// The phone detail: Back to wherever it was opened from (the list, a Player page, Moj profil; the list itself when it
// was opened from outside the app, so Back is always there), "REJTING" and Home
function PhoneDetail({playerId, nav}: {playerId: number; nav: NavStackControls}) {
  const {detail, missing, error, reload} = usePlayerRating(playerId);
  let body: React.ReactNode;
  if (missing) body = <ListMessage kind="notFound" onCard={false} />;
  else if (error && !detail) body = <ListMessage kind="error" onRetry={reload} onCard={false} />;
  else body = detail ? <DetailBody detail={detail} chartWidth={318} /> : <DetailSkeleton />;
  return (
    <PhoneFrame eyebrow="Rejting" nav={{...nav, canGoBack: true}}>
      {body}
    </PhoneFrame>
  );
}

function DetailBody({detail, chartWidth, desktop = false}: {detail: PlayerRatingDetail; chartWidth: number; desktop?: boolean}) {
  return (
    <>
      <PlayerCard detail={detail} desktop={desktop} />
      {detail.history.length > 0 ? (
        <>
          <RatingChartCard detail={detail} width={chartWidth} desktop={desktop} />
          {detail.lastNights.length > 0 && <LastNights detail={detail} desktop={desktop} />}
        </>
      ) : (
        <NoRoundsCard desktop={desktop} />
      )}
    </>
  );
}

// ---------- desktop ----------

// the table's columns: grid widths and where each header's tooltip opens. Under 1280 px wide (1024×640) the detail
// column is narrower and so are the number columns, and Privremeno moves to the line under the name, so the names
// keep room (at 1024 px the wide columns left the Igrač column 2 px).
const deskGrid = {gridTemplateColumns: "64px minmax(0,1fr) 190px 120px 100px", [NARROW_DESKTOP]: {gridTemplateColumns: "44px minmax(0,1fr) 92px 96px 64px", columnGap: "10px"}} as const;
const wideOnly = {[NARROW_DESKTOP]: {display: "none"}} as const;
const narrowOnly = {display: "none", [NARROW_DESKTOP]: {display: "inline-flex"}} as const;
const HEADS: {key: string; align: "start" | "end"}[] = [
  {key: "#", align: "start"},
  {key: "Igrač", align: "start"},
  {key: "Rejting", align: "end"},
  {key: "Promjena", align: "end"},
  {key: "Kola", align: "end"},
];

function DesktopRatings({
  all,
  visible,
  me,
  error,
  reload,
  query,
  setQuery,
  onMore,
  shownId,
  initial,
  nav,
}: ListProps & {shownId: number | null; initial?: number; nav: NavStackControls}) {
  // the player in the address, else me, else the first; picking a row puts it in the address (no navigation: the list
  // keeps its search and scroll, Back from the Player page opened from the detail returns to that player)
  const selected = shownId ?? me ?? all?.[0]?.id ?? null;
  const {detail, missing, error: detailError, reload: reloadDetail} = usePlayerRating(selected);
  const scroller = useScrollMemory("ratings");
  const search = useSearch(setQuery, scroller);
  const more = useMoreFocus(scroller.element, "ol > li", visible?.shown.length ?? 0, onMore);
  // a short window: the back pill goes up into the header row (as on the Team and Player pages)
  const short = useShortWindow();
  // the row the page opens on, next to its detail: the player of a /ratings/<id> address (the Player page's rating),
  // else my own row. In the middle of the list, once, when the list is first shown (a pick in the list changes only the
  // address, not `initial`; Back brings the list's own scroll back instead)
  const opened = useRef<number | null | undefined>(undefined);
  const rows = visible?.shown;
  useEffect(() => {
    const box = scroller.element();
    if (!box || !rows || opened.current === (initial ?? null)) return;
    opened.current = initial ?? null;
    const row = box.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (row && !scroller.restored()) scrollIntoMiddle(row, box);
  }, [initial, rows, scroller]);
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const [infoView, setInfoView] = useState<InfoView>("cols");
  const infoId = useId();

  let list: React.ReactNode;
  if (error && !all) list = <ListMessage kind="error" onRetry={reload} />;
  else if (!all || !visible) list = <RatingSkeletonRows rows={10} height={60} grid={deskGrid} />;
  else if (all.length === 0) list = <ListMessage kind="empty" />;
  else if (visible.shown.length === 0) list = <Box sx={{p: "48px", textAlign: "center", fontSize: 15, color: color.muted}}>Nema igrača s tim imenom.</Box>;
  else
    list = (
      <>
        <Box component="ol" aria-label="Rejting igrača" sx={{listStyle: "none", m: 0, p: 0}}>
          {visible.shown.map((p) => {
            const on = p.id === selected;
            const mine = p.id === me;
            return (
              <Box component="li" key={p.id}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => replaceAddress(ratingPath(p.id))}
                  aria-pressed={on}
                  aria-current={mine ? "true" : undefined}
                  sx={{
                    ...buttonBase,
                    width: "100%",
                    height: 60,
                    display: "grid",
                    ...deskGrid,
                    alignItems: "center",
                    px: "18px",
                    borderBottom: `1px solid ${color.divider}`,
                    background: mine ? color.cream2 : on ? color.line : "transparent",
                    boxShadow: [mine ? shadow.mineBar : null, on ? shadow.selectRing : null].filter(Boolean).join(", ") || "none",
                    textAlign: "left",
                    "&:hover": {filter: "brightness(.98)"},
                  }}
                >
                  <RankDot rank={p.rank} size={30} />
                  <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                    <Box component="span" sx={{fontSize: 16, fontWeight: mine ? 700 : 600, color: color.ink, ...ellipsis}}>
                      {p.name}
                    </Box>
                    <Box component="span" sx={{minWidth: 0, display: "flex", alignItems: "center", gap: "8px"}}>
                      <Box component="span" sx={{minWidth: 0, fontSize: 13, color: color.muted, ...ellipsis}}>
                        {p.team ?? "—"}
                      </Box>
                      {p.provisional && (
                        <Box component="span" sx={narrowOnly}>
                          <ProvisionalTag />
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{justifySelf: "end", display: "flex", alignItems: "center", gap: "10px"}}>
                    {p.provisional && (
                      <Box component="span" sx={{display: "inline-flex", ...wideOnly}}>
                        <ProvisionalTag size="md" />
                      </Box>
                    )}
                    <Box component="span" sx={{fontFamily: font.display, fontSize: 26, fontWeight: 800, color: color.ink, ...tabular}}>
                      {p.rating}
                    </Box>
                  </Box>
                  <Box sx={{justifySelf: "end", fontSize: 15, fontWeight: 700, color: changeInk(p.change), ...tabular}}>{formatChange(p.rounds ? p.change : null)}</Box>
                  <Box sx={{justifySelf: "end", fontSize: 15, fontWeight: 600, color: color.ink2, ...tabular}}>{p.rounds}</Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        {visible.left > 0 && <LoadMoreButton left={visible.left} noun={NOUN.igrač} onClick={more} />}
      </>
    );

  return (
    <DesktopShell active="ratings" eyebrow={EYEBROW} title="Rejting igrača" lead={short ? <BackPill nav={nav} sx={{alignSelf: "center", maxWidth: 320}} /> : undefined}>
      {!short && <BackPill nav={nav} />}
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 360px"}, gap: "20px"}}>
        {/* overflow: the last row (Učitaj još, a picked or my own row) keeps the card's round corners */}
        <Card sx={{minHeight: 0, borderRadius: "24px", display: "flex", flexDirection: "column", overflow: "hidden"}}>
          <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: "16px 18px 12px"}}>
            <SearchInput variant="paper" height={46} placeholder="Traži igrača" aria-label="Traži igrača" value={query} onChange={(e) => search(e.target.value)} onClear={() => search("")} sx={{flex: 1, minWidth: 0, maxWidth: 340}} />
            <Box
              component="button"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={infoAnchor != null}
              aria-controls={infoAnchor ? infoId : undefined}
              onClick={(e) => {
                setInfoView("cols");
                setInfoAnchor(infoAnchor ? null : e.currentTarget);
              }}
              sx={{...buttonBase, flex: "none", ml: "auto", height: 46, display: "flex", alignItems: "center", gap: "8px", pl: "12px", pr: "16px", border: `1.5px solid ${color.borderControl}`, borderRadius: "14px", background: infoAnchor ? color.paper : color.white, color: color.navy, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", "& svg": {fontSize: 22}}}
            >
              <InfoOutlinedIcon />
              Što znače stupci?
            </Box>
            <Popover
              id={infoId}
              open={infoAnchor != null}
              anchorEl={infoAnchor}
              onClose={() => setInfoAnchor(null)}
              anchorOrigin={{vertical: "bottom", horizontal: "right"}}
              transformOrigin={{vertical: "top", horizontal: "right"}}
              slotProps={{paper: {role: "dialog", "aria-label": infoTitle(infoView), sx: {mt: "10px", width: 420, borderRadius: "20px", p: "18px 20px", boxShadow: shadow.popover, display: "flex", flexDirection: "column", gap: "10px"}}}}
            >
              <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
                  {infoTitle(infoView)}
                </Box>
                <IconCircleButton label="Zatvori" size={36} onClick={() => setInfoAnchor(null)} sx={{background: color.paper, boxShadow: "none", "& svg": {fontSize: 20}}}>
                  <CloseRoundedIcon />
                </IconCircleButton>
              </Box>
              <RatingsInfo view={infoView} onSwitch={setInfoView} compact />
            </Popover>
          </Box>
          <Box role="row" sx={{flex: "none", display: "grid", ...deskGrid, alignItems: "center", height: 40, px: "18px", borderTop: `1px solid ${color.line}`, borderBottom: `1px solid ${tint.navy[12]}`}}>
            {HEADS.map((h) => (
              <Tooltip
                key={h.key}
                title={RATING_COLUMNS.find(([k]) => k === h.key)![1]}
                placement={h.align === "end" ? "bottom-end" : "bottom-start"}
                enterDelay={150}
                slotProps={{tooltip: {sx: {width: 260, maxWidth: 260, p: "10px 12px", borderRadius: "12px", background: color.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, boxShadow: shadow.tooltip}}}}
              >
                <Box
                  role="columnheader"
                  tabIndex={0}
                  sx={{justifySelf: h.align, display: "flex", alignItems: "center", gap: "4px", height: 40, fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted, cursor: "help", outline: "none", "&:hover, &:focus-visible": {color: color.navy}, "& svg": {fontSize: 15, opacity: 0.6}}}
                >
                  {h.key}
                  <HelpOutlineRoundedIcon />
                </Box>
              </Tooltip>
            ))}
          </Box>
          <Box ref={all ? scroller.ref : undefined} sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
            {list}
          </Box>
        </Card>
        <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px"}}>
          {missing ? (
            <Card>
              <ListMessage kind="notFound" />
            </Card>
          ) : detailError && !detail ? (
            <Card>
              <ListMessage kind="error" onRetry={reloadDetail} />
            </Card>
          ) : detail ? (
            <DetailBody detail={detail} chartWidth={384} desktop />
          ) : selected != null || (!all && !error) ? (
            <DetailSkeleton desktop />
          ) : null}
        </Box>
      </Box>
    </DesktopShell>
  );
}
