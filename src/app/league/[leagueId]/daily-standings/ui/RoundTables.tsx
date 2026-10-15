"use client";

import {TableRow} from "@/app/_lib/ui/tables";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, Eyebrow, LiveDot, LiveLabel, LivePill, rowFocus, tabular, TeamLabel} from "@/app/_ui/sp";
import {isByeTeam} from "@/app/_lib/bye";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {Box} from "@mui/material";
import React from "react";

// Where a table card goes (Mobilni ekrani 14a–14g): the table's page (Pregled stola, or the admin's scorepad), or
// for the player's own table still to be played straight into the game, with the pill saying so
export type TableTarget = {href: string} | {cue: "Nastavi igru" | "Započni igru"; onClick: () => void};

// Phone: one card per table, both teams with their wins (and live match points while playing). Two targets on a card
// (14f): a team's name opens the team (teamHref), the rest of the card the table (tableTarget). The table's link is a
// layer under the card's content and the names are links above it, so no link is inside another; the name's area is
// its text only, at least 44 × 44 px, and the space beside a short name opens the table. A table with the bye has no
// table link, and its "Slobodna runda" side no team link. Signed out (no targets): nothing opens.
// The admin's phone (admin-mobile 19, 20): edit gives every card Uredi par and Ukloni stol, and "Dodaj stol s dvije
// ekipe" above them (and no links). A table just added (fresh) is cream.
export function PhoneRoundTables({
  title,
  rows,
  tableTarget,
  teamHref,
  edit,
  fresh,
}: {
  title: string;
  rows: TableRow[];
  tableTarget?: (t: TableRow) => TableTarget | undefined;
  teamHref?: (teamId: number) => string;
  edit?: {onPair: (t: TableRow) => void; onRemove: (t: TableRow) => void; onAdd: () => void};
  fresh?: number | null;
}) {
  const live = rows.filter((r) => r.live).length;
  const action = {
    ...buttonBase,
    height: 48,
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: 15,
    fontWeight: 600,
    "& svg": {fontSize: 20},
  } as const;
  return (
    <>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", p: "2px 4px", minHeight: 28}}>
        <Eyebrow>{title}</Eyebrow>
        {live > 0 && <LivePill>UŽIVO: {live}</LivePill>}
      </Box>
      {edit && (
        <Box
          component="button"
          type="button"
          onClick={edit.onAdd}
          sx={{...action, flex: "none", height: 56, borderRadius: "18px", border: `1.5px dashed ${tint.navy[35]}`, color: color.navy, fontSize: 16, "& svg": {fontSize: 22}}}
        >
          <AddRoundedIcon aria-hidden />
          Dodaj stol s dvije ekipe
        </Box>
      )}
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
        {rows.map((t) => {
          const target = edit || t.bye ? undefined : tableTarget?.(t);
          const cue = target && "cue" in target ? target.cue : null;
          const notStarted = !t.started && !t.done && !t.bye;
          const status = t.bye ? "Slobodna runda" : t.done ? "Završeno" : notStarted ? "Nije počelo" : null;
          const label = `Stol ${t.table}${t.smoking ? ", pušački" : ""}: ${t.teamA} ${t.winsA}, ${t.teamB} ${t.winsB}${t.live ? ", uživo" : status ? `, ${status.toLowerCase()}` : ""}`;
          const layer = {
            position: "absolute",
            inset: 0,
            zIndex: 0,
            borderRadius: "inherit",
            "&:active": {background: tint.navy[7]},
            "&:focus-visible": {outline: "none"},
          } as const;
          return (
            <Card
              component="li"
              key={t.id}
              aria-label={target || edit ? undefined : label}
              aria-current={t.mine ? "true" : undefined}
              // the player's own table: cream with a navy ring
              sx={{
                position: "relative",
                p: edit ? "12px 16px 14px" : "10px 14px 6px 16px",
                display: "flex",
                flexDirection: "column",
                background: t.mine || t.table === fresh ? color.cream2 : color.white,
                ...(t.mine && {boxShadow: `${shadow.card}, ${shadow.selectRing}`}),
                // the focus ring of the table's link goes round the whole card
                "&:has(> .table-link:focus-visible)": rowFocus,
              }}
            >
              {target &&
                ("href" in target ? (
                  <Box component={TransitionLink} href={target.href} className="table-link" aria-label={`${label}. Otvori stol`} sx={layer} />
                ) : (
                  <Box component="button" type="button" onClick={target.onClick} className="table-link" aria-label={`${label}. ${target.cue}`} sx={{...buttonBase, ...layer}} />
                ))}
              <Box sx={{position: "relative", zIndex: 1, pointerEvents: "none", display: "flex", flexDirection: "column"}}>
                <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", height: 28}}>
                  <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 13, fontWeight: 600, color: color.muted}}>
                    {t.bye ? "Bez stola" : `Stol ${t.table}`}
                    {t.smoking && !t.bye && <SmokingMark />}
                  </Box>
                  <Box component="span" aria-hidden sx={{display: "flex", alignItems: "center", gap: "8px"}}>
                    {t.live && <LiveLabel />}
                    {!t.live && !cue && status && (
                      <Box component="span" sx={{fontSize: 12.5, fontWeight: 600, color: color.muted}}>
                        {status}
                      </Box>
                    )}
                    {cue ? (
                      <Box
                        component="span"
                        sx={{height: 28, display: "flex", alignItems: "center", pl: "10px", pr: "4px", borderRadius: "14px", background: color.navy, color: color.white, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", "& svg": {fontSize: 18}}}
                      >
                        {cue}
                        <ChevronRightRoundedIcon />
                      </Box>
                    ) : (
                      target && <ChevronRightRoundedIcon sx={{fontSize: 22, color: color.navy, mr: "-4px"}} />
                    )}
                  </Box>
                </Box>
                {(
                  [
                    [t.teamA, t.teamAId, t.winsA, t.pointsA, t.winsA > t.winsB, t.conferenceA],
                    [t.teamB, t.teamBId, t.winsB, t.pointsB, t.winsB > t.winsA, t.conferenceB],
                  ] as const
                ).map(([name, id, wins, pts, ahead, conference], k) => {
                  const bye = isByeTeam(id);
                  const href = edit || bye ? undefined : teamHref?.(id);
                  const text = <TeamLabel name={name} conference={conference} sx={{fontSize: 16, fontWeight: t.done && ahead ? 700 : 600, color: bye ? color.muted : color.ink}} />;
                  return (
                    <Box
                      key={k}
                      sx={{
                        height: 44,
                        display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) auto 32px",
                        alignItems: "center",
                        gap: "10px",
                        borderTop: k ? `1px solid ${color.line}` : "none",
                      }}
                    >
                      <Box component="span" sx={{display: "flex", minWidth: 0}}>
                        {href ? (
                          <Box
                            component={TransitionLink}
                            href={href}
                            aria-label={`Ekipa ${name}`}
                            sx={{
                              pointerEvents: "auto",
                              minWidth: 44,
                              maxWidth: "calc(100% + 8px)",
                              height: 44,
                              ml: "-8px",
                              px: "8px",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "12px",
                              color: color.ink,
                              textDecoration: "none",
                              WebkitTapHighlightColor: "transparent",
                              "&:active": {background: color.lineFill},
                              "&:focus-visible": {...rowFocus, outlineOffset: 0},
                            }}
                          >
                            {text}
                          </Box>
                        ) : (
                          <Box component="span" aria-hidden={!!target || undefined} sx={{display: "flex", minWidth: 0}}>
                            {text}
                          </Box>
                        )}
                      </Box>
                      <Box component="span" aria-hidden sx={{fontSize: 14, fontWeight: 600, color: color.muted, ...tabular}}>
                        {t.live && pts != null ? `(${pts})` : ""}
                      </Box>
                      <Box component="span" aria-hidden sx={{textAlign: "right", fontFamily: font.display, fontSize: 26, fontWeight: 800, ...tabular}}>
                        {bye && k ? "" : notStarted ? "–" : wins}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              {edit && (
                <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", pt: "8px"}}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => edit.onPair(t)}
                    aria-label={`Uredi par za stolom ${t.table}`}
                    sx={{...action, border: `1.5px solid ${color.borderControl}`, color: color.navy}}
                  >
                    <SwapHorizRoundedIcon aria-hidden />
                    Uredi par
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => edit.onRemove(t)}
                    aria-label={`Ukloni stol ${t.table}`}
                    sx={{...action, border: `1.5px solid ${tint.red[35]}`, color: color.red}}
                  >
                    <DeleteRoundedIcon aria-hidden />
                    Ukloni stol
                  </Box>
                </Box>
              )}
            </Card>
          );
        })}
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
  const label = `Stol ${t.table}${t.smoking ? ", pušački" : ""}: ${t.teamA} ${t.winsA} : ${t.winsB} ${t.teamB}${t.live ? `, uživo ${t.pointsA ?? 0} – ${t.pointsB ?? 0}` : ""}`;
  if (confirm) {
    return (
      <Box
        component="li"
        sx={{height: TABLE_ROW_HEIGHT, display: "flex", alignItems: "center", gap: "6px", pl: dense ? "12px" : "18px", pr: "8px", borderBottom: `1px solid ${color.divider}`, background: tint.red[8]}}
      >
        {confirm}
      </Box>
    );
  }
  const rowSx = {
    height: TABLE_ROW_HEIGHT,
    display: "grid",
    gridTemplateColumns: dense
      ? `32px minmax(0,1fr) 66px minmax(0,1fr) ${actions ? "72px" : "52px"}`
      : `40px minmax(0,1fr) 84px minmax(0,1fr) ${actions ? "76px" : "64px"}`,
    alignItems: "center",
    gap: dense ? "6px" : "10px",
    px: dense ? "12px" : "18px",
    borderBottom: `1px solid ${color.divider}`,
    // the player's own table: the standings' cream row with the navy bar
    background: fresh ? color.cream2 : t.mine ? color.cream2 : "transparent",
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
        sx={{position: "relative", height: 28, borderRadius: "8px", background: fresh ? color.navy : color.paper, color: fresh ? color.white : color.navy, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}
      >
        {t.table}
        {/* a smoking table: the cream mark on the number's corner */}
        {t.smoking && <SmokingMark variant="badge" sx={{position: "absolute", top: -6, right: -7}} />}
      </Box>
      {/* the dots sit next to the score, so they line up down the column */}
      <TeamLabel name={t.teamA} conference={t.conferenceA} end hidden sx={{fontSize: font1, fontWeight: !t.live && t.winsA > t.winsB ? 700 : 500}} />
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
      <TeamLabel name={t.teamB} conference={t.conferenceB} hidden sx={{fontSize: font1, fontWeight: !t.live && t.winsB > t.winsA ? 700 : 500}} />
    </>
  );
  const status = (
    <Box
      component="span"
      aria-hidden
      sx={{display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "5px", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: t.live ? color.red : color.muted}}
    >
      {t.live && (
        <>
          <LiveDot size={7} />
          UŽIVO
        </>
      )}
    </Box>
  );

  if (href) {
    return (
      <Box component="li">
        <Box component={TransitionLink} href={href} aria-label={`${label}. Otvori stol`} sx={{...rowSx, "&:hover": {background: color.paper2}}}>
          {cells}
          {status}
        </Box>
      </Box>
    );
  }
  return (
    <Box component="li" aria-label={label} onClick={onOpen} sx={onOpen ? {...rowSx, cursor: "pointer", "&:hover": {background: fresh ? color.cream2 : color.paper2}} : rowSx}>
      {cells}
      {actions ?? status}
    </Box>
  );
}
