"use client";

import {getNightSplitAPI, setNightSplitAPI} from "@/app/_fetchers/league/split";
import {NightSplit, SplitMove} from "@/app/_interfaces/split";
import {useCallback, useEffect, useRef, useState} from "react";

// A night's Podjela being edited (Upravljanje ligom · Podjela, Podjela ekipa on the phone). A move shows at once and
// is sent; the answer replaces the list (a later move's answer wins), and a refused move loads the list again. date
// null: nothing to load (the next night has one place).
export default function useNightSplit(leagueId: number, date: string | null) {
  const [split, setSplit] = useState<NightSplit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // teams that left a place where they are still in a Skica
  const [warnings, setWarnings] = useState<string[]>([]);
  const sent = useRef(0);

  const reload = useCallback(() => {
    if (date == null) return;
    setError(null);
    getNightSplitAPI(leagueId, date)
      .then(setSplit)
      .catch((e) => setError(e instanceof Error ? e.message : "Podjela ekipa se nije učitala."));
  }, [leagueId, date]);

  useEffect(() => {
    setSplit(null);
    setWarnings([]);
    setSaveError(null);
    reload();
  }, [reload]);

  const move = async (moves: SplitMove[]) => {
    if (!split || date == null) return;
    const now = new Map(split.teams.map((t) => [t.team_id, t.slot]));
    const changed = moves.filter((m) => now.has(m.team_id) && now.get(m.team_id) !== m.slot);
    if (!changed.length) return;
    const to = new Map(changed.map((m) => [m.team_id, m.slot]));
    setSplit({...split, teams: split.teams.map((t) => (to.has(t.team_id) ? {...t, slot: to.get(t.team_id)!} : t))});
    setSaveError(null);
    const mine = ++sent.current;
    try {
      const result = await setNightSplitAPI(leagueId, date, changed);
      if (mine !== sent.current) return;
      setSplit(result.split);
      setWarnings(result.warnings);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Podjela nije spremljena.");
      reload();
    }
  };

  // Neraspoređene: the active teams without a place (the tab's badge)
  const unassigned = split?.places ? split.teams.filter((t) => t.active && t.slot == null).length : 0;

  return {split, error, reload, move, saveError, warnings, dismissWarnings: () => setWarnings([]), unassigned};
}
