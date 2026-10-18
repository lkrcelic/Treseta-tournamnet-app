import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLeagueStandingsWithMovement} from "@/app/_lib/service/league/getStandings";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {teamPhotoUrls} from "@/app/_lib/service/players/photos";

// Ukupni poredak (public): {standings, showMovement, movementSince}, every row with its +/− since the league's previous
// night (see getLeagueStandingsWithMovement). A logged-in viewer also gets each team's photo_url (the photos they may
// see); anyone else gets the teams' letters.
export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const leagueId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either
  if (!isDbId(leagueId)) return NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

  try {
    const [standings, viewer] = await Promise.all([getLeagueStandingsWithMovement(leagueId), getAuthorizedUser(request)]);
    const photos = await teamPhotoUrls(viewer, standings.standings.map((s) => s.team_id));

    return NextResponse.json(
      {...standings, standings: standings.standings.map((s) => ({...s, photo_url: photos.get(s.team_id) ?? null}))},
      {status: STATUS.OK, headers: {"Cache-Control": "private, no-store"}}
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Poredak se nije učitao."}, {status: STATUS.ServerError});
  }
}
