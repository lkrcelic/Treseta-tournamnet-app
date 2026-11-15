"use client";

import {Slot} from "@/app/_lib/locations";
import {color} from "@/app/_styles/tokens";
import {mergeSx, Segmented} from "@/app/_ui/sp";
import {Box, SxProps, Theme} from "@mui/material";

// Sve · Kartaš · Lanterna: which place of a two-place night Dnevni poredak shows (Claude Design 08 A, 09 A), over the
// night's table and its Kola, with "13 ekipa · 2 lokacije" beside it. In place of the conference filter that night.
export function LocationFilter({
  places,
  value,
  onChange,
  note,
  sx,
}: {
  places: readonly [string, string];
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
  // beside the switch: how many teams play (on the night's table)
  note?: string | null;
  sx?: SxProps<Theme>;
}) {
  // 0 is "Sve"
  const items = [
    {key: 0, label: "Sve"},
    {key: 1, label: places[0]},
    {key: 2, label: places[1]},
  ];
  return (
    <Box sx={mergeSx({flex: "none", display: "flex", alignItems: "center", gap: "12px", minWidth: 0}, sx)}>
      <Segmented
        items={items}
        value={value ?? 0}
        onChange={(k) => onChange(k === 1 || k === 2 ? k : null)}
        label="Lokacija"
        asTabs={false}
        sx={{alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none"}}
      />
      {note && (
        <Box component="span" sx={{fontSize: 13, color: color.muted, whiteSpace: "nowrap"}}>
          {note}
        </Box>
      )}
    </Box>
  );
}
