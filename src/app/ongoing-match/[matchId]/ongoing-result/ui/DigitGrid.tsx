import React from "react";
import {Button} from "@mui/material";
import {Grid} from "@mui/system";
import useResultStore from "@/app/_store/bela/resultStore";

const DigitGrid = () => {
    const setGamePoints = useResultStore((state) => state.setGamePoints);
    const resetScore = useResultStore((state) => state.resetScore);
    const setCompleteVictory = useResultStore((state) => state.setCompleteVictory);
    const complete_victory = useResultStore((state) => state.resultData.complete_victory);

    const handleClick = (digit: number) => {
        setGamePoints(digit);
    };

    return (
        <Grid container spacing={2} sx={{marginTop: 3}}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "štiglja", 0, "X"].map((digit, index) => (
                <Grid
                    item
                    size={{xs: 4}}
                    key={index}
                    sx={digit === "skip" ? {visibility: "hidden"} : {}}
                >
                    {typeof digit === "number" && (
                        <Button
                            color="secondary"
                            variant="contained"
                            sx={{width: "100%", height: "70px", fontSize: "24px"}}
                            onClick={() => handleClick(digit as number)}
                            disabled={complete_victory}
                        >
                            {digit}
                        </Button>
                    )}
                    {digit === "X" && (
                        <Button
                            color="error"
                            variant="outlined"
                            sx={{width: "100%", height: "70px", fontSize: "24px"}}
                            onClick={resetScore}
                        >
                            X
                        </Button>
                    )}
                    {digit === "štiglja" && (
                        <Button
                            color="secondary"
                            variant="contained"
                            sx={{width: "100%", height: "70px", fontSize: "20px", fontWeight: "500", color: "#3C4A67"}}
                            onClick={setCompleteVictory}
                        >
                            Štiglja
                        </Button>
                    )}
                </Grid>
            ))}
        </Grid>
    );
};

export default DigitGrid;
