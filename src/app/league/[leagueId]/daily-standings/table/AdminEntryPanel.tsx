"use client";

import {canSave, clearPoints, EntryState, setActive, switchMode, typeDigit} from "@/app/_lib/ui/adminEntry";
import {Side} from "@/app/_lib/game/scoring";
import {count, NOUN} from "@/app/_lib/ui/text";
import {color, font, shadow, teamColor, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ErrorNote, PrimaryButton, SHORT_WINDOW, tabular} from "@/app/_ui/sp";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import {Box} from "@mui/material";
import React, {useEffect, useRef} from "react";

const SIDES: Side[] = [1, 2];

// The right-hand panel of the admin scorepad: enter a new hand or change the selected one
export default function AdminEntryPanel({
  entry,
  onChange,
  names,
  title,
  editing,
  saving,
  error,
  onSave,
  onCancel,
  onDelete,
  finish,
}: {
  entry: EntryState;
  onChange: (s: EntryState) => void;
  names: [string, string];
  title: string;
  editing: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  // the selected match has a winner and can be finished (instead of saving hands)
  finish: {winner: string; color: string; onFinish: () => void; busy: boolean} | null;
}) {
  const custom = entry.mode === "man";
  const savable = canSave(entry);

  // number keys type points, Enter saves (when the focus is not in a text field)
  const latest = useRef({entry, onChange, onSave, savable});
  latest.current = {entry, onChange, onSave, savable};
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const {entry: s, onChange: change, onSave: save, savable: ok} = latest.current;
      if (/^[0-9]$/.test(e.key)) {
        change(typeDigit(s, Number(e.key)));
        e.preventDefault();
      } else if (e.key === "Enter" && t?.tagName !== "BUTTON" && ok) {
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const key = {
    ...buttonBase,
    borderRadius: "14px",
    background: color.paper,
    color: color.ink,
    fontFamily: font.display,
    fontSize: 26,
    fontWeight: 700,
    minHeight: 40,
    "&:active:not(:disabled)": {transform: "scale(.96)", background: color.lineFill},
    "&:disabled": {opacity: 0.35},
  } as const;
  const saveSx = {[SHORT_WINDOW]: {height: 48, borderRadius: "16px"}};
  const small = {...buttonBase, height: 36, px: "12px", borderRadius: "10px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", "& svg": {fontSize: 18}} as const;

  return (
    <Card
      component="section"
      aria-labelledby="admin-entry-title"
      sx={{
        minHeight: 0,
        borderRadius: "24px",
        p: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        overflowY: "auto",
        // a short window (1024×640): every row a little lower, so the whole panel, "Spremi igru" included, fits under
        // the header (the keys stay at least 40 px; with an error note it scrolls)
        [SHORT_WINDOW]: {p: "14px 16px", gap: "6px"},
      }}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
        <Box component="h2" id="admin-entry-title" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
          {title}
        </Box>
        <Box sx={{display: "flex", gap: "8px"}}>
          {editing && (
            <Box component="button" type="button" onClick={onDelete} disabled={saving} sx={{...small, pl: "8px", background: tint.red[10], color: color.red}}>
              <DeleteRoundedIcon />
              Obriši igru
            </Box>
          )}
          <Box component="button" type="button" onClick={onCancel} sx={{...small, background: color.paper, color: color.navy}}>
            {editing ? "Odustani" : "Poništi"}
          </Box>
        </Box>
      </Box>

      <Box role="radiogroup" aria-label="Način unosa" sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "4px", p: "4px", borderRadius: "14px", background: color.paper, [SHORT_WINDOW]: {p: "3px", borderRadius: "13px"}}}>
        {(
          [
            ["std", "Standardni unos", <StyleRoundedIcon key="i" />],
            ["man", "Ručni unos", <EditNoteRoundedIcon key="i" />],
          ] as const
        ).map(([mode, label, icon]) => {
          const on = entry.mode === mode;
          return (
            <Box
              key={mode}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(switchMode(entry, mode))}
              sx={{
                ...buttonBase,
                height: 40,
                borderRadius: "11px",
                [SHORT_WINDOW]: {height: 32, borderRadius: "10px"},
                background: on ? color.white : "transparent",
                color: on ? color.ink : color.ink2,
                boxShadow: on ? shadow.segment : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: 14,
                fontWeight: 600,
                "& svg": {fontSize: 18},
              }}
            >
              {icon}
              {label}
            </Box>
          );
        })}
      </Box>

      <Box sx={{display: "flex", alignItems: "flex-start", gap: "10px", p: "10px 12px", borderRadius: "12px", background: tint.navy[7], fontSize: 13, lineHeight: 1.4, "& svg": {fontSize: 18, color: color.navy, flex: "none"}}}>
        <InfoRoundedIcon />
        {custom
          ? "Upiši bodove za obje ekipe, npr. kad se zove „s ovim dosta”. Bez ograničenja na 11."
          : "Upiši bodove jedne ekipe, druga dobiva ostatak do 11."}
      </Box>

      <Box role="radiogroup" aria-label="Upis za ekipu" sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
        {SIDES.map((side, i) => {
          const on = entry.active === side;
          const points = entry.points[i];
          return (
            <Box
              key={side}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${names[i]}: ${count(points, NOUN.bod)}`}
              onClick={() => onChange(setActive(entry, side))}
              sx={{
                ...buttonBase,
                height: 84,
                [SHORT_WINDOW]: {height: 60},
                minWidth: 0,
                borderRadius: "16px",
                border: `2px solid ${teamColor[i]}`,
                background: on ? teamColor[i] : color.white,
                color: on ? color.white : teamColor[i],
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr)",
                alignItems: "center",
                px: "14px",
                textAlign: "left",
                transition: "background 200ms ease, color 200ms ease",
              }}
            >
              <Stat label={names[i]} value={points} size={34} />
            </Box>
          );
        })}
      </Box>

      <Box role="group" aria-label="Bodovi" sx={{flex: "1 0 auto", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gridAutoRows: "minmax(40px,1fr)", gap: "8px", [SHORT_WINDOW]: {gap: "6px"}}}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Box key={d} component="button" type="button" onClick={() => onChange(typeDigit(entry, d))} sx={key}>
            {d}
          </Box>
        ))}
        <Box component="button" type="button" onClick={() => onChange(typeDigit(entry, 0))} sx={{...key, gridColumn: "span 2"}}>
          0
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => onChange(clearPoints(entry))}
          aria-label="Obriši bodove"
          sx={{...key, background: "transparent", border: `2px solid ${tint.navy[25]}`, color: color.navy, fontSize: 22}}
        >
          X
        </Box>
      </Box>

      {error && <ErrorNote>{error}</ErrorNote>}
      {finish && !editing ? (
        <PrimaryButton icon={<EmojiEventsRoundedIcon />} bg={finish.color} onClick={finish.onFinish} loading={finish.busy} sx={saveSx}>
          Završi meč · {finish.winner}
        </PrimaryButton>
      ) : (
        <PrimaryButton icon={editing ? <CheckCircleRoundedIcon /> : <AddCircleRoundedIcon />} onClick={onSave} disabled={!savable} loading={saving} sx={saveSx}>
          {editing ? "Spremi izmjene" : "Spremi igru"}
        </PrimaryButton>
      )}
    </Card>
  );
}

function Stat({label, value, size}: {label: string; value: number; size: number}) {
  return (
    <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
      <Box component="span" sx={{fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
        {label}
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: size, fontWeight: 800, lineHeight: 1, ...tabular}}>
        {value}
      </Box>
    </Box>
  );
}
