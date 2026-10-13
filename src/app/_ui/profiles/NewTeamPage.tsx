"use client";

import {createTeamAPI} from "@/app/_fetchers/team/create";
import {updateCachedLeague, useLeagueList} from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import useShortWindow from "@/app/_hooks/useShortWindow";
import useTeams, {teamsList} from "@/app/_hooks/useTeams";
import type {TeamOverview} from "@/app/_interfaces/profiles";
import {sortHr, teamNameError} from "@/app/_lib/ui/directory";
import {teamInitial, teamTiles} from "@/app/_lib/ui/profiles";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useEffect, useRef, useState} from "react";
import {DesktopFrame, HeroCard, useDirectoryFrame} from "./PageParts";
import {errorText, NameButton, NameEditing, TeamNameInput} from "./TeamAdmin";
import {TeamColumns} from "./TeamPage";

// "Nova ekipa" (/teams?new=1, plan Q13): the Team page of a team that doesn't exist yet (13o: the columns with their
// labels and empty), its name field ready. ✓ (or Enter) makes the team and opens its page, where players and leagues
// are added. leagueId: Upravljanje ligom's "Nova ekipa" puts the team in that league. Escape goes back where Nova ekipa
// was opened from: the page before it (Upravljanje ligom), or the team that was open in the Ekipe directory.
export function NewTeamPage({leagueId}: {leagueId: number | null}) {
  const router = useTransitionRouter();
  const nav = useNavStack("Nova ekipa", "/teams");
  const frame = useDirectoryFrame();
  const short = useShortWindow();
  const {list: teams} = useTeams();
  const {leagues} = useLeagueList();
  const league = leagueId != null ? leagues?.find((l) => l.id === leagueId) ?? null : null;
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = () => {
    if (nav.canGoBack) nav.back();
    else router.replace(frame?.lastPage ?? (teams?.length ? `/teams/${teams[0].id}` : "/teams"), "morph");
  };
  const save = async () => {
    const name = draft.trim();
    const problem = teamNameError(name, teams, null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createTeamAPI(name, [], leagueId);
      teamsList.update((list) => sortHr([...list, {id, name, players: [], leagues: league ? [{id: league.id, name: league.name}] : []}], (t) => t.name));
      if (league) updateCachedLeague(league.id, {teamCount: (league.teamCount ?? 0) + 1});
      router.replace(`/teams/${id}`, "morph");
    } catch (e) {
      setError(errorText(e, "Ekipa nije napravljena."));
      setSaving(false);
    }
  };
  const edit: NameEditing = {
    editing: true,
    draft,
    setDraft: (v) => {
      setDraft(v);
      setError(null);
    },
    start: () => {},
    cancel: leave,
    save,
    saving,
    error,
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const team: TeamOverview = {
    team: {id: 0, name: draft, mine: false},
    stats: {best: null, players: 0, leagues: 0, leagues_live: 0},
    players: [],
    leagues: [],
    nights: [],
    viewer: {admin: false},
  };
  return (
    <DesktopFrame embedded short={short} nav={nav}>
      <HeroCard
        desktop
        short={short}
        avatarName={draft}
        avatarLetters={teamInitial(draft)}
        title="Nova ekipa"
        titleEditor={<TeamNameInput edit={edit} short={short} inputRef={inputRef} note="Upiši ime nove ekipe i spremi ga." />}
        nameTag={<NameButton edit={edit} short={short} onStart={() => {}} />}
        tiles={teamTiles(team.stats)}
      />
      <TeamColumns
        team={team}
        admin={null}
        empty={{
          players: "Igrače dodaješ kad spremiš ime ekipe.",
          // from Upravljanje ligom the team goes into that league
          leagues:
            leagueId == null
              ? "Ekipa još ne igra ni u jednoj ligi."
              : league
                ? `Ekipa ide u ligu ${league.name} kad spremiš ime.`
                : "Ekipa ide u odabranu ligu kad spremiš ime.",
          nights: "Još nema odigranih večeri.",
        }}
      />
    </DesktopFrame>
  );
}
