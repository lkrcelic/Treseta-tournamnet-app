"use client";

import {addTableAPI, removeTableAPI, setTablePairAPI} from "@/app/_fetchers/admin/daily";
import {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import {TableRow} from "@/app/_lib/ui/tables";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {matchesQuery} from "@/app/_lib/ui/text";
import {BottomSheet, buttonBase, ellipsis, ErrorNote, OutlineButton, SearchInput, SolidButton} from "@/app/_ui/sp";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import React, {useId, useRef, useState} from "react";

// Admin editing of a round's tables on Dnevni poredak (the desktop's edit mode, and the pair sheet of the admin's phone)

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
      sx={{...pill, background: editing ? color.navy : color.white, color: editing ? color.white : color.navy, boxShadow: shadow.card}}
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
        }} aria-label={`Ukloni stol ${t.table}`} sx={{...iconBtn, color: color.red, "&:hover": {background: tint.red[10]}}}>
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
      <Box component="button" type="button" onClick={onCancel} sx={{...small, border: `1.5px solid ${tint.navy[25]}`, background: color.white, color: color.navy}}>
        Odustani
      </Box>
      <Box component="button" type="button" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} sx={{...small, background: color.red, color: color.white}}>
        Ukloni
      </Box>
    </>
  );
}

// Where a round's tables are edited (a night of a league), and what to reload after a change
export type RoundAdmin = {leagueId: number; date: string; roundNumber: number; onChanged: () => void};

// The edit actions of a round's tables, for the desktop's edit mode and the admin's phone: the pair being edited (or
// the new table), the table asked to be removed, and the calls. freshTable: the number of the table added last.
export function useTableEdits(admin: RoundAdmin | null) {
  const [pair, setPair] = useState<PairTarget | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [freshTable, setFreshTable] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (id: number) => {
    if (!admin) return;
    setRemoving(true);
    setActionError(null);
    try {
      await removeTableAPI(id);
      setConfirmId(null);
      admin.onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Stol nije uklonjen.");
    }
    setRemoving(false);
  };
  const savePair = async (team1Id: number, team2Id: number) => {
    if (!admin || !pair) return;
    if (pair.kind === "edit") await setTablePairAPI(pair.row.id, team1Id, team2Id);
    else {
      await addTableAPI(admin.leagueId, admin.date, admin.roundNumber, team1Id, team2Id);
      setFreshTable(pair.tableNumber);
    }
    setPair(null);
    admin.onChanged();
  };
  const reset = () => {
    setConfirmId(null);
    setFreshTable(null);
    setActionError(null);
  };
  return {pair, setPair, confirmId, setConfirmId, removing, remove, savePair, freshTable, actionError, setActionError, reset};
}

type Note = {kind: "info" | "swap" | "warn" | "error"; text: string};

const NOTE_STYLE: Record<Note["kind"], {bg: string; ink: string; icon: React.ReactNode}> = {
  info: {bg: color.paper, ink: color.navy, icon: <InfoRoundedIcon />},
  swap: {bg: tint.gold[16], ink: color.medal[0], icon: <SwapHorizRoundedIcon />},
  warn: {bg: tint.red[10], ink: color.red, icon: <WarningRoundedIcon />},
  error: {bg: tint.red[10], ink: color.red, icon: <ErrorRoundedIcon />},
};

export type PairTarget = {kind: "edit"; row: TableRow} | {kind: "new"; tableNumber: number};

// A team that can be seated: its name, and "stol 4" when it sits at another table of the round
type PairOption = {id: number; name: string; sub?: string};

