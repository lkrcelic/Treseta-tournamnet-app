"use client";

import {NightSplit, SplitMove, SplitTeam} from "@/app/_interfaces/split";
import {copyText, Slot, splitByConference, swapSlots} from "@/app/_lib/locations";
import {NightLocation} from "@/app/_lib/nights";
import {count, NOUN} from "@/app/_lib/ui/text";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ellipsis, mergeSx, TeamDot} from "@/app/_ui/sp";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Popover, SxProps, Theme} from "@mui/material";
import React, {useEffect, useRef, useState} from "react";

// The parts Podjela shares on the computer and the phone (Claude Design 05 A): a team's card, dragging it to a place,
// the menu that moves it, and the three buttons over the columns.

// Where a team can be dropped: Neraspoređene (0) or a place of the night
export type DropTarget = 0 | Slot;
const targetOf = (slot: Slot | null): DropTarget => slot ?? 0;

// What marks an element as a place to drop a team on
export const dropZone = (target: DropTarget) => ({"data-split-drop": String(target)});

function targetAt(x: number, y: number): DropTarget | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const v = el instanceof HTMLElement ? el.dataset.splitDrop : undefined;
    if (v === "0" || v === "1" || v === "2") return Number(v) as DropTarget;
  }
  return null;
}

type Drag = {team: SplitTeam; from: DropTarget; x: number; y: number; dx: number; dy: number; width: number; over: DropTarget | null};

// Dragging a team's card onto a column (or the phone's place). The mouse drags the whole card; a finger only its handle,
// so the rest of the card still scrolls the list. A press that doesn't move is a click (the menu). The pointer is
// followed on the window, so a quick drag that leaves the card at once still drags.
export function useTeamDrag(onDrop: (team: SplitTeam, to: DropTarget) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const drop = useRef(onDrop);
  drop.current = onDrop;
  // stops following the pointer (a press under way)
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  // a drag just ended: the click that follows isn't one
  const dragged = useRef(false);

  const cardProps = (team: SplitTeam) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if (e.pointerType !== "mouse" && !(e.target as HTMLElement).closest("[data-drag-handle]")) return;
      // no text selection while the mouse drags
      if (e.pointerType === "mouse") e.preventDefault();
      stop.current?.();
      dragged.current = false;
      const id = e.pointerId;
      const from = targetOf(team.slot);
      const rect = e.currentTarget.getBoundingClientRect();
      const x0 = e.clientX;
      const y0 = e.clientY;
      let dragging = false;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        if (!dragging && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        dragging = true;
        ev.preventDefault();
        setDrag({team, from, x: ev.clientX, y: ev.clientY, dx: x0 - rect.left, dy: y0 - rect.top, width: rect.width, over: targetAt(ev.clientX, ev.clientY)});
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        end();
        if (!dragging) return;
        dragged.current = true;
        const to = targetAt(ev.clientX, ev.clientY);
        if (to != null && to !== from) drop.current(team, to);
      };
      const cancel = (ev: PointerEvent) => {
        if (ev.pointerId === id) end();
      };
      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        stop.current = null;
        setDrag(null);
      };
      window.addEventListener("pointermove", move, {passive: false});
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      stop.current = end;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!dragged.current) return;
      dragged.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  });

  return {drag, cardProps};
}

// The card that follows the pointer while a team is dragged
export function DragGhost({drag, dot}: {drag: Drag | null; dot: (t: SplitTeam) => string | null}) {
  if (!drag) return null;
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        left: drag.x - drag.dx,
        top: drag.y - drag.dy,
        width: drag.width,
        zIndex: 1500,
        pointerEvents: "none",
        transform: "rotate(-3deg)",
        ...cardSx,
        boxShadow: `${shadow.panel}, 0 0 0 2px ${color.navy}`,
      }}
    >
      <HandleIcon />
      <CardName team={drag.team} dot={dot(drag.team)} />
    </Box>
  );
}

const cardSx = {
  minHeight: 46,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  pl: "4px",
  pr: "10px",
  borderRadius: "13px",
  background: color.white,
  boxShadow: shadow.raised,
  userSelect: "none",
  WebkitUserSelect: "none",
} as const;

function HandleIcon() {
  return (
    <Box component="span" data-drag-handle sx={{width: 30, height: 40, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: color.faint, touchAction: "none", cursor: "grab", "& svg": {fontSize: 20}}}>
      <DragIndicatorRoundedIcon aria-hidden />
    </Box>
  );
}

