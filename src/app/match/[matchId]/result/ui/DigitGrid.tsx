import useResultStore from "@/app/_store/resultStore";
import {Button} from "@mui/material";
import {Grid} from "@mui/system";

const DigitGrid = () => {
  const {setCustomResult, customResult, resetScore, setGamePoints} = useResultStore();

  const handleClick = (digit: number) => {
    setGamePoints(digit);
  };

  return (
    <Grid container spacing={2} sx={{marginTop: 3}}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, "custom", 0, "X"].map((digit, index) => (
        <Grid item size={{xs: 4}} key={index} sx={digit === "skip" ? {visibility: "hidden"} : {}}>
          {typeof digit === "number" && (
            <Button
              color="secondary"
              variant="contained"
              sx={{width: "100%", height: "70px", fontSize: "24px"}}
              onClick={() => handleClick(digit as number)}
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
          {digit === "custom" && (
            <Button
              color={customResult ? "success" : "secondary"}
              variant="contained"
              sx={{
                width: "100%",
                height: "70px",
                fontSize: "20px",
                color: customResult ? "white" : "primary.main",
                borderWidth: 4,
              }}
              onClick={setCustomResult}
              aria-pressed={customResult}
            >
              Custom
            </Button>
          )}
        </Grid>
      ))}
    </Grid>
  );
};

export default DigitGrid;
