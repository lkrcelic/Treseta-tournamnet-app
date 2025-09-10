import useAuthStore from "@/app/_store/authStore";
import useResultStore from "@/app/_store/resultStore";
import useRoundStore from "../../../../_store/roundStore";
import {TeamScoreBox} from "@/app/match/[matchId]/result/ui/TeamScoreBox";
import {Grid} from "@mui/system";
import React from "react";

export default function TeamsScoreSection() {
  const {
    resultData: {team1_game_points, team2_game_points, activeTeam},
    setActiveTeam,
  } = useResultStore();
  const {
    roundData: {team1, team2},
  } = useRoundStore();
  const {user} = useAuthStore();


  // Determine which team the current user belongs to
  const userId = user?.id;
  const team1PlayerIds = team1?.teamPlayers?.map((tp) => tp.player.id) ?? [];
  const team2PlayerIds = team2?.teamPlayers?.map((tp) => tp.player.id) ?? [];
  const isUserInTeam1 = userId != null && team1PlayerIds.includes(userId);
  const isUserInTeam2 = userId != null && team2PlayerIds.includes(userId);

  // Fallback: if user not found in either team, default to team1 on the left
  const showTeam1Left = isUserInTeam1 || (!isUserInTeam1 && !isUserInTeam2);

  const leftScore = showTeam1Left ? team1_game_points : team2_game_points;
  const rightScore = showTeam1Left ? team2_game_points : team1_game_points;
  const leftTeamName = showTeam1Left ? team1?.team_name : team2?.team_name;
  const rightTeamName = showTeam1Left ? team2?.team_name : team1?.team_name;

  // Set the active team based on user's team on component mount
  React.useEffect(() => {
    const desired = showTeam1Left ? "team1" : "team2";
    if (activeTeam !== desired) {
      setActiveTeam(desired);
    }
  }, [showTeam1Left, setActiveTeam]);

  return (
    <Grid container spacing={6} alignItems="space-between" sx={{width: "100%"}}>
      <Grid size={{xs: 6}}>
        <TeamScoreBox
          teamName={leftTeamName}
          teamColor="team1"
          value={leftScore}
          onClick={() => setActiveTeam(showTeam1Left ? "team1" : "team2")}
          buttonVariant={activeTeam === (showTeam1Left ? "team1" : "team2") ? "contained" : "outlined"}
        />
      </Grid>
      <Grid size={{xs: 6}}>
        <TeamScoreBox
          teamName={rightTeamName}
          teamColor="team2"
          value={rightScore}
          onClick={() => setActiveTeam(showTeam1Left ? "team2" : "team1")}
          buttonVariant={activeTeam === (showTeam1Left ? "team2" : "team1") ? "contained" : "outlined"}
        />
      </Grid>
    </Grid>
  );
}
