"use client";

import {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import {TableRow} from "@/app/_lib/ui/tables";
import {color, font, shadow} from "@/app/_styles/tokens";
import {buttonBase, ellipsis, ErrorNote, OutlineButton, SolidButton} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import React, {useId, useState} from "react";

// Admin editing of a round's tables on the desktop Daily screen

const pill = {
  ...buttonBase,
  height: 44,
  pl: "12px",
  pr: "16px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: 14,
  fontWeight: 700,
  whiteSpace: "nowrap",
  "& svg": {fontSize: 20},
} as const;

export function EditToggle({editing, onClick}: {editing: boolean; onClick: () => void}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={editing}
      sx={{...pill, background: editing ? color.navy : color.card, color: editing ? "#FFFFFF" : color.navy, boxShadow: shadow.card}}
    >
      {editing ? <CheckRoundedIcon /> : <EditRoundedIcon />}
      {editing ? "Završi uređivanje" : "Uredi stolove"}
    </Box>
  );
}

export function NewTableButton({onClick}: {onClick: () => void}) {
  return (
    <Box component="button" type="button" onClick={onClick} sx={{...pill, background: color.cream, color: color.navy, "& svg": {fontSize: 22}}}>
      <AddRoundedIcon />
      Novi stol
    </Box>
  );
}

const iconBtn = {
  ...buttonBase,
  width: 34,
  height: 34,
  flex: "none",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "& svg": {fontSize: 20},
} as const;

export function RowActions({t, onEdit, onRemove}: {t: TableRow; onEdit: () => void; onRemove: () => void}) {
  return (
    <Box component="span" sx={{display: "flex", justifyContent: "flex-end", gap: "2px"}}>
      <Box component="button" type="button" onClick={(e: React.MouseEvent) => {
          // the row itself also opens the pair; one dialog is enough
          e.stopPropagation();
          onEdit();
        }} aria-label={`Uredi par za stolom ${t.table}`} sx={{...iconBtn, color: color.navy, "&:hover": {background: color.paper}}}>
        <EditRoundedIcon />
      </Box>
      <Box component="button" type="button" onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onRemove();
        }} aria-label={`Ukloni stol ${t.table}`} sx={{...iconBtn, color: color.red, "&:hover": {background: "rgba(188,71,73,.1)"}}}>
        <DeleteRoundedIcon />
      </Box>
    </Box>
  );
}

export function ConfirmRemove({t, busy, onCancel, onConfirm}: {t: TableRow; busy: boolean; onCancel: () => void; onConfirm: () => void}) {
  const small = {...buttonBase, height: 34, px: "12px", borderRadius: "10px", fontSize: 13, fontWeight: 600, flex: "none"} as const;
  return (
    <>
      <Box component="span" role="alert" sx={{flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: color.red, ...ellipsis}}>
        Ukloniti stol {t.table}?{t.started ? " Odigrane igre se brišu." : ""}
      </Box>
      <Box component="button" type="button" onClick={onCancel} sx={{...small, border: `1.5px solid rgba(60,74,103,.25)`, background: color.card, color: color.navy}}>
        Odustani
      </Box>
      <Box component="button" type="button" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} sx={{...small, background: color.red, color: "#FFFFFF"}}>
        Ukloni
      </Box>
    </>
  );
}

type Note = {kind: "info" | "swap" | "warn" | "error"; text: string};

const NOTE_STYLE: Record<Note["kind"], {bg: string; ink: string; icon: React.ReactNode}> = {
  info: {bg: color.paper, ink: color.navy, icon: <InfoRoundedIcon />},
  swap: {bg: "rgba(212,168,44,.16)", ink: color.medal[0], icon: <SwapHorizRoundedIcon />},
  warn: {bg: "rgba(188,71,73,.1)", ink: color.red, icon: <WarningRoundedIcon />},
  error: {bg: "rgba(188,71,73,.1)", ink: color.red, icon: <ErrorRoundedIcon />},
};

export type PairTarget = {kind: "edit"; row: TableRow} | {kind: "new"; tableNumber: number};

