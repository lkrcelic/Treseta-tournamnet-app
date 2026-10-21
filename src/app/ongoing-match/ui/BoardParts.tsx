"use client";

import {runningHands} from "@/app/_lib/ui/handRows";
import {count, NOUN} from "@/app/_lib/ui/text";
import {color, ease, font, shadow, teamColor, teamTint, teamTrack} from "@/app/_styles/tokens";
import {buttonBase, Card, ellipsis, EmptyState, rowFocus, Segmented, tabular, visuallyHidden} from "@/app/_ui/sp";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";

// One team's running total: name, round-win pips, big score and progress towards the threshold.
// href: the name opens the team (Pregled stola); mine: the viewer's own team, cream with a navy ring.
export function ScorePanel({
  index,
  name,
  wins,
  total,
  finalTotal,
  threshold,
  celebrate,
  popPip,
  size = "phone",
  href,
  mine = false,
}: {
  index: 0 | 1;
  name: string;
  wins: number;
  total: number;
  // the real total (total is the animated value); announced to screen readers when it changes
  finalTotal?: number;
  threshold: number;
  celebrate: boolean;
  popPip?: boolean;
  size?: "phone" | "desktop";
  href?: string;
  mine?: boolean;
}) {
  const c = teamColor[index];
  const desk = size === "desktop";
  const pct = Math.min(100, (total / threshold) * 100);
  return (
    <Card
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: desk ? "24px" : "22px",
        p: desk ? "18px 22px 20px" : "14px 14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: desk ? "8px" : "6px",
        minWidth: 0,
        ...(mine && {background: color.cream2, boxShadow: `${shadow.card}, ${shadow.selectRing}`}),
      }}
    >
      <Box aria-hidden sx={{position: "absolute", inset: 0, background: teamTint[index], opacity: celebrate ? 1 : 0, transition: "opacity 500ms ease"}} />
      <Box sx={{position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
        <Box component="h2" sx={{m: 0, minWidth: 0, display: "flex", fontSize: desk ? 17 : 15, fontWeight: 600}}>
          {href ? (
            // the name and its chevron, 44 px high for the thumb (it reaches into the card's padding)
            <Box
              component={TransitionLink}
              href={href}
              aria-label={`Otvori ekipu ${name}`}
              sx={{
                minWidth: 0,
                height: 44,
                my: "-12px",
                mx: "-6px",
                px: "6px",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                borderRadius: "10px",
                color: color.ink,
                textDecoration: "none",
                "&:active": {background: color.lineFill},
                "&:focus-visible": {...rowFocus, outlineOffset: 0},
                "& svg": {flex: "none", fontSize: 18, color: color.muted},
              }}
            >
              <Box component="span" sx={ellipsis}>
                {name}
              </Box>
              <ChevronRightRoundedIcon aria-hidden />
            </Box>
          ) : (
            <Box component="span" sx={ellipsis}>
              {name}
            </Box>
          )}
        </Box>
        <Box role="img" aria-label={`${wins} od 2 pobjede u kolu`} sx={{display: "flex", gap: desk ? "6px" : "5px", flex: "none"}}>
          {[0, 1].map((k) => (
            <Box
              key={k}
              sx={{
                width: desk ? 12 : 10,
                height: desk ? 12 : 10,
                boxSizing: desk ? "border-box" : "content-box",
                borderRadius: "50%",
                border: `2px solid ${c}`,
                background: wins > k ? c : "transparent",
                animation: popPip && wins === k + 1 ? "spPop 480ms ease" : "none",
              }}
            />
          ))}
        </Box>
      </Box>
      <Box
        aria-hidden
        sx={{
          position: "relative",
          fontFamily: font.display,
          fontSize: desk ? 84 : 56,
          fontWeight: 800,
          lineHeight: desk ? 0.95 : 1,
          letterSpacing: "-.03em",
          color: c,
          ...tabular,
          transformOrigin: "left center",
          animation: celebrate ? "spPulse 760ms ease-in-out 2" : "none",
        }}
      >
        {total}
      </Box>
      <Box component="span" aria-live="polite" sx={visuallyHidden}>
        {`${name}: ${count(finalTotal ?? total, NOUN.bod)}${celebrate ? ", pobjeda" : ""}`}
      </Box>
      <Box aria-hidden sx={{position: "relative", height: desk ? 5 : 4, borderRadius: "3px", background: teamTrack[index], overflow: "hidden"}}>
        <Box sx={{height: "100%", width: `${pct}%`, background: c, borderRadius: "3px", transition: `width 600ms ${ease}`}} />
      </Box>
    </Card>
  );
}

export type HandRow = {id: number | null; left: number; right: number; animate?: "in" | "flash"};

