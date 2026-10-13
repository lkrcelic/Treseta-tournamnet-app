"use client";

import {getAdminPlayersAPI} from "@/app/_fetchers/admin/players";
import {sharedList} from "@/app/_hooks/useSharedList";
import type {AdminPlayerRow} from "@/app/_interfaces/player";

// Every player but the deleted ones, with username, teams and whether the account is active, in Croatian name order
// (admin only): the Igrači directory and the Team page's "Dodaj igrača". adminPlayersList.update keeps it in step with
// a change on a page; adminPlayersList.invalidate reloads it (after a player was deleted).
export const adminPlayersList = sharedList<AdminPlayerRow>(getAdminPlayersAPI, "Igrači se nisu učitali.");

export default function useAdminPlayers() {
  return adminPlayersList.useList();
}
