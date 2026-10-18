"use client";

import {useScrollMemory} from "@/app/_hooks/useBackRestore";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagues, {useLeagueList} from "@/app/_hooks/useLeagues";
import useMyTeams from "@/app/_hooks/useMyTeams";
import useConferences from "@/app/_hooks/useConferences";
import useConferenceFilter from "@/app/_hooks/useConferenceFilter";
import useAdminPhone from "@/app/_hooks/useAdminPhone";
import useNavStack from "@/app/_hooks/useNavStack";
import useShortWindow from "@/app/_hooks/useShortWindow";
import {useLeagueStandings} from "@/app/_hooks/useStandings";
import {leagueDateString} from "@/app/_lib/dates";
import {leagueEnded} from "@/app/_lib/league";
import {leagueStatusLine} from "@/app/_lib/ui/profiles";
import {highlightParam, inConference, splitPodium, standingsTeamHref, toStandingsRows} from "@/app/_lib/ui/standings";
import {color} from "@/app/_styles/tokens";
import {ConferenceFilter} from "@/app/_ui/league/ConferenceFilter";
import {
  Card,
  DesktopShell,
  Display,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  LeagueEyebrowButton,
  LeagueMenuButton,
  LoadingRows,
  MovementNote,
  Podium,
  PrimaryButton,
  Screen,
  ScrollCard,
  scrollIntoMiddle,
  StackTopBar,
  StandingsGrid,
  StandingsRows,
} from "@/app/_ui/sp";
import {DesktopFrame} from "@/app/_ui/profiles/PageParts";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import useAuthStore from "@/app/_store/authStore";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {Suspense, useEffect, useMemo, useRef} from "react";

// Season table of a league: podium for the top three, then everyone else. Each row opens its team's page (for a
// logged-in player; the table itself is public), and Back from it finds the list where it was left. Opened from a
// Team page (?team=<id>, design 13d) it highlights that team instead of the player's own, scrolls to it and is a page
// of the stack: Back to the team (and Home on the phone) instead of the league picker. A league with conferences
// shows each team's dot, and a conference's view shows only its teams, ranked from 1.
export default function LeagueStandingsPage() {
  return (
    <Suspense fallback={null}>
      <LeagueStandings />
    </Suspense>
  );
}

