"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import {useTournament} from "@/app/_hooks/useTournaments";
import {count, matchesQuery, NOUN} from "@/app/_lib/ui/text";
import useAuthStore from "@/app/_store/authStore";
import {color} from "@/app/_styles/tokens";
import {Card, Display, EmptyState, ErrorNote, LoadingRows, ScrollCard, SearchInput, StackTopBar} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import React, {useState} from "react";
import PlayerFrame from "./PlayerFrame";
import {EntryLine} from "./PlayerParts";

// Prijavljene ekipe (Claude Design "Natjecanja" N2): every team in the tournament, the viewer's first, searched by a
// team's or a player's name
export default function EntriesPage({id}: {id: number}) {
  const meId = useAuthStore((s) => s.user?.id ?? null);
  const {tournament: t, error, notFound, reload} = useTournament(id);
  const nav = useNavStack("Prijavljene ekipe", `/turniri/${id}`);
  const [query, setQuery] = useState("");
  const list = (t?.entries ?? []).filter((e) => matchesQuery(`${e.team_name} ${e.players.map((p) => p.name).join(" ")}`, query));
  return (
    <PlayerFrame fill>
      <StackTopBar eyebrow="Turnir" nav={nav} />
      <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "4px", px: "4px"}}>
        <Display size={30} sx={{lineHeight: 1.05}}>
          Prijavljene ekipe
        </Display>
        {t && (
          <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
            {t.name} · {count(t.teams, NOUN.ekipa)}
          </Box>
        )}
      </Box>
      <SearchInput variant="white" height={50} placeholder="Traži ekipu ili igrača" aria-label="Traži ekipu ili igrača" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
      {notFound ? (
        <Card>
          <EmptyState>Ovaj turnir ne postoji.</EmptyState>
        </Card>
      ) : error && !t ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !t ? (
        <ScrollCard>
          <LoadingRows rows={8} height={64} />
        </ScrollCard>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState>{query ? "Nema ekipe ni igrača s tim imenom." : "Još nema prijavljenih ekipa."}</EmptyState>
        </Card>
      ) : (
        <ScrollCard component="ul" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "22px"}}>
          {list.map((e, i) => (
            <EntryLine key={e.team_id} e={e} meId={meId} last={i === list.length - 1} />
          ))}
        </ScrollCard>
      )}
    </PlayerFrame>
  );
}
