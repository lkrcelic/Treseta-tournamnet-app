"use client";

import {TableRow} from "@/app/_lib/ui/tables";
import {color, font, shadow} from "@/app/_styles/tokens";
import {Card, ellipsis, Eyebrow, LiveDot, LiveLabel, LivePill, tabular} from "@/app/_ui/sp";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {Box} from "@mui/material";
import React from "react";

// Phone: one card per table, both teams with their wins (and live match points while playing)
export function PhoneRoundTables({title, rows}: {title: string; rows: TableRow[]}) {
  const live = rows.filter((r) => r.live).length;
  return (
    <>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", p: "2px 4px", minHeight: 28}}>
        <Eyebrow>{title}</Eyebrow>
        {live > 0 && <LivePill>LIVE: {live}</LivePill>}
      </Box>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
        {rows.map((t) => (
          <Card
            component="li"
            key={t.id}
            aria-label={`Stol ${t.table}: ${t.teamA} ${t.winsA}, ${t.teamB} ${t.winsB}${t.live ? ", uživo" : ""}`}
            aria-current={t.mine ? "true" : undefined}
            // the player's own table: cream with a navy ring
            sx={{p: "12px 16px 6px", display: "flex", flexDirection: "column", background: t.mine ? color.creamSoft : color.card, ...(t.mine && {boxShadow: `${shadow.card}, ${shadow.mineRing}`})}}
          >
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", height: 24}}>
              <Box component="span" sx={{fontSize: 13, fontWeight: 600, color: color.muted}}>
                Table {t.table}
              </Box>
              {t.live && <LiveLabel />}
            </Box>
            {(
              [
                [t.teamA, t.winsA, t.pointsA, t.winsA > t.winsB],
                [t.teamB, t.winsB, t.pointsB, t.winsB > t.winsA],
              ] as const
            ).map(([name, wins, pts, ahead], k) => (
              <Box
                key={k}
                aria-hidden
                sx={{
                  height: 44,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto 32px",
                  alignItems: "center",
                  gap: "10px",
                  borderTop: k ? `1px solid ${color.line}` : "none",
                }}
              >
                <Box component="span" sx={{fontSize: 16, fontWeight: !t.live && ahead ? 700 : 500, ...ellipsis}}>
                  {name}
                </Box>
                <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: color.muted, ...tabular}}>
                  {t.live && pts != null ? `(${pts})` : ""}
                </Box>
                <Box component="span" sx={{textAlign: "right", fontFamily: font.display, fontSize: 26, fontWeight: 800, ...tabular}}>
                  {wins}
                </Box>
              </Box>
            ))}
          </Card>
        ))}
      </Box>
    </>
  );
}

// Desktop: a dense row per table — number chip, team A, score (live points under it), team B, status.
// height of one table row on the desktop round view (the confirmation strip is the same height)
export const TABLE_ROW_HEIGHT = 44;

// href: the whole row opens the table (admin scorepad). actions: edit-mode buttons instead of the status, and onOpen:
// a click anywhere on the row in edit mode (opens its pair). fresh: a table just added (cream row, navy number).
// confirm: replaces the row with a confirmation strip.
export function DesktopTableRow({
  t,
  dense,
  href,
  actions,
  onOpen,
  fresh,
  confirm,
}: {
  t: TableRow;
  dense: boolean;
  href?: string;
  actions?: React.ReactNode;
  onOpen?: () => void;
  fresh?: boolean;
  confirm?: React.ReactNode;
}) {
  const font1 = dense ? 15 : 17;
  const label = `Stol ${t.table}: ${t.teamA} ${t.winsA} : ${t.winsB} ${t.teamB}${t.live ? `, uživo ${t.pointsA ?? 0} – ${t.pointsB ?? 0}` : ""}`;
  if (confirm) {
    return (
      <Box
        component="li"
        sx={{height: TABLE_ROW_HEIGHT, display: "flex", alignItems: "center", gap: "6px", pl: dense ? "12px" : "18px", pr: "8px", borderBottom: `1px solid rgba(60,74,103,.07)`, background: "rgba(188,71,73,.08)"}}
      >
        {confirm}
      </Box>
    );
  }
  const rowSx = {
    height: TABLE_ROW_HEIGHT,
    display: "grid",
    gridTemplateColumns: dense
      ? `32px minmax(0,1fr) 66px minmax(0,1fr) ${actions ? "72px" : "40px"}`
      : `40px minmax(0,1fr) 84px minmax(0,1fr) ${actions ? "76px" : "64px"}`,
    alignItems: "center",
    gap: dense ? "6px" : "10px",
    px: dense ? "12px" : "18px",
    borderBottom: `1px solid rgba(60,74,103,.07)`,
    // the player's own table: the standings' cream row with the navy bar
    background: fresh ? color.creamSoft : t.mine ? color.mine : "transparent",
    boxShadow: t.mine ? shadow.mineBar : "none",
    color: color.ink,
    textDecoration: "none",
    ...tabular,
  } as const;
  const cells = (
    <>
      <Box
        component="span"
        aria-hidden
        sx={{height: 28, borderRadius: "8px", background: fresh ? color.navy : color.paper, color: fresh ? "#FFFFFF" : color.navy, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}
      >
        {t.table}
      </Box>
      <Box component="span" aria-hidden sx={{textAlign: "right", fontSize: font1, fontWeight: !t.live && t.winsA > t.winsB ? 700 : 500, ...ellipsis}}>
        {t.teamA}
      </Box>
      <Box component="span" aria-hidden sx={{display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05}}>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
          {t.winsA} : {t.winsB}
        </Box>
        {t.live && (
          <Box component="span" sx={{fontSize: 12, fontWeight: 600, color: color.muted, whiteSpace: "nowrap"}}>
            {t.pointsA ?? 0} · {t.pointsB ?? 0}
          </Box>
        )}
      </Box>
      <Box component="span" aria-hidden sx={{fontSize: font1, fontWeight: !t.live && t.winsB > t.winsA ? 700 : 500, ...ellipsis}}>
        {t.teamB}
      </Box>
    </>
  );
  const status = (
    <Box
      component="span"
      aria-hidden
      sx={{display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "5px", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: t.live ? color.live : color.faint}}
    >
      {t.live && (
        <>
          <LiveDot size={7} />
          LIVE
        </>
      )}
    </Box>
  );

  if (href) {
    return (
      <Box component="li">
        <Box component={TransitionLink} href={href} aria-label={`${label}. Otvori stol`} sx={{...rowSx, "&:hover": {background: color.tableHead}}}>
          {cells}
          {status}
        </Box>
      </Box>
    );
  }
  return (
    <Box component="li" aria-label={label} onClick={onOpen} sx={onOpen ? {...rowSx, cursor: "pointer", "&:hover": {background: fresh ? color.creamSoft : color.tableHead}} : rowSx}>
      {cells}
      {actions ?? status}
    </Box>
  );
}
