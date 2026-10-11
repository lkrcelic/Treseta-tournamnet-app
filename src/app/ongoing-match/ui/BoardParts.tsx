"use client";

import {color, ease, font, teamColor, teamTint, teamTrack} from "@/app/_styles/tokens";
import {buttonBase, Card, ellipsis, EmptyState, tabular} from "@/app/_ui/sp";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";

// One team's running total: name, round-win pips, big score and progress towards the threshold
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
      }}
    >
      <Box aria-hidden sx={{position: "absolute", inset: 0, background: teamTint[index], opacity: celebrate ? 1 : 0, transition: "opacity 500ms ease"}} />
      <Box sx={{position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
        <Box component="h2" sx={{m: 0, fontSize: desk ? 17 : 15, fontWeight: 600, ...ellipsis}}>
          {name}
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
      <Box component="span" aria-live="polite" sx={{position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)"}}>
        {`${name}: ${finalTotal ?? total} bodova${celebrate ? ", pobjeda" : ""}`}
      </Box>
      <Box aria-hidden sx={{position: "relative", height: desk ? 5 : 4, borderRadius: "3px", background: teamTrack[index], overflow: "hidden"}}>
        <Box sx={{height: "100%", width: `${pct}%`, background: c, borderRadius: "3px", transition: `width 600ms ${ease}`}} />
      </Box>
    </Card>
  );
}

export type HandRow = {id: number | null; left: number; right: number; animate?: "in" | "flash"};

// The list of hands; tapping one opens it for editing
export function HandList({
  rows,
  onOpen,
  selectedId,
  size = "phone",
  listRef,
  sx,
}: {
  rows: HandRow[];
  onOpen: (id: number) => void;
  selectedId?: number | null;
  size?: "phone" | "desktop";
  listRef?: React.Ref<HTMLDivElement>;
  sx?: SxProps<Theme>;
}) {
  const desk = size === "desktop";
  return (
    <Card
      ref={listRef}
      aria-label="Upisane igre"
      sx={[
        {flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", borderRadius: desk ? "24px" : "22px"},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {rows.length === 0 ? (
        <EmptyState>Još nema upisanih igara</EmptyState>
      ) : (
        <Box component="ol" sx={{listStyle: "none", m: 0, p: 0}}>
          {rows.map((r, i) => (
            <Box component="li" key={r.id ?? `i${i}`}>
              <Box
                component="button"
                type="button"
                onClick={() => r.id != null && onOpen(r.id)}
                aria-label={`Igra ${i + 1}: ${r.left} prema ${r.right}. Uredi`}
                aria-current={selectedId != null && selectedId === r.id ? "true" : undefined}
                sx={{
                  ...buttonBase,
                  width: "100%",
                  height: 52,
                  display: "grid",
                  gridTemplateColumns: desk ? "minmax(0,1fr) 56px minmax(0,1fr)" : "minmax(0,1fr) 40px minmax(0,1fr)",
                  alignItems: "center",
                  borderBottom: `1px solid ${color.line}`,
                  background: selectedId != null && selectedId === r.id ? color.creamSoft : "transparent",
                  fontFamily: font.display,
                  fontSize: desk ? 28 : 26,
                  fontWeight: 700,
                  color: color.ink,
                  textAlign: "center",
                  ...tabular,
                  animation:
                    r.animate === "in" ? `spRowIn 420ms ${ease} both` : r.animate === "flash" ? "spRowFlash 900ms ease-out" : "none",
                  "&:active": {background: color.pressed},
                  "&:hover": desk ? {background: color.tableHead} : undefined,
                }}
              >
                <span>{r.left}</span>
                <Box component="span" sx={{fontFamily: font.body, fontSize: 14, fontWeight: 600, color: color.faint}}>
                  {i + 1}
                </Box>
                <span>{r.right}</span>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
