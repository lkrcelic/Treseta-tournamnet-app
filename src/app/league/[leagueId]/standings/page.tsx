"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagues from "@/app/_hooks/useLeagues";
import useMyTeams from "@/app/_hooks/useMyTeams";
import {useLeagueStandings} from "@/app/_hooks/useStandings";
import {splitPodium, toStandingsRows} from "@/app/_lib/ui/standings";
import {
  Card,
  DesktopShell,
  Display,
  EmptyState,
  ErrorNote,
  LeagueEyebrowButton,
  LeagueMenuButton,
  LoadingRows,
  Podium,
  PrimaryButton,
  Screen,
  ScrollCard,
  StandingsGrid,
  StandingsRows,
} from "@/app/_ui/sp";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import useAuthStore from "@/app/_store/authStore";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useMemo} from "react";

// Season table of a league: podium for the top three, then everyone else
export default function LeagueStandings() {
  const params = useParams<{leagueId: string}>();
  const leagueId = Number(params.leagueId);
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const leagues = useLeagues(leagueId);
  const {teams} = useMyTeams();
  const myTeamNames = useMemo(() => teams.map((t) => t.team_name), [teams]);
  const {standings, loading, error, reload} = useLeagueStandings(leagueId);
  const rows = useMemo(() => toStandingsRows(standings, myTeamNames), [standings, myTeamNames]);
  const {podium, rest} = splitPodium(rows);
  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? "";
  const changeLeague = (id: number) => router.router.push(`/league/${id}/standings`);
  // the season table is public; visitors who are not logged in get a login button instead of "home"
  const signedIn = useAuthStore((s) => s.user != null);

  const content = (desktop: boolean) => {
    if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
    if (loading) {
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
          <EmptyState>Još nema rezultata u ovoj ligi.</EmptyState>
        </Card>
      );
    }
    if (desktop) {
      return (
        <>
          <Podium rows={podium} />
          <Card sx={{flex: 1, minHeight: 0, overflowY: "auto", borderRadius: "24px"}}>
            <StandingsGrid
              rows={podium.length ? rest : rows}
              columns={["played", "wins", "draws", "losses"]}
              showLive={false}
              caption={`Ukupni poredak: ${leagueName}`}
            />
          </Card>
        </>
      );
    }
    return (
      <ScrollCard aria-label={`Ukupni poredak: ${leagueName}`}>
        <StandingsRows rows={podium.length ? rest : rows} podium={podium} withPlayed />
      </ScrollCard>
    );
  };

  if (isDesktop) {
    return (
      <DesktopShell
        active="league"
        eyebrow={leagueName}
        title="Ukupni poredak"
        right={<LeagueMenuButton leagues={leagues} value={leagueId} onChange={changeLeague} />}
      >
        {content(true)}
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "6px", px: "4px", minWidth: 0}}>
        <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={changeLeague} />
        <Display size={36} sx={{lineHeight: 1}}>
          Ukupni poredak
        </Display>
      </Box>
      {content(false)}
      {signedIn ? (
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
