import {createMatchAPI} from "@/app/_fetchers/match/create";
import {finishMatchAPI} from "@/app/_fetchers/match/finish";
import {finishRoundAPI} from "@/app/_fetchers/round/finish";
import useMatchStore from "@/app/_store/matchStore";
import useRoundStore from "../../_store/roundStore";
import theme from "@/app/_styles/theme";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DoneIcon from "@mui/icons-material/Done";
import {useMediaQuery} from "@mui/material";
import {useParams, usePathname, useRouter} from "next/navigation";

export default function Action() {
  const {
    match: {team1_score, team2_score},
    resetMatchStore,
  } = useMatchStore();
  const {
    roundData: {id, team1_wins, team2_wins},
  } = useRoundStore();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const router = useRouter();
  const {matchId} = useParams();
  const pathname = usePathname();

  const getProps = () => {
    if ((team1_score >= 41 || team2_score >= 41) && team1_score !== team2_score) {
      return {
        label: "Završi meč",
        icon: <DoneIcon />,
        onClick: async () => {
          await finishMatchAPI(Number(matchId));

          if (team1_wins + team2_wins == 0) {
            const response = await createMatchAPI(Number(id), 41);

            resetMatchStore();
            router.push(`/match/${response.id}`);
          }

          if (team1_wins + team2_wins > 0) {
            router.push(`/round/${id}/result`);
            await finishRoundAPI(Number(id));
            resetMatchStore();
            localStorage.clear();
          }
        },
      };
    } else {
      return {
        label: "Upiši igru",
        icon: <AddCircleIcon />,
        onClick: () => {
          router.push(`${pathname}/result/new`);
        },
      };
    }
  };

  const props = getProps();

  return <SingleActionButton fullWidth={isMobile} label={props.label} onClick={props.onClick} icon={props.icon} />;
}
