"use client";

import {Conference} from "@/app/_lib/conferences";
import {mergeSx, Segmented} from "@/app/_ui/sp";
import {SxProps, Theme} from "@mui/material";

// Sve · ● Sjever · ● Jug: which conference the standings and tables show (Daily, League standings). The chips are also
// the legend of the dots. Nothing when the league has no conferences.
export function ConferenceFilter({
  conferences,
  value,
  onChange,
  sx,
}: {
  conferences: Conference[];
  value: number | null;
  onChange: (id: number | null) => void;
  sx?: SxProps<Theme>;
}) {
  if (conferences.length === 0) return null;
  // 0 is "Sve": conference ids start at 1
  const items = [{key: 0, label: "Sve"}, ...conferences.map((c) => ({key: c.id, label: c.name, dot: c.color}))];
  return (
    <Segmented
      items={items}
      value={value ?? 0}
      onChange={(k) => onChange(k || null)}
      label="Konferencija"
      asTabs={false}
      // many or long names scroll sideways
      sx={mergeSx({alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none"}, sx)}
    />
  );
}
