import {PlayerPartialResponse} from "@/app/_interfaces/player";
import {TeamResponse} from "@/app/_interfaces/team";
import useMatchStore from "@/app/_store/matchStore";
import PlayerName from "@/app/_ui/PlayerName";
import {Button, Menu, MenuItem} from "@mui/material";
import {Grid} from "@mui/system";
import React, {useState} from "react";

export default function PlayerPairSelector({team1, team2}: {team1: TeamResponse; team2: TeamResponse}) {
  const {
    ongoingMatch: {seating_order},
    setSeatingOrder,
  } = useMatchStore();

  const handlePlayerSelection = (seatIndex: number) => (player: PlayerPartialResponse | null) => {
    const newSeatingOrder = [...seating_order];
    newSeatingOrder[seatIndex] = player;
    setSeatingOrder(newSeatingOrder);
  };

  return (
    <>
      <Grid item size={{xs: 6}} sx={{display: "flex", justifyContent: "flex-start", alignItems: "flex-start"}}>
        <TeamPlayerSelector
          selectedPlayer={seating_order![0]}
          setSelectedPlayer={handlePlayerSelection(0)}
          selectedTeammate={seating_order![2]}
          team={team1 as TeamResponse}
          color="team1"
        />
      </Grid>
      <Grid item size={{xs: 6}} sx={{display: "flex", justifyContent: "flex-end", alignItems: "flex-start"}}>
        <TeamPlayerSelector
          selectedPlayer={seating_order![1]}
          setSelectedPlayer={handlePlayerSelection(1)}
          selectedTeammate={seating_order![3]}
          team={team2 as TeamResponse}
          color="team2"
        />
      </Grid>
      <Grid item size={{xs: 6}} sx={{display: "flex", justifyContent: "flex-start", alignItems: "flex-end"}}>
        <TeamPlayerSelector
          selectedPlayer={seating_order![3]}
          setSelectedPlayer={handlePlayerSelection(3)}
          selectedTeammate={seating_order![1]}
          team={team2 as TeamResponse}
          color="team2"
        />
      </Grid>
      <Grid item size={{xs: 6}} sx={{display: "flex", justifyContent: "flex-end", alignItems: "flex-end"}}>
        <TeamPlayerSelector
          selectedPlayer={seating_order![2]}
          setSelectedPlayer={handlePlayerSelection(2)}
          selectedTeammate={seating_order![0]}
          team={team1 as TeamResponse}
          color="team1"
        />
      </Grid>
    </>
  );
}

type PlayerSelectorProps = {
  selectedPlayer: PlayerPartialResponse | null;
  setSelectedPlayer: (player: PlayerPartialResponse | null) => void;
  selectedTeammate: PlayerPartialResponse | null;
  color: "team1" | "team2";
  team: TeamResponse;
};

function TeamPlayerSelector({selectedPlayer, setSelectedPlayer, selectedTeammate, color, team}: PlayerSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (player: PlayerPartialResponse | null) => {
    setSelectedPlayer(player);
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        variant={(selectedPlayer ? "contained" : "outlined") as "contained" | "outlined"}
        onClick={handleButtonClick}
        color={color}
        sx={{
          width: "100px",
          height: "100px",
          borderRadius: "8px",
        }}
      >
        {selectedPlayer ? (
          <PlayerName firstName={selectedPlayer.first_name} lastName={selectedPlayer.last_name} />
        ) : (
          "Izaberi igrača"
        )}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{
          paper: {
            style: {
              maxHeight: 100,
              width: "20ch",
              overflowY: "auto",
            },
          },
        }}
      >
        <MenuItem key="empty-option" onClick={() => handleMenuItemClick(null)}>
          Obriši
        </MenuItem>
        {team?.teamPlayers
          .filter((p) => !(selectedTeammate?.id === p.player.id))
          .map((p) => (
            <MenuItem key={p.player.id} onClick={() => handleMenuItemClick(p.player)}>
              <PlayerName firstName={p.player.first_name} lastName={p.player.last_name} short={false} />
            </MenuItem>
          ))}
      </Menu>
    </>
  );
}
