"use client";

import {getPlayerRatingAPI} from "@/app/_fetchers/ratings";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useRatings from "@/app/_hooks/useRatings";
import {PlayerRatingDetail, RatingRow} from "@/app/_interfaces/ratings";
import {formatChange, RATING_COLUMNS, roundsLabel} from "@/app/_lib/ui/ratings";
import {matchesQuery} from "@/app/_lib/ui/text";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, ease, font, shadow} from "@/app/_styles/tokens";
import {buttonBase, Card, CenteredSpinner, DesktopShell, ellipsis, IconCircleButton, LoadingRows, PrimaryButton, Screen, SearchInput, tabular} from "@/app/_ui/sp";
import {changeInk, infoTitle, InfoView, LastNights, NoRoundsCard, PlayerCard, ProvisionalTag, RankDot, RatingChartCard, RatingsInfo} from "./RatingParts";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {Box, Drawer, Popover, Tooltip} from "@mui/material";
import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";

// Rejting igrača (Claude Design 8a–8m): one list across all leagues, highest rating first. On the phone a row opens
// the player's detail (its own page); on the desktop the detail sits next to the list. The (i) button explains
// every column, and on the desktop each column header has a tooltip too.

const EYEBROW = "Svi igrači · sve lige";

export default function RatingsScreen({playerId}: {playerId?: number}) {
  const isDesktop = useIsDesktop();
  const {list, error, reload} = useRatings();
  const [query, setQuery] = useState("");
  const players = useMemo(
    () => (list?.players ?? []).filter((p) => matchesQuery(p.name, query) || matchesQuery(p.username, query)),
    [list, query]
  );

  if (isDesktop) return <DesktopRatings list={list?.players ?? null} me={list?.me ?? null} players={players} error={error} reload={reload} query={query} setQuery={setQuery} initial={playerId} />;
  if (playerId != null) return <PhoneDetail playerId={playerId} />;
  return <PhoneList all={list?.players ?? null} me={list?.me ?? null} players={players} error={error} reload={reload} query={query} setQuery={setQuery} />;
}

function usePlayerRating(playerId: number | null) {
  const [detail, setDetail] = useState<PlayerRatingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (playerId == null) return;
    setError(null);
    try {
      setDetail(await getPlayerRatingAPI(playerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejting igrača nije moguće učitati.");
    }
  }, [playerId]);
  useEffect(() => {
    load();
  }, [load]);
  // the detail of another player stays on screen until the new one arrives, but never shows under the wrong name
  return {detail: detail && detail.player.id === playerId ? detail : null, error, reload: load};
}

