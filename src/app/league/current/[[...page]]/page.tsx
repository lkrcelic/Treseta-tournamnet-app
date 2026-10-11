import {activeLeagueId} from "@/app/_lib/service/league/leagues";
import {notFound, redirect} from "next/navigation";

// /league/current/<page> opens <page> of the league being played now, so links never name a league
export const dynamic = "force-dynamic";

const PAGES = new Set(["daily-standings", "standings", "manage"]);

export default async function CurrentLeague({params}: {params: {page?: string[]}}) {
  const page = params.page?.join("/") ?? "standings";
  if (!PAGES.has(page)) notFound();
  const id = await activeLeagueId();
  if (id == null) redirect("/");
  redirect(`/league/${id}/${page}`);
}
