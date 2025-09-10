"use client";

import {PlayerPartialResponse} from "@/app/_interfaces/player";
import {TeamResponse} from "@/app/_interfaces/team";
import useRoundStore from "../../_store/roundStore";
import useAuthStore from "@/app/_store/authStore";
import PlayerPairSelector from "@/app/round/ui/PlayerPairSelector";
import {Box, Typography} from "@mui/material";
import {Grid} from "@mui/system";

export default function PlayersAroundTable() {
  const {
    roundData: {team1, team2},
  } = useRoundStore();
  const {user} = useAuthStore();

  const isUserInTeam = (team: TeamResponse | null | undefined) => {
    if (!user) return false;
    return !!team?.teamPlayers?.some((tp: {player?: PlayerPartialResponse}) => tp?.player?.id === user.id);
  };

  // Derive display order so user's team is first
  const userInTeam1 = isUserInTeam(team1);
  const userInTeam2 = isUserInTeam(team2);
  const displayTeam1 = userInTeam1 ? team1 : userInTeam2 ? team2 : team1;
  const displayTeam2 = userInTeam1 ? team2 : userInTeam2 ? team1 : team2;

  return (
    <Grid container spacing={2} sx={{position: "relative", width: "100%", height: "400px"}}>
      <PlayerPairSelector team1={displayTeam1} team2={displayTeam2} />
      <Grid
        item
        size={{xs: 12}}
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            width: "190px",
            height: "190px",
            borderRadius: "50%",
            backgroundColor: "rgba(237, 224, 191, 0.4)", //TODO
            borderColor: "secondary.main",
            borderStyle: "solid",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography variant="h7" color="team1">
            {displayTeam1?.team_name}
          </Typography>
          <Typography variant="subtitle2" padding={1}>
            VS
          </Typography>
          <Typography variant="h7" color="team2">
            {displayTeam2?.team_name}
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
}
