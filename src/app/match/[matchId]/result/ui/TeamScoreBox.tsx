import {Button, Typography} from "@mui/material";

type ScoreBoxProps = {
  teamName?: string;
  teamColor: "team1" | "team2";
  value: string | number;
  onClick?: () => void;
  buttonVariant: "contained" | "outlined";
};

export function TeamScoreBox({teamName, teamColor, onClick, value, buttonVariant}: ScoreBoxProps) {
  return (
    <>
      <Button
        onClick={onClick}
        color={teamColor}
        variant={buttonVariant}
        sx={{
          width: "100%",
          height: "82px",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "start",
          paddingLeft: 2,
        }}
      >
       <Typography variant="caption">{teamName}</Typography>
        <Typography variant="h4">{value || 0}</Typography>
      </Button>
    </>
  );
}
