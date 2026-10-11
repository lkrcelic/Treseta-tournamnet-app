"use client";

import {TeamExtendedResponse} from "@/app/_interfaces/team";
import useAuthStore from "@/app/_store/authStore";
import {useEffect, useState} from "react";

// Teams the logged-in player belongs to (used to highlight "my" rows and on the profile)
export default function useMyTeams(): {teams: TeamExtendedResponse[]; loading: boolean} {
  const userId = useAuthStore((s) => s.user?.id);
  const [teams, setTeams] = useState<TeamExtendedResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/teams")
      .then((res) => (res.ok ? res.json() : []))
      .then((all: TeamExtendedResponse[]) => {
        if (cancelled) return;
        setTeams((all ?? []).filter((t) => t.teamPlayers?.some((tp) => tp.player?.id === userId)));
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {teams, loading};
}