// The list of hands; tapping one opens it for editing (without onOpen the list is only read: Pregled stola).
// Each hand is its own card (Claude Design "Score pad", A6): both teams' totals with it counted beside its points, the
// hand's winner in the team colour, and under it a bar from the middle towards the team ahead with the lead after it.
// empty: what an empty list says instead of "Još nema upisanih igara".
export function HandList({
  rows,
  onOpen,
  selectedId,
  size = "phone",
  listRef,
  empty,
  sx,
}: {
  rows: HandRow[];
  onOpen?: (id: number) => void;
  empty?: React.ReactNode;
  selectedId?: number | null;
  size?: "phone" | "desktop";
  listRef?: React.Ref<HTMLDivElement>;
  sx?: SxProps<Theme>;
}) {
  const desk = size === "desktop";
  const running = runningHands(rows);
  const listSx = {flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain"} as const;
  if (rows.length === 0) {
    return (
      <Card ref={listRef} aria-label="Upisane igre" sx={[{...listSx, borderRadius: desk ? "24px" : "22px"}, ...(Array.isArray(sx) ? sx : [sx])]}>
        {empty ?? <EmptyState>Još nema upisanih igara</EmptyState>}
      </Card>
    );
  }
  const total = (n: number) => (
    <Box component="span" sx={{fontSize: desk ? 15 : 13, fontWeight: 600, color: color.ink}}>
      {n}
    </Box>
  );
  const points = (n: number, team: 0 | 1, winner: 0 | 1 | null) => (
    <Box
      component="span"
      sx={{fontFamily: font.display, fontSize: desk ? 30 : 28, fontWeight: 800, lineHeight: 1, color: winner === team ? teamColor[team] : color.ink}}
    >
      {n}
    </Box>
  );
  const bar = (team: 0 | 1, pct: number) => (
    <Box
      sx={{
        height: 6,
        display: "flex",
        justifyContent: team === 0 ? "flex-end" : "flex-start",
        borderRadius: team === 0 ? "3px 0 0 3px" : "0 3px 3px 0",
        background: color.lineFill,
        overflow: "hidden",
      }}
    >
      <Box sx={{height: "100%", width: `${pct}%`, background: teamColor[team], transition: `width 600ms ${ease}`}} />
    </Box>
  );
  return (
    <Box ref={listRef} aria-label="Upisane igre" sx={[listSx, ...(Array.isArray(sx) ? sx : [sx])]}>
      {/* the padding keeps the cards' shadows inside the scrolling box */}
      <Box component="ol" sx={{listStyle: "none", m: 0, p: "2px", display: "flex", flexDirection: "column", gap: desk ? "8px" : "6px"}}>
        {rows.map((r, i) => {
          const h = running[i];
          const selected = selectedId != null && selectedId === r.id;
          return (
            <Box component="li" key={r.id ?? `i${i}`}>
              <Box
                component={onOpen ? "button" : "div"}
                type={onOpen ? "button" : undefined}
                onClick={onOpen ? () => r.id != null && onOpen(r.id) : undefined}
                aria-label={`Igra ${i + 1}: ${r.left} prema ${r.right}, ukupno ${h.total[0]} prema ${h.total[1]}, razlika ${h.lead}${onOpen ? ". Uredi" : ""}`}
                aria-current={selected ? "true" : undefined}
                sx={{
                  ...buttonBase,
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: desk ? "10px" : "8px",
                  p: desk ? "12px 18px 11px" : "10px 14px 9px",
                  borderRadius: desk ? "20px" : "18px",
                  background: selected ? color.cream2 : color.white,
                  boxShadow: shadow.card,
                  textAlign: "center",
                  ...tabular,
                  animation:
                    r.animate === "in" ? `spRowIn 420ms ${ease} both` : r.animate === "flash" ? "spRowFlash 900ms ease-out" : "none",
                  ...(onOpen && {"&:active": {background: color.lineFill}, "&:hover": desk ? {background: color.paper2} : undefined}),
                }}
              >
                <Box
                  component="span"
                  sx={{display: "grid", gridTemplateColumns: desk ? "minmax(0,1fr) 56px minmax(0,1fr)" : "minmax(0,1fr) 44px minmax(0,1fr)", alignItems: "center"}}
                >
                  <Box component="span" sx={{display: "flex", alignItems: "baseline", justifyContent: "center", gap: "8px"}}>
                    {total(h.total[0])}
                    {points(r.left, 0, h.winner)}
                  </Box>
                  <Box component="span" sx={{fontFamily: font.display, fontSize: desk ? 22 : 20, fontWeight: 800, lineHeight: 1, color: color.muted}}>
                    {i + 1}.
                  </Box>
                  <Box component="span" sx={{display: "flex", alignItems: "baseline", justifyContent: "center", gap: "8px"}}>
                    {points(r.right, 1, h.winner)}
                    {total(h.total[1])}
                  </Box>
                </Box>
                <Box component="span" aria-hidden sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) 52px minmax(0,1fr)", alignItems: "center"}}>
                  {bar(0, h.leader === 0 ? h.leadPct : 0)}
                  <Box component="span" sx={{fontSize: desk ? 14 : 13, fontWeight: 800, lineHeight: 1, color: h.leader == null ? color.ink2 : teamColor[h.leader]}}>
                    {h.lead === 0 ? "0" : `+${h.lead}`}
                  </Box>
                  {bar(1, h.leader === 1 ? h.leadPct : 0)}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export type MatchTab = {number: number; sub: string; live?: boolean};

// Meč 1 · Meč 2 above a table's hands (Pregled stola, the admin's scorepad): each match with what it stands at
// under its name ("1034 : 748 · Purgeri", "u tijeku", "nije počeo"); a live one in red
export function MatchTabs({tabs, value, onChange}: {tabs: MatchTab[]; value: number; onChange: (n: number) => void}) {
  return (
    <Segmented
      variant="track"
      size={50}
      label="Meč"
      asTabs={false}
      value={value}
      onChange={onChange}
      items={tabs.map((t) => ({
        key: t.number,
        label: (
          <Box component="span" sx={{minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", lineHeight: 1.2}}>
            <Box component="span" sx={{fontSize: 15, color: color.ink}}>
              Meč {t.number}
            </Box>
            <Box component="span" sx={{maxWidth: "100%", fontSize: 12, fontWeight: 600, color: t.live ? color.red : color.muted, ...ellipsis, ...tabular}}>
              {t.sub}
            </Box>
          </Box>
        ),
      }))}
    />
  );
}
