"use client";

import {addTeamToLeagueAPI} from "@/app/_fetchers/league/leagues";
import {createTeamAPI} from "@/app/_fetchers/team/create";
import useAdminPlayers, {adminPlayersList} from "@/app/_hooks/useAdminPlayers";
import {useLeagueList, useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import useTeams, {teamsList} from "@/app/_hooks/useTeams";
import {playerAddOptions, teamNameError} from "@/app/_lib/ui/directory";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow} from "@/app/_styles/tokens";
import {buttonBase, ellipsis, ErrorNote, IconCircleButton, InfoNote, InitialsAvatar, PrimaryButton, Screen, ScrollArea, SearchAddField, SectionLabel, TextField} from "@/app/_ui/sp";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import {Box} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import {adminCardSx} from "./AdminParts";

// at least this many players (the design's "1 / min. 2", your answer): a team plays in twos
const MIN_PLAYERS = 2;

// Nova ekipa on the admin's phone (admin-mobile 32), over the whole screen: a team can't be made without its players.
// Its name (not another team's), its players found by name (they need an account), and the leagues it joins (none is
// fine). leagueId: the league it is made for (?league=), ticked at first; else the league picked for the admin screens.
export default function NewTeamPhone({leagueId}: {leagueId: number | null}) {
  const router = useTransitionRouter();
  const nav = useNavStack("Nova ekipa", "/teams");
  const {list: teams} = useTeams();
  const {list: players, error: playersError, reload: reloadPlayers} = useAdminPlayers();
  const {leagues} = useLeagueList();
  const picked = useSelectedLeagueId();
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [roster, setRoster] = useState<number[]>([]);
  const [joined, setJoined] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the league ticked at first, once known
  useEffect(() => {
    if (joined != null) return;
    const first = leagueId ?? picked;
    if (first !== undefined) setJoined(first != null ? [first] : []);
  }, [leagueId, picked, joined]);

  const nameError = teamNameError(name, teams, null);
  const options = useMemo(() => (players ? playerAddOptions(players, roster) : []), [players, roster]);
  const chosen = roster.map((id) => players?.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => p != null);
  const ok = !nameError && roster.length >= MIN_PLAYERS && !saving;

  const create = async () => {
    setTouched(true);
    if (!ok) return;
    setSaving(true);
    setError(null);
    const leaguesToJoin = joined ?? [];
    try {
      const id = await createTeamAPI(name.trim(), roster, leaguesToJoin[0] ?? null);
      // the API takes one league; the others join one by one
      for (const l of leaguesToJoin.slice(1)) await addTeamToLeagueAPI(l, id);
      teamsList.invalidate();
      adminPlayersList.invalidate();
      router.replace(`/teams/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekipa nije napravljena.");
      setSaving(false);
    }
  };

  return (
    <Screen fill gap={14}>
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px"}}>
        <IconCircleButton label="Zatvori" size={44} onClick={nav.back} sx={{"& svg": {fontSize: 24}}}>
          <CloseRoundedIcon />
        </IconCircleButton>
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em"}}>
          Nova ekipa
        </Box>
      </Box>
      <ScrollArea bleed sx={{gap: "12px"}}>
        <Box sx={adminCardSx}>
          <TextField
            label="Ime ekipe"
            placeholder="npr. Pulski Asovi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            error={touched && nameError ? nameError : undefined}
            soft
            inputSx={{height: 52, borderRadius: "14px", fontSize: 17}}
          />
        </Box>

        <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", px: "6px"}}>
          <SectionLabel sx={{px: 0}}>Igrači</SectionLabel>
          <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: roster.length >= MIN_PLAYERS ? color.green : color.muted}}>
            {roster.length} / min. {MIN_PLAYERS}
          </Box>
        </Box>
        <Box sx={{...adminCardSx, gap: "10px"}}>
          <SearchAddField
            placeholder="Dodaj igrača · ime ili korisničko ime"
            icon={<PersonAddRoundedIcon aria-hidden />}
            options={options}
            onAdd={(o) => setRoster((r) => [...r, Number(o.id)])}
            noHit="Nema takvog igrača."
            sx={{flex: "none"}}
          />
          {playersError && !players && <ErrorNote onRetry={reloadPlayers}>{playersError}</ErrorNote>}
          {chosen.length > 0 && (
            <Box component="ul" aria-label="Igrači nove ekipe" sx={{listStyle: "none", m: 0, p: 0}}>
              {chosen.map((p, i) => (
                <Box component="li" key={p.id} sx={{minHeight: 60, display: "flex", alignItems: "center", gap: "12px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
                  <InitialsAvatar name={p.name} size={40} variant="paper" />
                  <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                    <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                      {p.name}
                    </Box>
                    <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                      {p.rating != null ? `Rejting ${p.rating}` : `@${p.username}`}
                    </Box>
                  </Box>
                  <IconCircleButton label={`Makni ${p.name}`} size={44} onClick={() => setRoster((r) => r.filter((x) => x !== p.id))} sx={{boxShadow: "none", color: color.muted, "& svg": {fontSize: 22}}}>
                    <CloseRoundedIcon />
                  </IconCircleButton>
                </Box>
              ))}
            </Box>
          )}
          <InfoNote icon={<GroupsRoundedIcon />}>Ekipa treba barem 2 igrača. Igrači moraju imati račun u aplikaciji.</InfoNote>
        </Box>

        <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", px: "6px"}}>
          <SectionLabel sx={{px: 0}}>Lige</SectionLabel>
          <Box component="span" sx={{fontSize: 14, color: color.muted}}>
            nije obavezno
          </Box>
        </Box>
        <Box component="ul" aria-label="Lige" sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
          {(leagues ?? []).map((l, i) => {
            const on = (joined ?? []).includes(l.id);
            return (
              <Box component="li" key={l.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                <Box
                  component="button"
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setJoined((j) => (on ? (j ?? []).filter((x) => x !== l.id) : [...(j ?? []), l.id]))}
                  sx={{...buttonBase, width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", px: "16px", textAlign: "left"}}
                >
                  <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                    <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink, overflowWrap: "anywhere"}}>
                      {l.name}
                    </Box>
                    {l.season && (
                      <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                        {l.season}
                      </Box>
                    )}
                  </Box>
                  <Box
                    component="span"
                    aria-hidden
                    sx={{width: 28, height: 28, flex: "none", borderRadius: "8px", border: `2px solid ${on ? color.navy : color.borderStrong}`, background: on ? color.navy : color.white, color: color.white, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 20}}}
                  >
                    {on && <CheckRoundedIcon />}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </ScrollArea>
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton icon={<GroupAddRoundedIcon />} onClick={create} disabled={!ok} loading={saving}>
          Kreiraj ekipu
        </PrimaryButton>
      </Box>
    </Screen>
  );
}
