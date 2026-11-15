"use client";

import {LeagueRoundSummary} from "@/app/_fetchers/admin/daily";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import useNightSplit from "@/app/_hooks/useNightSplit";
import {Slot, SLOTS} from "@/app/_lib/locations";
import {NightLocation} from "@/app/_lib/nights";
import {placeStatus} from "@/app/_lib/ui/adminTonight";
import {count, NOUN} from "@/app/_lib/ui/text";
import {useState} from "react";

// A night's two places for the admin's phone screens (Novo kolo, Skica kola): which places the night has (null: one),
// the one picked, each one's teams (Podjela) and how its Kola go (rounds: the league's, from useLeagueRounds).
// initial: the place to start on (?slot= of the link).
export default function useNightPlaces(leagueId: number, date: string | null, rounds: LeagueRoundSummary[] | null, initial: Slot | null = null) {
  const {nights, error, reload} = useLeagueNights(leagueId);
  const night = nights?.find((n) => n.date === date);
  const places: [NightLocation, NightLocation] | null = night?.place && night.second_location ? [night.place, night.second_location] : null;
  const split = useNightSplit(leagueId, places && date ? date : null);
  const [slot, setSlot] = useState<Slot>(initial ?? 1);
  const teamsAt = (s: Slot) => (split.split ? split.split.teams.filter((t) => t.slot === s).length : null);
  const options = places
    ? SLOTS.map((s) => {
        const status = placeStatus(rounds ?? [], date ?? "", s);
        const teams = teamsAt(s);
        return {slot: s, name: places[s - 1].name, sub: [teams != null ? count(teams, NOUN.ekipa) : null, status.text].filter(Boolean).join(" · "), short: status.short, teams, live: status.live};
      })
    : null;
  return {
    // the nights are here (until then it isn't known whether the night has two places)
    loaded: nights != null,
    error,
    reload,
    places,
    slot,
    setSlot,
    options,
    split: split.split,
    splitError: split.error,
    reloadSplit: split.reload,
  };
}
