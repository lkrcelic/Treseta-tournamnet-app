import {searchSuffix} from "@/app/_lib/league";
import {activeLeagueId} from "@/app/_lib/service/league/leagues";
import {notFound, redirect} from "next/navigation";

// /league/current/<page> opens <page> of the league being played now, so links never name a league. The query goes
// along (?team= highlights a team in the standings, ?date= picks a night of the daily standings).
export const dynamic = "force-dynamic";

const PAGES = new Set(["daily-standings", "standings", "manage"]);

export default async function CurrentLeague({
  params,
  searchParams,
}: {
  params: {page?: string[]};
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const page = params.page?.join("/") ?? "standings";
  if (!PAGES.has(page)) notFound();
  const id = await activeLeagueId();
  if (id == null) redirect("/");
  redirect(`/league/${id}/${page}${searchSuffix(searchParams)}`);
}
