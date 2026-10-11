"use client";

import {getLeagueConferencesAPI} from "@/app/_fetchers/league/conferences";
import {LeagueConferences} from "@/app/_interfaces/league";
import {ConferenceLookup, conferenceLookup} from "@/app/_lib/conferences";
import {useEffect, useMemo, useState} from "react";

// Per league for the session: a screen shows the last known conferences at once and refreshes them in the
// background. Screens mounting together share one request; Manage League puts its changes here.
const cache = new Map<number, LeagueConferences>();
const inflight = new Map<number, Promise<LeagueConferences>>();
const listeners = new Set<(leagueId: number) => void>();

function load(leagueId: number): Promise<LeagueConferences> {
  let request = inflight.get(leagueId);
  if (!request) {
    request = getLeagueConferencesAPI(leagueId)
      .then((data) => {
        setCachedConferences(leagueId, data);
        return data;
      })
      .finally(() => inflight.delete(leagueId));
    inflight.set(leagueId, request);
  }
  return request;
}

// Shows a league's conferences as an admin just saved them on every screen that is open
export function setCachedConferences(leagueId: number, data: LeagueConferences) {
  cache.set(leagueId, data);
  listeners.forEach((notify) => notify(leagueId));
}

// The same for one team put in another conference (conferenceId null: none)
export function setCachedTeamConference(leagueId: number, teamId: number, conferenceId: number | null) {
  const data = cache.get(leagueId);
  if (!data) return;
  const teams = data.teams.filter((t) => t.team_id !== teamId);
  setCachedConferences(leagueId, {...data, teams: conferenceId == null ? teams : [...teams, {team_id: teamId, conference_id: conferenceId}]});
}

// A league's conferences in order, and each team's conference. Until they arrive (or when the league has none) there
// are no conferences, so the screens show no dots. ready: they arrived, or failed to (then there are none), or there is
// no league (null; undefined is a league still loading), so a screen can wait for it instead of showing its rows
// without dots first. Public, so it also works on the season table before logging in.
export default function useConferences(leagueId: number | null | undefined): ConferenceLookup & {ready: boolean} {
  const [data, setData] = useState<LeagueConferences | null>(leagueId != null ? cache.get(leagueId) ?? null : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(leagueId != null ? cache.get(leagueId) ?? null : null);
    setFailed(false);
    if (leagueId == null) return;
    let cancelled = false;
    const onChange = (id: number) => {
      if (id === leagueId) setData(cache.get(id) ?? null);
    };
    listeners.add(onChange);
    load(leagueId).catch(() => {
      // no dots; the standings themselves still show
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, [leagueId]);

  return useMemo(() => ({...conferenceLookup(data), ready: data != null || failed || leagueId === null}), [data, failed, leagueId]);
}
