"use client";

import ResultsPage from "@/app/_ui/tournaments/ResultsPage";
import {useParams} from "next/navigation";

// Poredak i rezultati of a tournament (public)
export default function TournamentResults() {
  const params = useParams<{id: string}>();
  return <ResultsPage id={Number(params.id)} />;
}
