import {getResultByIdAPI} from "@/app/_fetchers/result/getById";
import useAuthStore from "@/app/_store/authStore";
import useMatchStore from "@/app/_store/matchStore";
import useResultStore from "@/app/_store/resultStore";
import useRoundStore from "../../_store/roundStore";
import {ButtonBase, Typography} from "@mui/material";
import {Grid} from "@mui/system";
import {usePathname, useRouter} from "next/navigation";

export default function ResultsDisplay() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    match: {results},
  } = useMatchStore();
  const {
    roundData: {team1, team2},
  } = useRoundStore();
  const setResultData = useResultStore((state) => state.setResultData);
  const {user} = useAuthStore();

  // Determine orientation: show the current user's team on the left
  const userId = user?.id;
  const team1PlayerIds = team1?.teamPlayers?.map((tp) => tp.player.id) ?? [];
  const team2PlayerIds = team2?.teamPlayers?.map((tp) => tp.player.id) ?? [];
  const isUserInTeam1 = userId != null && team1PlayerIds.includes(userId);
  const isUserInTeam2 = userId != null && team2PlayerIds.includes(userId);
  const showTeam1Left = isUserInTeam1 || (!isUserInTeam1 && !isUserInTeam2);

  // Avoid flicker/incorrect orientation while teams are not yet loaded
  if (!team1 || !team2 || !user) {
    return null;
  }

  const handleOnClick = async (resultId: number | null) => {
    try {
      if (!resultId) {
        throw new Error("Result id is null");
      }
      const ongoingResult = await getResultByIdAPI(Number(resultId));
      setResultData(ongoingResult);
    } catch (error) {
      console.error(error);
    }

    router.push(`${pathname}/result/${resultId}`);
  };

  return (
    <Grid container spacing={1.5} justifyContent="center">
      {results?.map((result, index) => (
        <ButtonBase
          key={index}
          onClick={() => handleOnClick(result.result_id)}
          sx={{width: "88%", borderRadius: "20px"}}
        >
          <Grid
            container
            item
            size={{xs: 12}}
            justifyContent="space-evenly"
            alignItems="center"
            sx={{backgroundColor: "secondary.main", borderRadius: "20px", paddingY: 0.5}}
          >
            <Grid item size={{xs: 4}}>
              <Typography variant="h4" textAlign="center" color={"default"} paddingRight={1}>
                {showTeam1Left ? result.team1_game_points : result.team2_game_points}
              </Typography>
            </Grid>

            <Grid item size={{xs: 2}}>
              <Typography variant="h4" textAlign="center">
                •
              </Typography>
            </Grid>

            <Grid item size={{xs: 4}}>
              <Typography variant="h4" textAlign="center" color={"default"} paddingLeft={1}>
                {showTeam1Left ? result.team2_game_points : result.team1_game_points}
              </Typography>
            </Grid>
          </Grid>
        </ButtonBase>
      ))}
    </Grid>
  );
}