// Empty list, no search match, or the list didn't load (8g, 8h)
function ListMessage({kind, onRetry}: {kind: "empty" | "noMatch" | "error"; onRetry?: () => void}) {
  const m = {
    empty: {icon: <LeaderboardRoundedIcon />, title: "Još nema rejtinga", text: "Rejting se pojavi kad se odigra prvo kolo."},
    noMatch: {icon: <PersonSearchRoundedIcon />, title: "Nema takvog igrača", text: "Provjeri kako si napisao ime."},
    error: {icon: <CloudOffRoundedIcon />, title: "Rejting se nije učitao", text: "Provjeri vezu i pokušaj ponovno."},
  }[kind];
  return (
    <Box role={kind === "error" ? "alert" : "status"} sx={{p: "56px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center"}}>
      <Box aria-hidden sx={{width: 64, height: 64, borderRadius: "50%", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 32}}}>
        {m.icon}
      </Box>
      <Box sx={{fontFamily: font.display, fontSize: 22, fontWeight: 800}}>{m.title}</Box>
      <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>{m.text}</Box>
      {onRetry && (
        <Box component="button" type="button" onClick={onRetry} sx={{...buttonBase, mt: "8px", height: 48, px: "22px", borderRadius: "16px", background: color.navy, color: "#FFFFFF", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", "& svg": {fontSize: 20}}}>
          <RefreshRoundedIcon />
          Pokušaj ponovno
        </Box>
      )}
    </Box>
  );
}

type ListProps = {
  me: number | null;
  players: RatingRow[];
  error: string | null;
  reload: () => void;
  query: string;
  setQuery: (q: string) => void;
};

// ---------- phone ----------

function PhoneList({all, me, players, error, reload, query, setQuery}: ListProps & {all: RatingRow[] | null}) {
  const router = useTransitionRouter();
  const [info, setInfo] = useState<InfoView | null>(null);

  let body: React.ReactNode;
  if (error && !all) body = <ListMessage kind="error" onRetry={reload} />;
  else if (!all) body = <LoadingRows rows={8} height={62} />;
  else if (all.length === 0) body = <ListMessage kind="empty" />;
  else if (players.length === 0) body = <ListMessage kind="noMatch" />;
  else
    body = (
      <Box component="ol" aria-label="Rejting igrača" sx={{listStyle: "none", m: 0, p: 0}}>
        {players.map((p) => (
          <Box component="li" key={p.id}>
            <PhoneRow player={p} me={p.id === me} />
          </Box>
        ))}
      </Box>
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
      <SearchInput height={48} placeholder="Traži igrača" aria-label="Traži igrača" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Card sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", borderRadius: "22px"}}>
        <Box aria-hidden sx={{position: "sticky", top: 0, zIndex: 3, background: color.card, height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", pl: "14px", pr: "16px", borderBottom: "1px solid rgba(60,74,103,.1)", fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}>
          <span>#&nbsp;&nbsp;&nbsp;Igrač</span>
          <span>Rejting</span>
        </Box>
        {body}
      </Card>
      <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
        Početni zaslon
      </PrimaryButton>
      <InfoSheet view={info} onChange={setInfo} />
    </Screen>
  );
}

function PhoneRow({player: p, me}: {player: RatingRow; me: boolean}) {
  return (
    <Box
      component={TransitionLink}
      href={`/ratings/${p.id}`}
      aria-current={me ? "true" : undefined}
      sx={{
        ...buttonBase,
        display: "grid",
        gridTemplateColumns: "30px minmax(0,1fr) auto",
        columnGap: "10px",
        rowGap: "1px",
        alignItems: "center",
        p: "9px 16px 9px 12px",
        borderBottom: "1px solid rgba(60,74,103,.08)",
        background: me ? color.mine : "transparent",
        boxShadow: me ? shadow.mineBar : "none",
        textDecoration: "none",
        textAlign: "left",
        color: color.ink,
        "&:active": {background: me ? color.mine : color.pressed},
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
      slotProps={{backdrop: {sx: {background: "rgba(21,24,31,.4)"}}}}
      PaperProps={{
        role: "dialog",
        "aria-labelledby": titleId,
        sx: {maxWidth: 560, mx: "auto", maxHeight: "88%", borderRadius: "28px 28px 0 0", background: color.card, p: "10px 20px calc(24px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: "14px", boxShadow: "0 -10px 30px rgba(21,24,31,.18)"},
      }}
    >
      <Box aria-hidden sx={{alignSelf: "center", width: 36, height: 5, borderRadius: "3px", background: "#D8D4CA"}} />
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

function PhoneDetail({playerId}: {playerId: number}) {
  const router = useTransitionRouter();
  const {detail, error, reload} = usePlayerRating(playerId);
  return (
    <Screen fill gap={8} sx={{px: 0}}>
      <Box sx={{display: "flex", alignItems: "center", gap: "10px", px: "14px", pb: "8px"}}>
        <IconCircleButton label="Natrag" size={44} onClick={() => router.push("/ratings", "back")}>
          <ChevronLeftRoundedIcon sx={{fontSize: 26}} />
        </IconCircleButton>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
          Rejting
        </Box>
      </Box>
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", p: "6px 20px 12px", display: "flex", flexDirection: "column", gap: "14px"}}>
        {error && !detail ? <ListMessage kind="error" onRetry={reload} /> : !detail ? <CenteredSpinner /> : <DetailBody detail={detail} chartWidth={318} />}
      </Box>
    </Screen>
  );
}

function DetailBody({detail, chartWidth, desktop = false}: {detail: PlayerRatingDetail; chartWidth: number; desktop?: boolean}) {
  return (
    <>
      <PlayerCard detail={detail} desktop={desktop} />
      {detail.history.length > 0 ? (
        <>
          <RatingChartCard detail={detail} width={chartWidth} />
          {detail.lastNights.length > 0 && <LastNights detail={detail} desktop={desktop} />}
        </>
      ) : (
        <NoRoundsCard />
      )}
    </>
  );
}

// ---------- desktop ----------

// the table's columns: grid widths and where each header's tooltip opens
const DESK_COLUMNS = "64px minmax(0,1fr) 190px 120px 100px";
const HEADS: {key: string; align: "start" | "end"}[] = [
  {key: "#", align: "start"},
  {key: "Igrač", align: "start"},
  {key: "Rejting", align: "end"},
  {key: "Promjena", align: "end"},
  {key: "Kola", align: "end"},
];

function DesktopRatings({list, me, players, error, reload, query, setQuery, initial}: ListProps & {list: RatingRow[] | null; initial?: number}) {
  const [picked, setPicked] = useState<number | null>(initial ?? null);
  const selected = picked ?? me ?? list?.[0]?.id ?? null;
  const {detail, error: detailError, reload: reloadDetail} = usePlayerRating(selected);
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const [infoView, setInfoView] = useState<InfoView>("cols");
  const infoId = useId();

  let rows: React.ReactNode;
  if (error && !list) rows = <ListMessage kind="error" onRetry={reload} />;
  else if (!list) rows = <LoadingRows rows={10} height={60} />;
  else if (list.length === 0) rows = <ListMessage kind="empty" />;
  else if (players.length === 0) rows = <Box sx={{p: "48px", textAlign: "center", fontSize: 15, color: color.muted}}>Nema igrača s tim imenom.</Box>;
  else
    rows = (
      <Box component="ol" aria-label="Rejting igrača" sx={{listStyle: "none", m: 0, p: 0}}>
        {players.map((p) => {
          const on = p.id === selected;
          const mine = p.id === me;
          return (
            <Box component="li" key={p.id}>
              <Box
                component="button"
                type="button"
                onClick={() => setPicked(p.id)}
                aria-pressed={on}
                aria-current={mine ? "true" : undefined}
                sx={{
                  ...buttonBase,
                  width: "100%",
                  height: 60,
                  display: "grid",
                  gridTemplateColumns: DESK_COLUMNS,
                  alignItems: "center",
                  px: "18px",
                  borderBottom: "1px solid rgba(60,74,103,.07)",
                  background: mine ? color.mine : on ? "rgba(60,74,103,.08)" : "transparent",
                  boxShadow: [mine ? shadow.mineBar : null, on ? "inset 0 0 0 2px #3C4A67" : null].filter(Boolean).join(", ") || "none",
                  textAlign: "left",
                  "&:hover": {filter: "brightness(.98)"},
                }}
              >
                <RankDot rank={p.rank} size={30} />
                <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: mine ? 700 : 600, color: color.ink, ...ellipsis}}>
                    {p.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {p.team ?? "—"}
                  </Box>
                </Box>
                <Box sx={{justifySelf: "end", display: "flex", alignItems: "center", gap: "10px"}}>
                  {p.provisional && <ProvisionalTag size="md" />}
                  <Box component="span" sx={{fontFamily: font.display, fontSize: 26, fontWeight: 800, color: color.ink, ...tabular}}>
                    {p.rating}
                  </Box>
                </Box>
                <Box sx={{justifySelf: "end", fontSize: 15, fontWeight: 700, color: changeInk(p.change), ...tabular}}>{formatChange(p.rounds ? p.change : null)}</Box>
                <Box sx={{justifySelf: "end", fontSize: 15, fontWeight: 600, color: color.inkSoft, ...tabular}}>{p.rounds}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    );

  return (
    <DesktopShell active="ratings" eyebrow={EYEBROW} title="Rejting igrača">
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: "20px"}}>
        <Card sx={{minHeight: 0, borderRadius: "24px", display: "flex", flexDirection: "column"}}>
          <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: "16px 18px 12px"}}>
            <SearchInput soft height={46} placeholder="Traži igrača" aria-label="Traži igrača" value={query} onChange={(e) => setQuery(e.target.value)} sx={{flex: 1, maxWidth: 340}} />
            <Box sx={{flex: 1}} />
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
              sx={{...buttonBase, height: 46, display: "flex", alignItems: "center", gap: "8px", pl: "12px", pr: "16px", border: "1.5px solid rgba(60,74,103,.2)", borderRadius: "14px", background: infoAnchor ? color.paper : color.card, color: color.navy, fontSize: 15, fontWeight: 600, "& svg": {fontSize: 22}}}
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
              slotProps={{paper: {role: "dialog", "aria-label": infoTitle(infoView), sx: {mt: "10px", width: 420, borderRadius: "20px", p: "18px 20px", boxShadow: "0 18px 50px rgba(21,24,31,.22), 0 0 0 1px rgba(60,74,103,.08)", display: "flex", flexDirection: "column", gap: "10px"}}}}
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
          <Box role="row" sx={{flex: "none", display: "grid", gridTemplateColumns: DESK_COLUMNS, alignItems: "center", height: 40, px: "18px", borderTop: "1px solid rgba(60,74,103,.08)", borderBottom: "1px solid rgba(60,74,103,.12)"}}>
            {HEADS.map((h) => (
              <Tooltip
                key={h.key}
                title={RATING_COLUMNS.find(([k]) => k === h.key)![1]}
                placement={h.align === "end" ? "bottom-end" : "bottom-start"}
                enterDelay={150}
                slotProps={{tooltip: {sx: {width: 260, maxWidth: 260, p: "10px 12px", borderRadius: "12px", background: color.ink, fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, boxShadow: "0 10px 30px rgba(21,24,31,.25)"}}}}
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
          <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>{rows}</Box>
        </Card>
        <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px"}}>
          {detailError && !detail ? (
            <Card>
              <ListMessage kind="error" onRetry={reloadDetail} />
            </Card>
          ) : detail ? (
            <DetailBody detail={detail} chartWidth={384} desktop />
          ) : selected != null || !list ? (
            <CenteredSpinner />
          ) : null}
        </Box>
      </Box>
    </DesktopShell>
  );
}
