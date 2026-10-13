"use client";

import {addTeamPlayerAPI, removeTeamPlayerAPI} from "@/app/_fetchers/team/manage";
import {adminPlayersList} from "@/app/_hooks/useAdminPlayers";
import type {Overview} from "@/app/_hooks/useOverview";
import {teamsList} from "@/app/_hooks/useTeams";
import type {PlayerOverview, PlayerOverviewTeam} from "@/app/_interfaces/profiles";
import {addPlayerTeam, addTeamMember, DirectoryTeam, playerTeamFromDirectory, removePlayerTeam, removeTeamMember} from "@/app/_lib/ui/directory";
import {color} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import {Box} from "@mui/material";
import {useCallback, useEffect, useMemo, useState} from "react";
import {errorText} from "./TeamAdmin";

// The admin's controls on a desktop Player page (handoff §6 "Admin controls": always visible, no edit mode; design 13j,
// Profiles P:274-306): "Dodaj u ekipu" with a remove button per team in the Ekipe card, and "Uredi podatke", which opens
// "Uredi osobne podatke" (EditPlayerPanel.tsx). A team added or removed is saved at once and shows at once, here, in
// the Igrači directory and in the Ekipe one; a change the server refuses is undone and its reason shown in the card.

export type PlayerTeamsAdmin = {
  addTeam: (team: DirectoryTeam) => void;
  removeTeam: (team: PlayerOverviewTeam) => void;
  error: string | null;
};

const byName = (a: PlayerOverviewTeam, b: PlayerOverviewTeam) => a.team_name.localeCompare(b.team_name, "hr");

// The admin's changes to the player's teams (overview.data must be there). Each change loads the page again once the
// server has answered: the team's leagues and players, the tiles and the player's rating come from the server.
export function usePlayerTeamsAdmin(overview: Overview<PlayerOverview>): PlayerTeamsAdmin {
  const data = overview.data;
  const playerId = data?.player.id ?? 0;
  const {setData, reload} = overview;
  const [error, setError] = useState<string | null>(null);

  // another player (the page beside the directory changed): the last one's refusal goes
  useEffect(() => {
    setError(null);
  }, [playerId]);

  // the player as a team's member (the directories list them with their username)
  const first = data?.player.first_name ?? "";
  const last = data?.player.last_name ?? "";
  const username = data?.player.username;
  const shown = data != null;
  const member = useMemo(() => (shown ? {id: playerId, first_name: first, last_name: last, username} : null), [shown, playerId, first, last, username]);

  const addTeam = useCallback(
    async (team: DirectoryTeam) => {
      if (!member) return;
      setError(null);
      setData((d) => (d.teams.some((t) => t.team_id === team.id) ? d : {...d, teams: [...d.teams, playerTeamFromDirectory(team, member)].sort(byName)}));
      try {
        await addTeamPlayerAPI(team.id, member.id);
        teamsList.update((list) => addTeamMember(list, team.id, member));
        adminPlayersList.update((list) => addPlayerTeam(list, member.id, {team_id: team.id, team_name: team.name}));
        reload();
      } catch (e) {
        setData((d) => ({...d, teams: d.teams.filter((t) => t.team_id !== team.id)}));
        setError(errorText(e, "Igrač nije dodan u ekipu."));
        // what the server has now (the undo also dropped any load on its way)
        reload();
      }
    },
    [member, setData, reload]
  );

  const teams = data?.teams;
  const removeTeam = useCallback(
    async (team: PlayerOverviewTeam) => {
      setError(null);
      // where the row goes back if the server refuses
      const at = teams?.findIndex((t) => t.team_id === team.team_id) ?? -1;
      setData((d) => ({...d, teams: d.teams.filter((t) => t.team_id !== team.team_id)}));
      try {
        await removeTeamPlayerAPI(team.team_id, playerId);
        teamsList.update((list) => removeTeamMember(list, team.team_id, playerId));
        adminPlayersList.update((list) => removePlayerTeam(list, playerId, team.team_id));
        reload();
      } catch (e) {
        setData((d) => {
          if (d.teams.some((t) => t.team_id === team.team_id)) return d;
          const next = [...d.teams];
          next.splice(at < 0 ? next.length : Math.min(at, next.length), 0, team);
          return {...d, teams: next};
        });
        setError(errorText(e, "Igrač nije uklonjen iz ekipe."));
        reload();
      }
    },
    [teams, playerId, setData, reload]
  );

  return {addTeam, removeTeam, error};
}

// "Uredi podatke" in the Osobni podaci card's header (P:299): opens "Uredi osobne podatke"
export function EditDataButton({onClick, expanded}: {onClick: () => void; expanded: boolean}) {
  return (
    <Box
      component="button"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
      sx={{
        ...buttonBase,
        height: 38,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        p: "0 14px 0 10px",
        boxSizing: "border-box",
        border: `1.5px solid ${color.borderControl}`,
        borderRadius: "12px",
        background: color.white,
        color: color.navy,
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        transition: "background 150ms ease",
        "&:hover": {background: color.paper},
        "& svg": {fontSize: 18},
      }}
    >
      <EditRoundedIcon aria-hidden />
      Uredi podatke
    </Box>
  );
}
