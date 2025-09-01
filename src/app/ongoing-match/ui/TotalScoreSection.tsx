import useRoundStore from "@/app/_store/RoundStore";
import useAuthStore from "@/app/_store/authStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import {Box, Typography} from "@mui/material";
import {Grid} from "@mui/system";

export default function TotalScoreSection() {
  const {
    ongoingMatch: {player_pair1_score, player_pair2_score},
  } = useOngoingMatchStore();
  const {
    roundData: {team1_wins, team2_wins, team1, team2},
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

  const leftWins = showTeam1Left ? team1_wins : team2_wins;
  const rightWins = showTeam1Left ? team2_wins : team1_wins;
  const leftScore = showTeam1Left ? player_pair1_score : player_pair2_score;
  const rightScore = showTeam1Left ? player_pair2_score : player_pair1_score;
  const leftTeamName = showTeam1Left ? team1?.team_name : team2?.team_name;
  const rightTeamName = showTeam1Left ? team2?.team_name : team1?.team_name;

  return (
    <Grid container justifyContent="space-between" alignItems="center" spacing={6}>
      <Grid item size={{xs: 6}}>
        <Grid container direction="column" alignItems="center">
          <Box
            sx={{
              backgroundColor: "team1.main",
              color: "team1.contrastText",
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Typography variant="h6" color="#fff">
              {leftWins}
            </Typography>
          </Box>
          <Typography variant="h1" fontWeight="bold">
            {leftScore}
          </Typography>
          <Typography variant="h7">{leftTeamName}</Typography>
        </Grid>
      </Grid>
      <Grid item size={{xs: 6}}>
        <Grid container direction="column" alignItems="center">
          <Box
            sx={{
              backgroundColor: "team2.main",
              color: "team2.contrastText",
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Typography variant="h6" color="#fff">
              {rightWins}
            </Typography>
          </Box>
          <Typography variant="h1" fontWeight="bold">
            {rightScore}
          </Typography>
          <Typography variant="h7">{rightTeamName}</Typography>
        </Grid>
      </Grid>
    </Grid>
  );
}
