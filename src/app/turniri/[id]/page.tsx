"use client";

import TournamentPage from "@/app/_ui/tournaments/TournamentPage";
import {useParams} from "next/navigation";

// A tournament's page (public; signing up needs a login)
export default function Tournament() {
  const params = useParams<{id: string}>();
  return <TournamentPage id={Number(params.id)} />;
}
