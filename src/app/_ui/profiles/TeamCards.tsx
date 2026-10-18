"use client";

import {fullName} from "@/app/_lib/players/names";
import {font} from "@/app/_styles/tokens";
import {Card, CenteredSpinner, ChipLink, EmptyState, PlayerChip, SectionLabel} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import React, {useId} from "react";

export type TeamCardData = {
  team_id: number;
  team_name: string;
  // shown as given (Moj profil: name order; the Player page: the team's rating order)
  players: {id: number; first_name: string; last_name: string; photo_url?: string | null}[];
};

// One card per team (Moj profil "Moje ekipe" 13e/12f, a phone Player page's "Ekipe" 13c): the team's name with
// "Stranica ekipe ›" to its page, and its players as chips with their first names (usernames are private). The name is
// never cut short: when it and the pill don't fit on one line (a narrow desktop column), the pill goes under the name.
export function TeamCards({
  title,
  teams,
  loading = false,
  empty,
  emptyIcon = false,
  desktop = false,
}: {
  title: string;
  teams: TeamCardData[];
  loading?: boolean;
  empty: React.ReactNode;
  // the inbox icon over the empty text, as the Team page's empty cards (the Player page)
  emptyIcon?: boolean;
  desktop?: boolean;
}) {
  const titleId = useId();
  return (
    <Box component="section" aria-labelledby={titleId} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id={titleId}>{title}</SectionLabel>
      {loading ? (
        <Card>
          <CenteredSpinner />
        </Card>
      ) : teams.length === 0 ? (
        <Card>
          <EmptyState icon={emptyIcon}>{empty}</EmptyState>
        </Card>
      ) : (
        teams.map((t) => (
          <Card key={t.team_id} component="article" aria-label={t.team_name} sx={{p: desktop ? "18px" : "16px", display: "flex", flexDirection: "column", gap: desktop ? "12px" : "10px"}}>
            <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "8px", rowGap: "6px", minHeight: 36}}>
              <Box
                component="h3"
                sx={{
                  m: 0,
                  flex: "1 1 auto",
                  minWidth: 0,
                  fontFamily: font.display,
                  fontSize: desktop ? 24 : 22,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: "-.01em",
                  overflowWrap: "break-word",
                  textWrap: "balance",
                }}
              >
                {t.team_name}
              </Box>
              <ChipLink href={`/teams/${t.team_id}`} aria-label={`Stranica ekipe ${t.team_name}`}>
                Stranica ekipe
              </ChipLink>
            </Box>
            <Box component="ul" aria-label="Igrači" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: "8px"}}>
              {t.players.map((p) => (
                <Box component="li" key={p.id}>
                  {/* first names: usernames are private (handoff §6) */}
                  <PlayerChip name={p.first_name || p.last_name} fullName={fullName(p)} src={p.photo_url} />
                </Box>
              ))}
            </Box>
          </Card>
        ))
      )}
    </Box>
  );
}
