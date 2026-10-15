"use client";

import type {PlayerView} from "@/app/_interfaces/player";
import {personalRows} from "@/app/_lib/ui/profiles";
import {color} from "@/app/_styles/tokens";
import {Card, ColumnCard, ellipsis, SectionLabel} from "@/app/_ui/sp";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import {Box} from "@mui/material";
import React, {useId} from "react";

const PRIVATE_NOTE = "Ostali osobni podaci vidljivi su samo igraču i administratorima.";

// The rows and, for another player's page, the lock note (P:96-102 phone, P:298-306 desktop)
function PersonalDataList({player, full, desktop}: {player: PlayerView; full: boolean; desktop: boolean}) {
  return (
    <>
      <Box component="dl" sx={{m: 0}}>
        {personalRows(player, full).map((r) => (
          <Box
            key={r.key}
            sx={{
              minHeight: desktop ? 50 : 52,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              p: desktop ? "6px 20px" : "0 16px",
              borderBottom: `1px solid ${desktop ? color.divider : color.line}`,
            }}
          >
            <Box component="dt" sx={{flex: "none", whiteSpace: "nowrap", fontSize: desktop ? 14 : 15, color: color.muted}}>
              {r.key}
            </Box>
            <Box component="dd" sx={{m: 0, flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, fontWeight: 600, color: color.ink, ...ellipsis}}>
              {r.value}
            </Box>
          </Box>
        ))}
      </Box>
      {!full && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: desktop ? "10px" : "8px",
            p: desktop ? "12px 20px 14px" : "12px 16px",
            background: color.paper2,
            fontSize: 13,
            lineHeight: 1.4,
            color: color.muted,
            "& svg": {fontSize: 18, flex: "none"},
          }}
        >
          <LockRoundedIcon aria-hidden />
          <span>{PRIVATE_NOTE}</span>
        </Box>
      )}
    </>
  );
}

// "Osobni podaci" of a Player page: first and last name for everyone, all seven rows for the player and admins (full;
// the server sends nothing else). On the phone a section with a card (13c), on the desktop a column (13g); both can
// hold an action next to the title (the admin's "Uredi podatke").
export function PersonalDataCard({player, full, desktop = false, action}: {player: PlayerView; full: boolean; desktop?: boolean; action?: React.ReactNode}) {
  const titleId = useId();
  if (desktop) {
    return (
      <ColumnCard title="Osobni podaci" right={action}>
        <PersonalDataList player={player} full={full} desktop />
      </ColumnCard>
    );
  }
  return (
    <Box component="section" aria-labelledby={titleId} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      {action ? (
        // the admin's phone: "Uredi podatke" at the end of the label's row
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", minHeight: 44}}>
          <SectionLabel id={titleId}>Osobni podaci</SectionLabel>
          {action}
        </Box>
      ) : (
        <SectionLabel id={titleId}>Osobni podaci</SectionLabel>
      )}
      <Card sx={{overflow: "hidden", "& dl > div:last-of-type": full ? {borderBottom: "none"} : undefined}}>
        <PersonalDataList player={player} full={full} desktop={false} />
      </Card>
    </Box>
  );
}
