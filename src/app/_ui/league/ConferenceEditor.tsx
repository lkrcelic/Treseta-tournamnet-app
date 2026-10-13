"use client";

import {CONFERENCE_COLORS, CONFERENCE_NAME_MAX, MAX_CONFERENCES, MIN_CONFERENCES, nextFreeColor} from "@/app/_lib/conferences";
import {color} from "@/app/_styles/tokens";
import {buttonBase, GhostIconButton, OutlineButton, TeamDot, TextInput} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {Box} from "@mui/material";

// One row of the editor. conference_id: a saved conference (Manage League), which keeps its teams when it is renamed
// or recolored.
export type ConferenceDraft = {key: number; conference_id?: number; name: string; color: string};

let lastKey = 0;

export function conferenceDraft(c: {conference_id?: number; name?: string; color: string}): ConferenceDraft {
  return {key: ++lastKey, conference_id: c.conference_id, name: c.name ?? "", color: c.color};
}

// The two empty rows conferences start with (the first two colors of the palette)
export function startingDrafts(): ConferenceDraft[] {
  return [conferenceDraft({color: CONFERENCE_COLORS[0].hex}), conferenceDraft({color: CONFERENCE_COLORS[1].hex})];
}

// Conferences being edited (Create League, Manage League): per row a name and the palette's colors. Picking a color
// another row has swaps the two, so every combination can be reached. Rows go from 2 to 6; taking them all away (no
// conferences) is the caller's switch.
export function ConferenceEditor({value, onChange, disabled = false}: {value: ConferenceDraft[]; onChange: (next: ConferenceDraft[]) => void; disabled?: boolean}) {
  const setName = (key: number, name: string) => onChange(value.map((r) => (r.key === key ? {...r, name} : r)));
  const pickColor = (key: number, hex: string) => {
    const old = value.find((r) => r.key === key)?.color;
    onChange(value.map((r) => (r.key === key ? {...r, color: hex} : r.color.toUpperCase() === hex && old ? {...r, color: old} : r)));
  };
  const add = () => onChange([...value, conferenceDraft({color: nextFreeColor(value.map((r) => r.color))})]);
  const remove = (key: number) => onChange(value.filter((r) => r.key !== key));

  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
      {value.map((r, i) => {
        const label = r.name.trim() || `Konferencija ${i + 1}`;
        return (
          <Box
            key={r.key}
            role="group"
            aria-label={label}
            sx={{display: "flex", flexDirection: "column", gap: "10px", p: "10px 8px 12px 12px", borderRadius: "16px", border: `1px solid ${color.lineStrong}`, background: color.card}}
          >
            <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
              <TeamDot color={r.color} size={14} />
              <TextInput
                aria-label={`Ime konferencije ${i + 1}`}
                placeholder={i === 0 ? "npr. Sjever" : i === 1 ? "npr. Jug" : "Ime konferencije"}
                value={r.name}
                maxLength={CONFERENCE_NAME_MAX}
                disabled={disabled}
                onChange={(e) => setName(r.key, e.target.value)}
                sx={{height: 48, borderRadius: "12px", fontSize: 16}}
              />
              <GhostIconButton label={`Ukloni: ${label}`} onClick={() => remove(r.key)} disabled={disabled || value.length <= MIN_CONFERENCES} sx={{"&:disabled": {opacity: 0.35}}}>
                <CloseRoundedIcon />
              </GhostIconButton>
            </Box>
            {/* six swatches fit in one line on a 360 px phone */}
            <Box role="radiogroup" aria-label={`Boja: ${label}`} sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
              {CONFERENCE_COLORS.map((c) => {
                const on = c.hex === r.color.toUpperCase();
                return (
                  <Box
                    key={c.hex}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={c.name}
                    title={c.name}
                    disabled={disabled}
                    onClick={() => pickColor(r.key, c.hex)}
                    sx={{
                      ...buttonBase,
                      width: 34,
                      height: 34,
                      flex: "none",
                      borderRadius: "50%",
                      background: c.hex,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      // the picked one: a white gap and a ring in its own color
                      boxShadow: on ? `0 0 0 2px ${color.card}, 0 0 0 4px ${c.hex}` : "none",
                      transition: "box-shadow 140ms ease",
                      "& svg": {fontSize: 20},
                    }}
                  >
                    {on && <CheckRoundedIcon />}
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
      {value.length < MAX_CONFERENCES && (
        <OutlineButton height={48} onClick={add} disabled={disabled} sx={{borderWidth: "1.5px", borderColor: "rgba(60,74,103,.25)", fontSize: 15}}>
          <AddRoundedIcon sx={{fontSize: 22}} />
          Dodaj konferenciju
        </OutlineButton>
      )}
    </Box>
  );
}
