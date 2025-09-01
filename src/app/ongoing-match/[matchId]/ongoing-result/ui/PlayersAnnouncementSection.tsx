"use client";

import React from "react";
import useAnnouncementStore from "@/app/_store/bela/announcementStore";
import {Button, Typography} from "@mui/material";
import PlayersContainer from "@/app/ongoing-match/[matchId]/ongoing-result/ui/PlayersContainer";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import {PlayerPartialResponse} from "@/app/_interfaces/player";
import PlayerName from "@/app/_ui/PlayerName";
import useAuthStore from "@/app/_store/authStore";

export default function PlayersAnnouncementSection() {
    const {
        playersAnnouncements,
        activePlayerId,
        setActivePlayerId,
    } = useAnnouncementStore();
    const {ongoingMatch: {playerPair1, playerPair2}} = useOngoingMatchStore();
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
                <PlayerAnnouncementBox
                    key={player?.id}
                    player={player}
                    announcementValue={
                        playersAnnouncements[player?.id].totalAnnouncements || 0
                    }
                    teamColor={player === leftPair?.player1 || player === leftPair?.player2 ? "team1" : "team2"}
                    isActive={activePlayerId === player?.id}
                    onClick={() => setActivePlayerId(player?.id)}
                />
            )}
        </PlayersContainer>
    );
}

type AnnouncementBoxProps = {
    player: PlayerPartialResponse;
    announcementValue: number | string;
    teamColor: string;
    isActive: boolean;
    onClick?: () => void;
};

function PlayerAnnouncementBox({
                                   player,
                                   announcementValue,
                                   teamColor,
                                   onClick,
                                   isActive
                               }: AnnouncementBoxProps) {
    return (
        <Button
            onClick={onClick}
            color={teamColor}
            variant={(isActive ? 'contained' : 'outlined') as 'contained' | 'outlined'}
            sx={{
                width: "100px",
                height: "100px",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                cursor: "pointer",
                paddingX: "5px",
            }}
        >
            <Typography variant="subtitle2">
              <PlayerName firstName={player.first_name} lastName={player.last_name} />
            </Typography>
            <Typography variant="h6">{announcementValue}</Typography>
        </Button>
    );
}