// Seat two teams at a table (edit) or add a table (new). Picking a team that sits at another table swaps it with
// the team it replaces; a table where something was played loses those hands.
export function PairDialog({
  target,
  rows,
  teams,
  roundLabel,
  onClose,
  onSave,
}: {
  target: PairTarget;
  rows: TableRow[];
  teams: LeagueTeam[];
  roundLabel: string;
  onClose: () => void;
  onSave: (team1Id: number, team2Id: number) => Promise<void>;
}) {
  const isNew = target.kind === "new";
  const row = target.kind === "edit" ? target.row : null;
  const [a, setA] = useState<number | "">(row ? row.teamAId : "");
  const [b, setB] = useState<number | "">(row ? row.teamBId : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  const seatOf = (id: number) => rows.find((r) => r.teamAId === id || r.teamBId === id);
  const nameOf = (id: number) => teams.find((t) => t.id === id)?.name ?? rows.flatMap((r) => [[r.teamAId, r.teamA], [r.teamBId, r.teamB]] as [number, string][]).find(([tid]) => tid === id)?.[1] ?? `#${id}`;

  // league teams, plus the table's own teams when they aren't (any more) on the list, e.g. the bye
  const known = new Map(teams.map((t) => [t.id, t.name]));
  if (row) {
    if (!known.has(row.teamAId)) known.set(row.teamAId, row.teamA);
    if (!known.has(row.teamBId)) known.set(row.teamBId, row.teamB);
  }
  const options = Array.from(known, ([id, name]) => ({id, name}))
    .filter((o) => !isNew || !seatOf(o.id))
    .sort((x, y) => x.name.localeCompare(y.name, "hr"))
    .map((o) => {
      const seat = seatOf(o.id);
      return {...o, label: seat && seat.id !== row?.id ? `${o.name}  ·  stol ${seat.table}` : o.name};
    });

  const notes: Note[] = [];
  if (isNew) notes.push({kind: "info", text: "Prikazane su samo ekipe koje ne igraju u ovoj rundi."});
  if (row) {
    const changed = a !== row.teamAId || b !== row.teamBId;
    ([[a, row.teamA], [b, row.teamB]] as const).forEach(([id, old]) => {
      if (id === "" ) return;
      const seat = seatOf(id);
      if (seat && seat.id !== row.id) {
        notes.push({kind: "swap", text: `${nameOf(id)} igra za stolom ${seat.table}. Zamijenit će mjesto s ekipom ${old}.`});
        if (seat.started) notes.push({kind: "warn", text: `Za stolom ${seat.table} već se igralo. Te igre se brišu.`});
      }
    });
    if (changed && row.started) notes.push({kind: "warn", text: `Za stolom ${row.table} već se igralo. Promjena para briše te igre i mijenja poredak.`});
  }
  const same = a !== "" && a === b;
  if (same) notes.push({kind: "error", text: "Ekipa ne može igrati sama protiv sebe."});
  const unchanged = row != null && a === row.teamAId && b === row.teamBId;
  const ok = a !== "" && b !== "" && !same && !unchanged;

  const save = async () => {
    if (!ok || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(a as number, b as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
      setSaving(false);
    }
  };

  const select = (label: string, id: string, value: number | "", onChange: (v: number | "") => void) => (
    <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
      <Box component="label" htmlFor={id} sx={{fontSize: 14, fontWeight: 600, color: color.inkSoft, pl: "4px"}}>
        {label}
      </Box>
      <Box
        component="select"
        id={id}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        sx={{
          width: "100%",
          height: 52,
          borderRadius: "14px",
          border: `1.5px solid ${color.border}`,
          background: color.tableHead,
          px: "12px",
          fontFamily: "inherit",
          fontSize: 16,
          fontWeight: 600,
          color: color.ink,
          cursor: "pointer",
          "&:focus-visible": {outline: "none", borderColor: color.navy, boxShadow: "0 0 0 3px rgba(60,74,103,.18)"},
        }}
      >
        <option value="">Odaberi ekipu</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Box>
    </Box>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: "rgba(21,24,31,.32)"}}}}
      PaperProps={{sx: {width: 560, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 30px 80px rgba(21,24,31,.3)"}}}
    >
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>{roundLabel}</Box>
        <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, letterSpacing: "-.01em"}}>
          {isNew ? `Novi stol ${target.tableNumber}` : `Stol ${row!.table} · uredi par`}
        </Box>
      </Box>
      <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) 36px minmax(0,1fr)", gap: "8px", alignItems: "end"}}>
        {select("Ekipa A", `${titleId}-a`, a, setA)}
        <Box aria-hidden sx={{height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: color.placeholder}}>
          vs
        </Box>
        {select("Ekipa B", `${titleId}-b`, b, setB)}
      </Box>
      {notes.map((n, i) => (
        <Box
          key={i}
          role={n.kind === "error" || n.kind === "warn" ? "alert" : undefined}
          sx={{display: "flex", alignItems: "flex-start", gap: "10px", p: "12px 14px", borderRadius: "14px", background: NOTE_STYLE[n.kind].bg, fontSize: 14, lineHeight: 1.4, color: color.ink, "& svg": {fontSize: 20, color: NOTE_STYLE[n.kind].ink, flex: "none"}}}
        >
          {NOTE_STYLE[n.kind].icon}
          {n.text}
        </Box>
      ))}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "flex", gap: "10px", pt: "4px"}}>
        <OutlineButton height={52} onClick={onClose} sx={{flex: 1, fontSize: 16, border: `1.5px solid rgba(60,74,103,.25)`}}>
          Odustani
        </OutlineButton>
        <SolidButton height={52} onClick={save} disabled={!ok} loading={saving} sx={{flex: 1, fontSize: 16}}>
          {isNew ? "Dodaj stol" : "Spremi par"}
        </SolidButton>
      </Box>
    </Dialog>
  );
}
