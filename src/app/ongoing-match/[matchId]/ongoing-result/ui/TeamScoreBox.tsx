import {Button, Typography} from "@mui/material";

type ScoreBoxProps = {
    label?: string;
    teamColor: string;
    value: string;
    secondValue?: string;
    textVariant: "h4" | "h5";
    onClick?: () => void;
    buttonVariant: "contained" | "outlined";
}

export function TeamScoreBox({
                                 label,
                                 teamColor,
                                 onClick,
                                 value,
                                 secondValue,
                                 textVariant,
                                 buttonVariant
                             }: ScoreBoxProps) {
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
                {(label && <Typography variant="caption">{label}</Typography>)}
                {(value && <Typography variant={textVariant}>{value}</Typography>)}
            </Button>
            {(secondValue && <Typography variant="caption" paddingLeft={1}>{"Σ: " + secondValue}</Typography>)}
        </>
    );
}