function CardName({team, dot}: {team: SplitTeam; dot: string | null}) {
  return (
    <>
      {dot && <TeamDot color={dot} size={9} />}
      <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: color.ink, ...ellipsis}}>
        {team.name}
      </Box>
      {!team.active && (
        <Box component="span" sx={{flex: "none", fontSize: 11.5, color: color.muted}}>
          neaktivna
        </Box>
      )}
    </>
  );
}

// A team's card: its handle, its conference dot and name ("neaktivna" for an inactive team). While it is dragged it
// stays where it was, dashed ("… · premješta se"). onOpen: a click opens the move menu (the computer: the whole card;
// the phone: the arrow at its end, moveButton).
export function TeamCard({
  team,
  dot,
  drag,
  where,
  onOpen,
  moveButton = false,
  height = 46,
}: {
  team: SplitTeam;
  dot: string | null;
  drag: ReturnType<typeof useTeamDrag>;
  // where the team is now, for a screen reader
  where: string;
  onOpen: (anchor: HTMLElement) => void;
  moveButton?: boolean;
  height?: number;
}) {
  const moving = drag.drag?.team.team_id === team.team_id;
  if (moving) {
    return (
      <Box
        {...drag.cardProps(team)}
        sx={{minHeight: height, display: "flex", alignItems: "center", px: "12px", borderRadius: "13px", border: `2px dashed ${tint.navy[25]}`, fontSize: 13, color: color.muted, userSelect: "none", ...ellipsis}}
      >
        {team.name} · premješta se
      </Box>
    );
  }
  const open = (e: React.SyntheticEvent<HTMLElement>) => onOpen(e.currentTarget);
  return (
    <Box
      {...drag.cardProps(team)}
      {...(!moveButton && {
        role: "button",
        tabIndex: 0,
        "aria-haspopup": "menu" as const,
        "aria-label": `${team.name}, ${where}. Premjesti`,
        onClick: open,
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          open(e);
        },
      })}
      sx={{
        ...cardSx,
        minHeight: height,
        opacity: team.active ? 1 : 0.65,
        ...(!moveButton && {cursor: "grab", "&:hover": {boxShadow: shadow.cardHover}, "&:focus-visible": {outline: `2px solid ${color.navy}`, outlineOffset: "2px"}}),
        ...(!team.active && {boxShadow: `inset 0 0 0 1px ${tint.navy[12]}`}),
      }}
    >
      <HandleIcon />
      <CardName team={team} dot={dot} />
      {moveButton && (
        <Box
          component="button"
          type="button"
          aria-haspopup="menu"
          aria-label={`Premjesti ${team.name} (${where})`}
          onClick={open}
          sx={{...buttonBase, width: 34, height: 34, flex: "none", borderRadius: "10px", background: color.lineFill, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 18}}}
        >
          <SwapHorizRoundedIcon aria-hidden />
        </Box>
      )}
    </Box>
  );
}

