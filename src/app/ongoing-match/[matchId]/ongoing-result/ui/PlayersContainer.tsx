import React from "react";
import {Box} from "@mui/material";
import {Grid} from "@mui/system";
import {PlayerPairResponse} from "@/app/_interfaces/playerPair";
import {PlayerResponse} from "@/app/_interfaces/player";

type PlayersContainerProps = {
    playerPair1?: PlayerPairResponse;
    playerPair2?: PlayerPairResponse;
    children: (player?: PlayerResponse) => React.ReactNode;
};

export default function PlayersContainer({playerPair1, playerPair2, children}: PlayersContainerProps) {
    const players = [playerPair1?.player1, playerPair2?.player1, playerPair1?.player2, playerPair2?.player2]

    return (
        <Box sx={{alignItems: "center"}}>
            <Grid container rowSpacing={2}>
                {players.map((player, index) => (
                    <Grid
                        key={player?.id}
                        item
                        size={{xs: 6, sm: 6, md: 6}}
                        sx={{
                            display: "flex",
                            justifyContent: index % 2 ? "flex-end" : "flex-start",
                        }}
                    >
                        {children(player)}
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