// Seating two teams at a table (edit) or adding a table (new), for the desktop dialog and the phone sheet. Picking a
// team that sits at another table swaps it with the team it replaces; a table where something was played loses those
// hands. A new table lists only the teams that don't play in the round.
function usePairForm(target: PairTarget, rows: TableRow[], teams: LeagueTeam[], onSave: (team1Id: number, team2Id: number) => Promise<void>) {
  const isNew = target.kind === "new";
  const row = target.kind === "edit" ? target.row : null;
  const [a, setA] = useState<number | "">(row ? row.teamAId : "");
  const [b, setB] = useState<number | "">(row ? row.teamBId : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seatOf = (id: number) => rows.find((r) => r.teamAId === id || r.teamBId === id);
  const nameOf = (id: number) => teams.find((t) => t.id === id)?.name ?? rows.flatMap((r) => [[r.teamAId, r.teamA], [r.teamBId, r.teamB]] as [number, string][]).find(([tid]) => tid === id)?.[1] ?? `#${id}`;

  // league teams, plus the table's own teams when they aren't (any more) on the list, e.g. the bye
  const known = new Map(teams.map((t) => [t.id, t.name]));
  if (row) {
    if (!known.has(row.teamAId)) known.set(row.teamAId, row.teamA);
    if (!known.has(row.teamBId)) known.set(row.teamBId, row.teamB);
  }
  const options: PairOption[] = Array.from(known, ([id, name]) => ({id, name}))
    .filter((o) => !isNew || !seatOf(o.id))
    .sort((x, y) => x.name.localeCompare(y.name, "hr"))
    .map((o) => {
      const seat = seatOf(o.id);
      return seat && seat.id !== row?.id ? {...o, sub: `stol ${seat.table}`} : o;
    });

  const notes: Note[] = [];
  if (isNew) notes.push({kind: "info", text: "Prikazane su samo ekipe koje ne igraju u ovom kolu."});
  if (row) {
    const changed = a !== row.teamAId || b !== row.teamBId;
    ([[a, row.teamA], [b, row.teamB]] as const).forEach(([id, old]) => {
      if (id === "") return;
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

  return {isNew, row, a, setA, b, setB, options, notes, ok, save, saving, error};
}

function PairNotes({notes}: {notes: Note[]}) {
  return (
    <>
      {notes.map((n, i) => (
        <Box
          key={i}
          role={n.kind === "error" || n.kind === "warn" ? "alert" : undefined}
          sx={{flex: "none", display: "flex", alignItems: "flex-start", gap: "10px", p: "12px 14px", borderRadius: "14px", background: NOTE_STYLE[n.kind].bg, fontSize: 14, lineHeight: 1.4, color: color.ink, "& svg": {fontSize: 20, color: NOTE_STYLE[n.kind].ink, flex: "none"}}}
        >
          {NOTE_STYLE[n.kind].icon}
          {n.text}
        </Box>
      ))}
    </>
  );
}

// A team picked by searching (no drop-down list of every team): the field shows the picked team; on focus it lists
// every option under it, typing narrows them, and a click (or Enter on the highlighted one) picks it
function TeamPickField({label, value, options, onPick}: {label: string; value: number | ""; options: PairOption[]; onPick: (id: number) => void}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const closeTimer = useRef<number | undefined>(undefined);
  const picked = options.find((o) => o.id === value);
  const hits = open ? options.filter((o) => matchesQuery(o.name, query ?? "")) : [];
  const pick = (o: PairOption) => {
    window.clearTimeout(closeTimer.current);
    onPick(o.id);
    setQuery(null);
    setOpen(false);
  };
  return (
    <Box sx={{position: "relative", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
      <Box component="label" htmlFor={id} sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
        {label}
      </Box>
      <Box sx={{position: "relative"}}>
        <SearchRoundedIcon aria-hidden sx={{position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: 22, color: open ? color.navy : color.muted, pointerEvents: "none"}} />
        <Box
          component="input"
          id={id}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="Traži ekipu"
          value={query ?? picked?.name ?? ""}
          onFocus={() => {
            window.clearTimeout(closeTimer.current);
            setQuery("");
            setHi(0);
            setOpen(true);
          }}
          onBlur={() => {
            // a click on a hit lands first
            closeTimer.current = window.setTimeout(() => {
              setOpen(false);
              setQuery(null);
            }, 160);
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setHi(0);
            setOpen(true);
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, hits.length - 1));
            else if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
            else if (e.key === "Enter" && hits[hi]) pick(hits[hi]);
            else if (e.key === "Escape" && open) {
              e.stopPropagation();
              setOpen(false);
              setQuery(null);
            } else return;
            e.preventDefault();
          }}
          sx={{
            width: "100%",
            height: 52,
            boxSizing: "border-box",
            borderRadius: "14px",
            border: `1.5px solid ${open ? color.navy : color.border}`,
            background: color.paper2,
            pl: "42px",
            pr: "12px",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 600,
            color: color.ink,
            outline: "none",
            "&:focus-visible": {boxShadow: shadow.focus},
            "&::placeholder": {color: color.muted, fontWeight: 500},
          }}
        />
      </Box>
      <Box
        component="ul"
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={hits.length === 0}
        sx={{position: "absolute", top: "100%", left: 0, right: 0, zIndex: 2, mt: "6px", listStyle: "none", p: "6px", m: 0, maxHeight: 248, overflowY: "auto", borderRadius: "14px", background: color.white, boxShadow: shadow.popover}}
      >
        {hits.map((o, i) => (
          <Box
            component="li"
            key={o.id}
            role="option"
            aria-selected={o.id === value}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            onClick={() => pick(o)}
            onMouseEnter={() => setHi(i)}
            sx={{minHeight: 44, display: "flex", alignItems: "center", gap: "8px", px: "10px", borderRadius: "10px", cursor: "pointer", background: i === hi ? color.paper : "transparent", fontSize: 15, fontWeight: 600}}
          >
            <Box component="span" sx={{flex: 1, minWidth: 0, ...ellipsis}}>
              {o.name}
            </Box>
            {o.sub && (
              <Box component="span" sx={{flex: "none", fontSize: 13, fontWeight: 600, color: color.muted}}>
                {o.sub}
              </Box>
            )}
            {o.id === value && <CheckRoundedIcon aria-hidden sx={{fontSize: 20, color: color.navy}} />}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// Desktop: Stol 4 · uredi par / Novi stol 11
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
  const f = usePairForm(target, rows, teams, onSave);
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 560, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog, overflow: "visible"}}}
    >
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>{roundLabel}</Box>
        <Box component="h2" id={titleId} sx={{m: 0, display: "flex", alignItems: "center", gap: "10px", fontFamily: font.display, fontSize: 28, fontWeight: 800, letterSpacing: "-.01em"}}>
          {f.isNew ? `Novi stol ${(target as {tableNumber: number}).tableNumber}` : `Stol ${f.row!.table} · uredi par`}
          {/* the table stays a smoking table whoever sits at it */}
          {!f.isNew && f.row!.smoking && <SmokingMark />}
        </Box>
      </Box>
      <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) 36px minmax(0,1fr)", gap: "8px", alignItems: "end"}}>
        <TeamPickField label="Ekipa A" value={f.a} options={f.options} onPick={f.setA} />
        <Box aria-hidden sx={{height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: color.faint}}>
          vs
        </Box>
        <TeamPickField label="Ekipa B" value={f.b} options={f.options} onPick={f.setB} />
      </Box>
      <PairNotes notes={f.notes} />
      {f.error && <ErrorNote>{f.error}</ErrorNote>}
      <Box sx={{display: "flex", gap: "10px", pt: "4px"}}>
        <OutlineButton height={52} onClick={onClose} sx={{flex: 1, fontSize: 16, border: `1.5px solid ${tint.navy[25]}`}}>
          Odustani
        </OutlineButton>
        <SolidButton height={52} onClick={f.save} disabled={!f.ok} loading={f.saving} sx={{flex: 1, fontSize: 16}}>
          {f.isNew ? "Dodaj stol" : "Spremi par"}
        </SolidButton>
      </Box>
    </Dialog>
  );
}

// Phone (admin-mobile 21): the same in a bottom sheet. A team field opens the sheet's picking view: the teams in a list
// that scrolls, and the search last, right above the keyboard.
export function PairSheet({
  target,
  rows,
  teams,
  onClose,
  onSave,
}: {
  target: PairTarget;
  rows: TableRow[];
  teams: LeagueTeam[];
  onClose: () => void;
  onSave: (team1Id: number, team2Id: number) => Promise<void>;
}) {
  const f = usePairForm(target, rows, teams, onSave);
  const [picking, setPicking] = useState<0 | 1 | null>(null);
  const [query, setQuery] = useState("");
  const title = f.isNew ? "Novi stol" : `Stol ${f.row!.table} · uredi par`;
  const value = [f.a, f.b] as const;
  const set = [f.setA, f.setB] as const;
  const hits = f.options.filter((o) => matchesQuery(o.name, query));
  const nameOf = (id: number | "") => f.options.find((o) => o.id === id)?.name ?? null;

  if (picking != null) {
    return (
      <BottomSheet open onClose={() => setPicking(null)} title={`Ekipa ${picking + 1}`} closable tall>
        <Box component="ul" aria-label="Ekipe" sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", listStyle: "none", m: 0, p: 0, borderRadius: "16px", background: color.paper2}}>
          {hits.length === 0 ? (
            <Box component="li" sx={{p: "18px 16px", fontSize: 15, color: color.muted}}>
              Nijedna ekipa ne odgovara pretrazi.
            </Box>
          ) : (
            hits.map((o) => {
              const on = o.id === value[picking];
              return (
                <Box component="li" key={o.id} sx={{borderBottom: `1px solid ${color.line}`}}>
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      set[picking](o.id);
                      setPicking(null);
                      setQuery("");
                    }}
                    sx={{...buttonBase, width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: "10px", px: "16px", textAlign: "left", fontSize: 16, fontWeight: 600, color: color.ink}}
                  >
                    <Box component="span" sx={{flex: 1, minWidth: 0, ...ellipsis}}>
                      {o.name}
                    </Box>
                    {o.sub && (
                      <Box component="span" sx={{flex: "none", fontSize: 13, color: color.muted}}>
                        {o.sub}
                      </Box>
                    )}
                    {on && <CheckRoundedIcon aria-hidden sx={{fontSize: 22, color: color.navy}} />}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
        <SearchInput variant="paper" height={52} placeholder="Traži ekipu" aria-label="Traži ekipu" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} enterKeyHint="search" autoFocus />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={title} closable busy={f.saving}>
      {([0, 1] as const).map((i) => (
        <Box key={i} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px"}}>
          <Box component="span" id={`pair-label-${i}`} sx={{fontSize: 14, fontWeight: 600, color: i ? color.red : color.green, pl: "2px"}}>
            Ekipa {i + 1}
          </Box>
          <Box
            component="button"
            type="button"
            aria-labelledby={`pair-label-${i}`}
            aria-haspopup="dialog"
            onClick={() => setPicking(i)}
            sx={{
              ...buttonBase,
              height: 56,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              px: "14px",
              borderRadius: "16px",
              border: `1.5px solid ${color.border}`,
              background: color.white,
              textAlign: "left",
              fontSize: 17,
              fontWeight: 600,
              color: nameOf(value[i]) ? color.ink : color.muted,
              "& svg": {fontSize: 24, color: color.muted, flex: "none"},
            }}
          >
            <SearchRoundedIcon aria-hidden />
            <Box component="span" sx={{flex: 1, minWidth: 0, ...ellipsis}}>
              {nameOf(value[i]) ?? "Odaberi ekipu"}
            </Box>
          </Box>
        </Box>
      ))}
      {f.notes.length ? (
        <PairNotes notes={f.notes} />
      ) : (
        <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
          Ako ekipa već igra za drugim stolom, ta dva stola zamijene ekipe.
        </Box>
      )}
      {f.error && <ErrorNote>{f.error}</ErrorNote>}
      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
        <OutlineButton height={54} onClick={onClose} disabled={f.saving} sx={{fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
          Odustani
        </OutlineButton>
        <SolidButton height={54} onClick={f.save} disabled={!f.ok} loading={f.saving} sx={{fontSize: 16}}>
          {f.isNew ? "Dodaj stol" : "Spremi"}
        </SolidButton>
      </Box>
    </BottomSheet>
  );
}
