"use client";

import EntriesPage from "@/app/_ui/tournaments/EntriesPage";
import {useParams} from "next/navigation";

// Every team signed up for a tournament (public)
export default function TournamentEntries() {
  const params = useParams<{id: string}>();
  return <EntriesPage id={Number(params.id)} />;
}
