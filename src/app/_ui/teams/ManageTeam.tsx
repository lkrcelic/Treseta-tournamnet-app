"use client";

import {createTeamAPI} from "@/app/_fetchers/team/create";
import {addTeamPlayerAPI, getTeamsAPI, removeTeamPlayerAPI, renameTeamAPI} from "@/app/_fetchers/team/manage";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {filterTeams, MTPlayer, MTTeam, nameActions, teamNameError, toMTTeam} from "@/app/_lib/ui/manageTeam";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {DesktopShell, IconCircleButton, Screen, ScreenTitle} from "@/app/_ui/sp";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import {Box} from "@mui/material";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {NameCard, TeamList, TeammatesCard} from "./ManageTeamParts";

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

// Manage Teams (admin): pick a team to rename it and change its players, or start a new team.
// An existing team's players change at once; its name is saved with "Save name". A new team collects its name and
// players first and is created with "Create team" (the first two players become its founders).
// leagueId: the league a new team joins (Manage League's "Create team"); without it the current league
export default function ManageTeam({startNew = false, leagueId}: {startNew?: boolean; leagueId?: number}) {
  const isDesktop = useIsDesktop();
  const router = useTransitionRouter();

  const [teams, setTeams] = useState<MTTeam[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(startNew);
  // the phone shows the list or one team; the desktop shows both
  const [phoneView, setPhoneView] = useState<"list" | "team">(startNew ? "team" : "list");
  const [draft, setDraft] = useState<string | null>(null);
  const [newPlayers, setNewPlayers] = useState<MTPlayer[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getTeamsAPI()
      .then((all) => {
        if (!cancelled) setTeams(all.map(toMTTeam));
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorText(e, "Ekipe nije moguće dohvatiti."));
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // the phone swaps the list for a team (and back): start each at the top
  useEffect(() => {
    if (!isDesktop) window.scrollTo(0, 0);
  }, [phoneView, isDesktop]);

  const visible = useMemo(() => (teams == null ? null : filterTeams(teams, query)), [teams, query]);
  // without a pick the first team is shown (desktop)
  const team = isNew ? null : teams?.find((t) => t.id === selectedId) ?? teams?.[0] ?? null;
  const players = isNew ? newPlayers : team?.players ?? [];

  const nameText = isNew ? draft ?? "" : draft ?? team?.name ?? "";
  const nameError = teamNameError(isNew ? draft : nameText, teams ?? [], isNew ? null : team?.id ?? null);
  const {canSave, canCancel, saveLabel} = nameActions(draft, isNew ? null : team?.name ?? "", nameError);

  const resetEditor = () => {
    setDraft(null);
    setHighlight(null);
    setSaveError(null);
    setPlayersError(null);
  };
  const select = (id: number) => {
    setSelectedId(id);
    setIsNew(false);
    resetEditor();
    setPhoneView("team");
  };
  const startNewTeam = () => {
    setIsNew(true);
    setNewPlayers([]);
    resetEditor();
    setPhoneView("team");
  };
  const cancel = () => {
    if (isNew) {
      setIsNew(false);
      if (!isDesktop) setPhoneView("list");
    }
    resetEditor();
  };

  const updateTeam = useCallback((id: number, fn: (t: MTTeam) => MTTeam) => {
    setTeams((prev) => prev?.map((t) => (t.id === id ? fn(t) : t)) ?? prev);
  }, []);

  const save = async () => {
    const name = nameText.trim();
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) {
        const id = await createTeamAPI(name, newPlayers.map((p) => p.id), leagueId);
        // the team exists now; if the list can't be reloaded, show it from what was entered
        const created: MTTeam = {id, name, founders: newPlayers.slice(0, 2).map((p) => p.id), players: newPlayers, leagues: []};
        const fresh = await getTeamsAPI()
          .then((all) => all.map(toMTTeam))
          .catch(() => [...(teams ?? []), created]);
        setTeams(fresh);
        setIsNew(false);
        setSelectedId(id);
        setQuery("");
        resetEditor();
      } else if (team) {
        await renameTeamAPI(team.id, name);
        updateTeam(team.id, (t) => ({...t, name}));
        setDraft(null);
      }
    } catch (e) {
      setSaveError(errorText(e, isNew ? "Ekipu nije moguće napraviti." : "Ime nije spremljeno."));
    }
    setSaving(false);
  };

  // existing team: the change shows at once and is undone if the server refuses
  const addPlayer = async (p: MTPlayer) => {
    setPlayersError(null);
    setHighlight(p.id);
    if (isNew) {
      setNewPlayers((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
      return;
    }
    if (!team) return;
    const id = team.id;
    updateTeam(id, (t) => ({...t, players: [...t.players, p]}));
    try {
      await addTeamPlayerAPI(id, p.id);
    } catch (e) {
      updateTeam(id, (t) => ({...t, players: t.players.filter((x) => x.id !== p.id)}));
      setPlayersError(errorText(e, "Igrača nije moguće dodati."));
    }
  };

  const removePlayer = async (p: MTPlayer) => {
    setPlayersError(null);
    if (isNew) {
      setNewPlayers((prev) => prev.filter((x) => x.id !== p.id));
      return;
    }
    if (!team) return;
    const id = team.id;
    setBusyId(p.id);
    try {
      await removeTeamPlayerAPI(id, p.id);
      updateTeam(id, (t) => ({...t, players: t.players.filter((x) => x.id !== p.id)}));
    } catch (e) {
      setPlayersError(errorText(e, "Igrača nije moguće ukloniti."));
    }
    setBusyId(null);
  };

  const list = (
    <TeamList
      teams={visible}
      error={loadError}
      onRetry={() => setNonce((n) => n + 1)}
      query={query}
      onQuery={setQuery}
      // the phone list marks only a team that was opened; the desktop always shows one
      selectedId={isDesktop ? team?.id ?? null : selectedId}
      isNew={isNew}
      onSelect={select}
      onNew={startNewTeam}
      sx={isDesktop ? undefined : {minHeight: 320}}
    />
  );

  const editor =
    isNew || team ? (
      <>
        <NameCard
          isNew={isNew}
          name={nameText}
          onName={(v) => {
            setDraft(v);
            setSaveError(null);
          }}
          nameError={nameError}
          canCancel={canCancel}
          canSave={canSave}
          saveLabel={saveLabel}
          saving={saving}
          onCancel={cancel}
          onSave={save}
          team={team}
          error={saveError}
        />
        <TeammatesCard
          key={isNew ? "new" : team?.id}
          team={team ?? {founders: newPlayers.slice(0, 2).map((p) => p.id)}}
          players={players}
          highlight={highlight}
          busyId={busyId}
          onAdd={addPlayer}
          onRemove={removePlayer}
          error={playersError}
        />
      </>
    ) : null;

  if (isDesktop) {
    return (
      <DesktopShell active="manageTeam" eyebrow="Admin" title="Manage Team">
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: "20px"}}>
          {list}
          <Box sx={{minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "20px", alignContent: "start"}}>
            {editor}
          </Box>
        </Box>
      </DesktopShell>
    );
  }

  if (phoneView === "list") {
    return (
      <Screen>
        <Box>
          <IconCircleButton label="Nazad" onClick={() => router.push("/", "back")}>
            <ArrowBackRoundedIcon />
          </IconCircleButton>
        </Box>
        <ScreenTitle eyebrow="Admin" title="Manage Team" sx={{pt: "4px", pb: "8px"}} />
        {list}
      </Screen>
    );
  }

  return (
    <Screen>
      <Box>
        <IconCircleButton label="Sve ekipe" onClick={() => (isNew ? cancel() : setPhoneView("list"))}>
          <ArrowBackRoundedIcon />
        </IconCircleButton>
      </Box>
      <ScreenTitle eyebrow="Manage Teams" title={isNew ? "New team" : team?.name ?? ""} sx={{pt: "4px", pb: "8px", "& > div:last-of-type": {overflowWrap: "anywhere"}}} />
      {editor}
    </Screen>
  );
}