// "Napolitanke idu na": the night's places with their counts and, for a team that has a place, Neraspoređene; the
// team's own place isn't offered
export function MoveMenu({
  team,
  anchor,
  places,
  counts,
  onPick,
  onClose,
}: {
  team: SplitTeam | null;
  anchor: HTMLElement | null;
  places: [NightLocation, NightLocation];
  counts: [number, number];
  onPick: (team: SplitTeam, slot: Slot | null) => void;
  onClose: () => void;
}) {
  const options: {slot: Slot | null; label: string; count: number | null}[] = [
    {slot: 1 as Slot, label: places[0].name, count: counts[0]},
    {slot: 2 as Slot, label: places[1].name, count: counts[1]},
    {slot: null, label: "Neraspoređene", count: null},
  ].filter((o) => team != null && o.slot !== team.slot);
  return (
    <Popover
      open={team != null && anchor != null}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{vertical: "bottom", horizontal: "right"}}
      transformOrigin={{vertical: "top", horizontal: "right"}}
      slotProps={{paper: {sx: {mt: "6px", width: 230, p: "6px", borderRadius: "16px", boxShadow: shadow.popover}}}}
    >
      <Box sx={{p: "8px 10px 6px", fontSize: 12, fontWeight: 700, color: color.muted, ...ellipsis}}>{team?.name} idu na</Box>
      <Box role="menu" aria-label={`${team?.name ?? ""} idu na`}>
        {options.map((o) => (
          <Box
            key={o.slot ?? 0}
            component="button"
            type="button"
            role="menuitem"
            onClick={() => team && onPick(team, o.slot)}
            sx={{
              ...buttonBase,
              width: "100%",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              p: "10px",
              borderRadius: "10px",
              fontSize: 14.5,
              fontWeight: 700,
              color: color.ink,
              textAlign: "left",
              "&:hover, &:focus-visible": {background: tint.navy[8]},
              "& svg": {fontSize: 20, color: color.navy, flex: "none"},
            }}
          >
            {o.slot ? <PlaceRoundedIcon aria-hidden /> : <GroupsRoundedIcon aria-hidden />}
            <Box component="span" sx={{flex: 1, minWidth: 0, ...ellipsis}}>
              {o.label}
            </Box>
            {o.count != null && (
              <Box component="span" sx={{fontSize: 12, fontWeight: 600, color: color.muted}}>
                {o.count}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Popover>
  );
}

// The team's conference color (null: no dot)
export function useDots(split: NightSplit | null) {
  const colors = new Map((split?.conferences ?? []).map((c) => [c.conference_id, c.color]));
  return (t: SplitTeam) => (t.conference_id != null ? (colors.get(t.conference_id) ?? null) : null);
}

// How many teams each place has
export function placeCounts(split: NightSplit): [number, number] {
  return [split.teams.filter((t) => t.slot === 1).length, split.teams.filter((t) => t.slot === 2).length];
}

// "8 ekipa"
export const teamsLabel = (n: number) => count(n, NOUN.ekipa);

// Podijeli po konferencijama (only with exactly two conferences), Zamijeni lokacije (once a team has a place) and Kopiraj
// raspored (the plain text of copyText; "Kopirano" for a moment)
export function useSplitActions(split: NightSplit | null, move: (moves: SplitMove[]) => Promise<void>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const canByConference = split != null && split.conferences.length === 2;
  const canSwap = split != null && split.teams.some((t) => t.slot != null);

  const byConference = () => {
    const placed = split ? splitByConference(split.teams, split.conferences) : null;
    if (placed) void move(Array.from(placed, ([team_id, slot]) => ({team_id, slot})));
  };
  const swap = () => {
    if (!split) return;
    const assigned = new Map(split.teams.flatMap((t) => (t.slot ? [[t.team_id, t.slot] as [number, Slot]] : [])));
    void move(Array.from(swapSlots(assigned), ([team_id, slot]) => ({team_id, slot})));
  };
  const copy = async () => {
    if (!split?.places) return;
    const places = split.places;
    const text = copyText(places.map((p, i) => ({name: p.name, teams: split.teams.filter((t) => t.slot === i + 1).map((t) => t.name)})));
    if (!(await writeClipboard(text))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  return {canByConference, canSwap, byConference, swap, copy, copied};
}

// The clipboard, or (without it: an http page) a hidden text field copied the old way; whether it was copied
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

// The gold count of teams without a place
export function UnassignedCount({n, sx}: {n: number; sx?: SxProps<Theme>}) {
  return (
    <Box component="span" sx={mergeSx({height: 24, minWidth: 24, px: "8px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: n ? color.gold : color.lineFill, color: n ? color.ink : color.muted, fontSize: 12, fontWeight: 700}, sx)}>
      {n}
    </Box>
  );
}

// A place with no team yet
export function EmptyPlace() {
  return (
    <Box sx={{flex: 1, minHeight: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", p: "16px", fontSize: 14, color: color.muted, "& svg": {fontSize: 28, color: color.faint}}}>
      <GroupsRoundedIcon aria-hidden />
      Još nema ekipa
    </Box>
  );
}

// The teams who left a place where they are in a Skica, with ×
export function SplitWarnings({warnings, onClose}: {warnings: string[]; onClose: () => void}) {
  if (!warnings.length) return null;
  return (
    <Box role="status" sx={{flex: "none", display: "flex", alignItems: "flex-start", gap: "10px", p: "12px 8px 12px 14px", borderRadius: "16px", background: color.cream, color: color.ink, fontSize: 14, lineHeight: 1.45, "& > svg": {fontSize: 22, color: color.navy, flex: "none", mt: "1px"}}}>
      <WarningRoundedIcon aria-hidden />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
        {warnings.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </Box>
      <Box
        component="button"
        type="button"
        aria-label="Zatvori upozorenje"
        onClick={onClose}
        sx={{...buttonBase, width: 32, height: 32, flex: "none", borderRadius: "10px", color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "&:hover": {background: tint.navy[8]}, "& svg": {fontSize: 20}}}
      >
        <CloseRoundedIcon />
      </Box>
    </Box>
  );
}

// The display font's heading of a column or a section
export const columnTitleSx = {fontFamily: font.display, fontWeight: 800, color: color.ink} as const;