function LeagueStandings() {
  const params = useParams<{leagueId: string}>();
  const leagueId = Number(params.leagueId);
  const highlightTeamId = highlightParam(useSearchParams().get("team"));
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const adminPhone = useAdminPhone();
  const short = useShortWindow();
  const leagues = useLeagues(leagueId);
  const {teams} = useMyTeams();
  const myTeamNames = useMemo(() => teams.map((t) => t.team_name), [teams]);
  const {standings, movement: leagueMovement, loading, error, reload} = useLeagueStandings(leagueId);
  const conferences = useConferences(leagueId);
  const [conf, setConf] = useConferenceFilter(leagueId, conferences.conferences);
  const confName = conferences.conferences.find((c) => c.id === conf)?.name;
  const allRows = useMemo(
    () => toStandingsRows(standings, {myTeamNames, highlightTeamId, conferenceOf: conferences.of}),
    [standings, myTeamNames, highlightTeamId, conferences]
  );
  const rows = useMemo(() => inConference(allRows, conf), [allRows, conf]);
  // the +/− is the whole league's change of place: a conference's view (ranked from 1) doesn't show it
  const movement = conf == null ? leagueMovement : {...leagueMovement, show: false};
  const {podium, rest} = splitPodium(rows);
  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? "";
  const tableName = confName ? `${leagueName} · ${confName}` : leagueName;
  const filter = !error && <ConferenceFilter conferences={conferences.conferences} value={conf} onChange={setConf} sx={{flex: "none"}} />;
  // the list itself (useLeagues has a stand-in with the app's name for the picker until it is in, and when it didn't load)
  const list = useLeagueList();
  const league = list.leagues?.find((l) => l.id === leagueId) ?? null;
  const settled = list.leagues != null || list.error;
  // the name a Team page opened from a row shows on its back pill
  const nav = useNavStack(settled ? leagueName || null : null);
  const changeLeague = (id: number) => router.router.push(`/league/${id}/standings`);
  // the season table is public; visitors who are not logged in get a login button instead of "home", and rows that
  // aren't links (the Team pages need a login)
  const signedIn = useAuthStore((s) => s.user != null);
  const rowHref = signedIn ? standingsTeamHref : undefined;
  // opened from a Team page: Back and Home instead of the league picker (13d)
  const fromTeam = highlightTeamId != null && signedIn;
  // "Sezona 2025 · završeno", by the same rule as the Team page's league rows
  const status = league ? leagueStatusLine(league.season, !leagueEnded(league.endDate ?? null, league.lastNight ?? null, leagueDateString()), {lower: true}) : null;
  // the list that scrolls (phone card, desktop table)
  const scroller = useScrollMemory("standings");

  // the highlighted team in view once the table is there, in the middle of the list (a row of the pinned podium shows
  // itself); Back to the page finds the list where it was left instead
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (highlightTeamId == null || loading || rows.length === 0) return;
    const key = `${leagueId}:${highlightTeamId}:${isDesktop}`;
    const box = scroller.element();
    if (scrolledTo.current === key || !box) return;
    scrolledTo.current = key;
    const row = box.querySelector<HTMLElement>("[data-highlight]");
    const pinned = box.querySelector<HTMLElement>("[data-pinned]");
    if (scroller.restored() || !row || pinned?.contains(row)) return;
    scrollIntoMiddle(row, box, pinned?.offsetHeight ?? 0);
  }, [highlightTeamId, leagueId, isDesktop, loading, rows, scroller]);

  const content = (desktop: boolean) => {
    if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
    // the conferences too, so the rows don't show up without their dots first
    if (loading || !conferences.ready) {
      return desktop ? (
        <Card sx={{flex: 1, overflow: "hidden"}}>
          <LoadingRows rows={10} height={56} />
        </Card>
      ) : (
        <ScrollCard>
          <LoadingRows rows={8} />
        </ScrollCard>
      );
    }
    if (rows.length === 0) {
      return (
        <Card>
          <EmptyState>{conf ? "Ova konferencija još nema ekipa." : "Još nema rezultata u ovoj ligi."}</EmptyState>
        </Card>
      );
    }
    if (desktop) {
      // the +/− (since the league's previous night) is the last column, a pill on the podium and a note under the
      // table, which stays put while the rows scroll
      const grid = (
        <StandingsGrid
          rows={podium.length ? rest : rows}
          columns={["played", "wins", "draws", "losses"]}
          showLive={false}
          showMovement={movement.show}
          caption={`Ukupni poredak: ${tableName}`}
          rowHref={rowHref}
        />
      );
      return (
        <>
          <Podium rows={podium} showMovement={movement.show} rowHref={rowHref} />
          {movement.show && movement.since ? (
            <Card sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
              <Box ref={scroller.ref} sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
                {grid}
              </Box>
              <MovementNote since={movement.since} />
            </Card>
          ) : (
            <Card ref={scroller.ref} sx={{flex: 1, minHeight: 0, overflowY: "auto", borderRadius: "24px"}}>
              {grid}
            </Card>
          )}
        </>
      );
    }
    return (
      <ScrollCard ref={scroller.ref} aria-label={`Ukupni poredak: ${tableName}`}>
        <StandingsRows rows={podium.length ? rest : rows} podium={podium} withPlayed head showMovement={movement.show} rowHref={rowHref} />
      </ScrollCard>
    );
  };

  // the league's name over the title (13d), once the list is in
  const eyebrow = settled ? leagueName || "\u00a0" : "\u00a0";

  if (isDesktop && fromTeam) {
    // as a Team page (Profiles P:145-174, P:320-357): the back pill on top of the page column (in a short window up
    // in the header row), then the league's name and the title, the podium and the table
    return (
      <DesktopFrame embedded={false} short={short} nav={nav} active="league">
        <Box component="header" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: color.navy, overflowWrap: "anywhere"}}>{eyebrow}</Box>
          <Display size={40} sx={{lineHeight: 1}}>
            Ukupni poredak
          </Display>
        </Box>
        <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "20px"}}>{content(true)}</Box>
      </DesktopFrame>
    );
  }

  if (isDesktop) {
    return (
      <DesktopShell
        active="league"
        eyebrow={leagueName}
        title="Ukupni poredak"
        right={<LeagueMenuButton leagues={leagues} value={leagueId} onChange={changeLeague} />}
      >
        {filter}
        {content(true)}
      </DesktopShell>
    );
  }

  if (fromTeam) {
    return (
      <Screen fill gap={14}>
        <StackTopBar eyebrow="Liga" nav={nav} />
        <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "6px", px: "4px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy, overflowWrap: "anywhere"}}>{eyebrow}</Box>
          {/* one line: a wrapped title's second line went under the list */}
          <Display size={34} sx={{lineHeight: 1, whiteSpace: "nowrap"}}>
            Ukupni poredak
          </Display>
          <Box sx={{fontSize: 14, color: color.muted}}>{status ?? "\u00a0"}</Box>
        </Box>
        {content(false)}
      </Screen>
    );
  }

  return (
    <Screen fill>
      {/* the admin's phone (admin-mobile 03): Back to Večer lige at the top instead of Početni zaslon at the bottom */}
      {adminPhone && (
        <Box sx={{flex: "none", mx: "-6px"}}>
          <IconCircleButton label="Natrag" size={44} onClick={nav.back} sx={{"& svg": {fontSize: 26}}}>
            <ChevronLeftRoundedIcon />
          </IconCircleButton>
        </Box>
      )}
      <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "6px", px: "4px", minWidth: 0}}>
        <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={changeLeague} />
        {/* one line: a wrapped title's second line went under the list */}
        <Display size={34} sx={{lineHeight: 1, whiteSpace: "nowrap"}}>
          Ukupni poredak
        </Display>
      </Box>
      {filter}
      {content(false)}
      {adminPhone ? null : signedIn ? (
        <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
          Početni zaslon
        </PrimaryButton>
      ) : (
        <PrimaryButton icon={<LoginRoundedIcon />} onClick={() => router.push("/login")}>
          Prijava
        </PrimaryButton>
      )}
    </Screen>
  );
}
