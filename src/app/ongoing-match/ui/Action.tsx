import React from 'react';
import {useParams, usePathname, useRouter} from "next/navigation";
import useResultStore from "@/app/_store/bela/resultStore";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import {createOngoingMatchAPI} from "@/app/_fetchers/ongoingMatch/create";
import {createMatchAPI} from "@/app/_fetchers/match/create";
import useRoundStore from "@/app/_store/RoundStore";
import {finishRoundAPI} from "@/app/_fetchers/round/finish";
import {useMediaQuery} from "@mui/material";
import theme from "@/app/_styles/theme";
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DoneIcon from '@mui/icons-material/Done';


export default function Action() {
  const {
    ongoingMatch: {
      player_pair1_score,
      player_pair2_score,
      seating_order,
      current_shuffler_index
    },
    softResetOngoingMatch,
    hardResetOngoingMatch
  } = useOngoingMatchStore();
  const {roundData: {id, team1_wins, team2_wins}} = useRoundStore();
  const {setMatchId} = useResultStore();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const router = useRouter();
  const {matchId} = useParams();
  const pathname = usePathname();


  const getProps = () => {
    if ((player_pair1_score >= 1001 || player_pair2_score >= 1001) && player_pair1_score !== player_pair2_score) {
      return {
        label: "Završi meč",
        icon: <DoneIcon/>,
        onClick: async () => {
          await createMatchAPI(Number(matchId));

          if (team1_wins + team2_wins == 0) {
            const response = await createOngoingMatchAPI({
              round_id: Number(id),
              seating_order_ids: seating_order?.map((player) => player.id),
              current_shuffler_index: current_shuffler_index | Math.floor(Math.random() * 4),
              score_threshold: 1001,
            })

            softResetOngoingMatch();
            router.push(`/ongoing-match/${response.id}`);
          }

          if (team1_wins + team2_wins > 0) {
            router.push(`/round/${id}/result`);
            await finishRoundAPI(Number(id));
            hardResetOngoingMatch();
            localStorage.clear();
          }
        },
      }
    } else {
      return {
        label: "Upiši igru",
        icon: <AddCircleIcon/>,
        onClick: () => {
          setMatchId(Number(matchId));
          router.push(`${pathname}/ongoing-result/new/trump-caller`);
        },
      }
    }
  };

  const props = getProps();

  return <SingleActionButton fullWidth={isMobile} label={props.label} onClick={props.onClick} icon={props.icon}
  />
}
