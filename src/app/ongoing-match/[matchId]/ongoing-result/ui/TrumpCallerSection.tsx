"use client";

import {PlayerPartialResponse} from "@/app/_interfaces/player";
import useAuthStore from "@/app/_store/authStore";
import useResultStore from "@/app/_store/bela/resultStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import PlayerName from "@/app/_ui/PlayerName";
import PlayersContainer from "@/app/ongoing-match/[matchId]/ongoing-result/ui/PlayersContainer";
import {Button, Typography} from "@mui/material";

export default function TrumpCallerSection() {
  const {
    ongoingMatch: {playerPair1, playerPair2},
  } = useOngoingMatchStore();
  const {
    resultData: {trump_caller_id},
    setTrumpCallerId,
  } = useResultStore();
  const {user} = useAuthStore();

  // Decide orientation: show current user's team on the left
  const userId = user?.id;
  const isUserInTeam1 = playerPair1?.player_id1 == userId || playerPair1?.player_id2 == userId;
  const isUserInTeam2 = playerPair2?.player_id1 == userId || playerPair2?.player_id2 == userId;
  const showTeam1Left = isUserInTeam1 || (!isUserInTeam1 && !isUserInTeam2);

  // Orient pairs for display depending on current user
  const leftPair = showTeam1Left ? playerPair1 : playerPair2;
  const rightPair = showTeam1Left ? playerPair2 : playerPair1;

  return (
    <PlayersContainer playerPair1={leftPair} playerPair2={rightPair}>
      {(player) => (
        <TrumpCallerButton
          key={player?.id}
          player={player}
          color={[leftPair?.player_id1, leftPair?.player_id2].includes(player?.id) ? "team1" : "team2"}
          onClick={() => setTrumpCallerId(player?.id)}
          isTrumpCaller={player?.id === trump_caller_id}
        />
      )}
    </PlayersContainer>
  );
}

type PlayerBoxProps = {
  player: PlayerPartialResponse;
  color: string;
  isTrumpCaller: boolean;
  onClick?: () => void;
};

function TrumpCallerButton({player, color, isTrumpCaller, onClick}: PlayerBoxProps) {
  return (
    <Button
      onClick={onClick}
      color={color}
      variant={(isTrumpCaller ? "contained" : "outlined") as "contained" | "outlined"}
      sx={{
        width: "100px",
        height: "100px",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <Typography variant="subtitle2">
        <PlayerName firstName={player.first_name} lastName={player.last_name} />
      </Typography>
    </Button>
  );
}
