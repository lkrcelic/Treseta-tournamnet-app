"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagues, {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import {color, shadow} from "@/app/_styles/tokens";
import {InactiveBadge, useCreateRound} from "@/app/_ui/round/CreateRound";
import {buttonBase, ErrorNote, IconCircleButton, IconTile, Screen, ScreenTitle, ScrollCard, SearchInput, SwitchRow} from "@/app/_ui/sp";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useEffect, useState} from "react";

// Create Round on the phone: pick the league, then the options and the teams present tonight. On the desktop it is
// the "Create round" view of Manage League, so this page sends the admin there.
export default function CreateRound() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const leagues = useLeagues();
  const selectedLeague = useSelectedLeagueId();
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const defaultRounds = leagues.find((l) => l.id === leagueId)?.roundsPerNight;
  const {visible, inactive, isOn, toggle, toggleAll, allOn, query, setQuery, createError, steppers, createButton, repeatsDialog, teamState} = useCreateRound(
    isDesktop ? null : leagueId,
    defaultRounds
  );

  useEffect(() => {
    if (isDesktop && selectedLeague != null) router.router.replace(`/league/${selectedLeague}/manage?view=create`);
  }, [isDesktop, selectedLeague, router]);

  if (isDesktop) return null;

  // phone, step 1: pick the league
  if (leagueId == null) {
    return (
      <Screen>
        <Box>
          <IconCircleButton label="Nazad" onClick={() => router.push("/", "back")}>
            <ArrowBackRoundedIcon />
          </IconCircleButton>
        </Box>
        <ScreenTitle eyebrow="Admin · Create Round" title="Select league" sx={{pt: "4px", pb: "8px"}} />
        <Box role="list" sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
          {leagues.map((l) => (
            <Box
              key={l.id}
              role="listitem"
              component="button"
              type="button"
              onClick={() => setLeagueId(l.id)}
              sx={{
                ...buttonBase,
                minHeight: 76,
                borderRadius: "22px",
                background: color.card,
                display: "flex",
                alignItems: "center",
                gap: "14px",
                px: "16px",
                textAlign: "left",
                boxShadow: shadow.card,
                "&:active": {transform: "scale(.98)"},
              }}
            >
              <IconTile>
                <EmojiEventsRoundedIcon />
              </IconTile>
              <Box component="span" sx={{flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
                <Box component="span" sx={{fontSize: 17, fontWeight: 600, color: color.ink}}>
                  {l.name}
                </Box>
                {l.meta && (
                  <Box component="span" sx={{fontSize: 14, color: color.muted}}>
                    {l.meta}
                  </Box>
                )}
              </Box>
              <ChevronRightRoundedIcon sx={{fontSize: 24, color: color.muted}} />
            </Box>
          ))}
        </Box>
      </Screen>
    );
  }

  // phone, step 2: options and the teams present tonight
  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? "";
  return (
    <Screen fill gap={12}>
      <Box sx={{display: "flex", alignItems: "flex-start", gap: "12px"}}>
        <IconCircleButton label="Promijeni ligu" onClick={() => setLeagueId(null)}>
          <ArrowBackRoundedIcon />
        </IconCircleButton>
        <ScreenTitle eyebrow={`Admin · ${leagueName}`} title="Create Round" sx={{minWidth: 0, "& > div:first-of-type": {overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}} />
      </Box>
      {steppers}
      <SearchInput placeholder="Search" aria-label="Traži ekipu" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ScrollCard aria-label="Prisutne ekipe">
        {teamState ?? (
          <>
            <SwitchRow
              checked={allOn}
              onChange={toggleAll}
              disabled={visible.length === 0}
              sx={{background: color.paperSoft, fontWeight: 700, color: color.ink, borderBottom: `1px solid rgba(60,74,103,.12)`}}
            >
              {query ? "Select all filtered" : "Select all"}
            </SwitchRow>
            {visible.map((t) => (
              <SwitchRow key={t.id} checked={isOn(t)} onChange={() => toggle(t.id)}>
                <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                  {t.name}
                </Box>
                {inactive.has(t.id) && <InactiveBadge />}
              </SwitchRow>
            ))}
          </>
        )}
      </ScrollCard>
      {createError && <ErrorNote>{createError}</ErrorNote>}
      {createButton}
      {repeatsDialog}
    </Screen>
  );
}
