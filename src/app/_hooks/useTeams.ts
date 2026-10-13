"use client";

import {getTeamsAPI} from "@/app/_fetchers/team/manage";
import {sharedList} from "@/app/_hooks/useSharedList";
import {DirectoryTeam, sortHr, toDirectoryTeam} from "@/app/_lib/ui/directory";

// Every team with its players and leagues, in Croatian name order: the admin's Ekipe directory (and the Player page's
// "Dodaj u ekipu"). teamsList.update keeps it in step with a change on a Team page; teamsList.invalidate reloads it.
export const teamsList = sharedList<DirectoryTeam>(
  () => getTeamsAPI().then((teams) => sortHr(teams.map(toDirectoryTeam), (t) => t.name)),
  "Ekipe se nisu učitale."
);

export default function useTeams() {
  return teamsList.useList();
}
