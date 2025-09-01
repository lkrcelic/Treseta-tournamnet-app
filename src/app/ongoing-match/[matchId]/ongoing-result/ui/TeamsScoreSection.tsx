import useRoundStore from "@/app/_store/RoundStore";
import useAuthStore from "@/app/_store/authStore";
import useResultStore from "@/app/_store/bela/resultStore";
import {TeamScoreBox} from "@/app/ongoing-match/[matchId]/ongoing-result/ui/TeamScoreBox";
import {Grid} from "@mui/system";
import {usePathname} from "next/navigation";
import React from "react";

type ScoreSectionType = {
  team1Color: string;
  team2Color: string;
  team1Value: string | number;
  team2Value: string | number;
  team1SecondValue: string | number;
  team2SecondValue: string | number;
  textVariant: "h4" | "h6";
  label: string | undefined;
  onClick: null | ((team: "team1" | "team2") => void);
  team1ButtonVariant: "contained" | "outlined";
  team2ButtonVariant: "contained" | "outlined";
};

export default function TeamsScoreSection() {
  const {
    resultData: {
      player_pair1_game_points,
      player_pair2_game_points,
      player_pair1_announcement_points,
      player_pair2_announcement_points,
      activeTeam,
    },
    setActiveTeam,
  } = useResultStore();
  const pathname = usePathname();
  const {
    roundData: {team1, team2},
  } = useRoundStore();
  const {user} = useAuthStore();

  // Decide orientation: show current user's team on the left
  const userId = user?.id;
  const team1PlayerIds = team1?.teamPlayers?.map((tp) => tp.player.id) ?? [];
  const team2PlayerIds = team2?.teamPlayers?.map((tp) => tp.player.id) ?? [];
  const isUserInTeam1 = userId != null && team1PlayerIds.includes(userId);
  const isUserInTeam2 = userId != null && team2PlayerIds.includes(userId);
  const showTeam1Left = isUserInTeam1 || (!isUserInTeam1 && !isUserInTeam2);

  const getScoreSectionType = (): ScoreSectionType => {
    if (pathname.endsWith("/trump-caller")) {
      return {
        team1Color: "team1",
        team2Color: "team2",
        team1Value: (showTeam1Left ? team1?.team_name : team2?.team_name) || "MI",
        team2Value: (showTeam1Left ? team2?.team_name : team1?.team_name) || "VI",
        team1SecondValue: "",
        team2SecondValue: "",
        textVariant: "h6",
        team1ButtonVariant: "contained",
        team2ButtonVariant: "contained",
        label: undefined,
        onClick: null,
      };
    } else if (pathname.endsWith("/announcement")) {
      return {
        team1Color: "team1",
        team2Color: "team2",
        team1Value: showTeam1Left ? player_pair1_announcement_points : player_pair2_announcement_points,
        team2Value: showTeam1Left ? player_pair2_announcement_points : player_pair1_announcement_points,
        team1SecondValue: "",
        team2SecondValue: "",
        textVariant: "h4",
        label: "Zvanja",
        team1ButtonVariant: "contained",
        team2ButtonVariant: "contained",
        onClick: null,
      };
    } else if (pathname.endsWith("/score")) {
      return {
        team1Color: "team1",
        team2Color: "team2",
        team1Value: showTeam1Left ? player_pair1_game_points : player_pair2_game_points,
        team2Value: showTeam1Left ? player_pair2_game_points : player_pair1_game_points,
        team1SecondValue: showTeam1Left
          ? player_pair1_game_points + player_pair1_announcement_points
          : player_pair2_game_points + player_pair2_announcement_points,
        team2SecondValue: showTeam1Left
          ? player_pair2_game_points + player_pair2_announcement_points
          : player_pair1_game_points + player_pair1_announcement_points,
        textVariant: "h4",
        team1ButtonVariant: activeTeam === (showTeam1Left ? "team1" : "team2") ? "contained" : "outlined",
        team2ButtonVariant: activeTeam === (showTeam1Left ? "team2" : "team1") ? "contained" : "outlined",
        label: "Igra",
        onClick: setActiveTeam,
      };
    }
  };

  const scoreSectionType = getScoreSectionType();

  React.useEffect(() => {
    if (pathname.endsWith("/score")) {
      setActiveTeam(showTeam1Left ? "team1" : "team2");
    }
  }, [pathname, showTeam1Left, setActiveTeam]);

  return (
    <Grid container spacing={6} alignItems="space-between" sx={{width: "100%"}}>
      <Grid item size={{xs: 6}}>
        <TeamScoreBox
          label={scoreSectionType.label}
          teamColor={scoreSectionType.team1Color}
          value={String(scoreSectionType.team1Value)}
          onClick={() => scoreSectionType.onClick?.(showTeam1Left ? "team1" : "team2")}
          textVariant={scoreSectionType.textVariant}
          secondValue={String(scoreSectionType?.team1SecondValue)}
          buttonVariant={scoreSectionType.team1ButtonVariant}
        />
      </Grid>

      <Grid item size={{xs: 6}}>
        <TeamScoreBox
          label={scoreSectionType.label}
          teamColor={scoreSectionType.team2Color}
          value={String(scoreSectionType.team2Value)}
          onClick={() => scoreSectionType.onClick?.(showTeam1Left ? "team2" : "team1")}
          textVariant={scoreSectionType.textVariant}
          secondValue={String(scoreSectionType?.team2SecondValue)}
          buttonVariant={scoreSectionType.team2ButtonVariant}
        />
      </Grid>
    </Grid>
  );
}
