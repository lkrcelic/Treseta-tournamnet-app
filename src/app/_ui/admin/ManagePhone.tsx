"use client";

import useLeagueRounds from "@/app/_hooks/useLeagueRounds";
import {isIsoDate} from "@/app/_lib/nights";
import {draftNight} from "@/app/_lib/ui/adminTonight";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {DesktopOnlyNote, EmptyState, ErrorNote, PrimaryButton, Screen, TopBar} from "@/app/_ui/sp";
import useNavStack from "@/app/_hooks/useNavStack";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import {useParams, useSearchParams} from "next/navigation";
import CreateRoundPhone from "./CreateRoundPhone";
import DraftPhone from "./DraftPhone";

// Upravljanje ligom on the admin's phone: ?view=create is Novo kolo, ?view=draft(&date=) Skica kola
export default function ManagePhone() {
  const params = useParams<{leagueId: string}>();
  const leagueId = Number(params.leagueId);
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const date = searchParams.get("date");
  if (view === "create") return <CreateRoundPhone key={leagueId} leagueId={leagueId} />;
  if (view === "draft") return date && isIsoDate(date) ? <DraftPhone key={`${leagueId}|${date}`} leagueId={leagueId} date={date} /> : <LatestDraft leagueId={leagueId} />;
  return <DesktopOnlyNote />;
}

// Skica kola without a night: the latest night with rounds still to publish, or nothing to publish (Novo kolo)
function LatestDraft({leagueId}: {leagueId: number}) {
  const router = useTransitionRouter();
  const nav = useNavStack("Skica kola", "/");
  const {rounds, error, reload} = useLeagueRounds(leagueId);
  const night = draftNight(rounds);
  if (night) return <DraftPhone key={`${leagueId}|${night.date}`} leagueId={leagueId} date={night.date} />;
  return (
    <Screen gap={14}>
      <TopBar onBack={nav.back} title="Skica kola" />
      {error ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : rounds ? (
        <>
          <EmptyState>Nema kola koja čekaju objavu.</EmptyState>
          <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={() => router.push(`/league/${leagueId}/manage?view=create`)}>
            Novo kolo
          </PrimaryButton>
        </>
      ) : null}
    </Screen>
  );
}
