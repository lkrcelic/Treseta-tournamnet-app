"use client";

import React from "react";
import {Box} from "@mui/material";
import AnnouncementSection from "@/app/ongoing-match/[matchId]/ongoing-result/ui/AnnouncementsSection";
import PlayersAnnouncementSection from "@/app/ongoing-match/[matchId]/ongoing-result/ui/PlayersAnnouncementSection";
import useAnnouncementStore from "@/app/_store/bela/announcementStore";
import {useParams, useRouter} from "next/navigation";
import DoubleActionButton from "@/app/_ui/DoubleActionButton";
import {ActionProps} from "@/app/ongoing-match/[matchId]/ongoing-result/ui/pages/TrumpCallerPage";

export default function AnnouncementPage({actionType}: ActionProps) {
    return (
        <>
            <Box sx={{gridArea: "body", alignSelf: "end"}}>
                <AnnouncementSection/>
                <PlayersAnnouncementSection/>
            </Box>
            <Box sx={{gridArea: "actions", alignSelf: "start"}}>
                <ActionButtons actionType={actionType}/>
            </Box>
        </>
    );
}

function ActionButtons({actionType}: ActionProps) {
    const {noAnnouncements} = useAnnouncementStore();
    const router = useRouter();
    const params = useParams();

    let href;
    if (actionType === "CREATE") {
        href = `/ongoing-match/${params.matchId}/ongoing-result/new/score`
    }
    if (actionType === "UPDATE") {
        href = `/ongoing-match/${params.matchId}/ongoing-result/${params.resultId}/score`
    }

    return <DoubleActionButton
        secondButtonLabel={noAnnouncements ? "Nema Zvanja" : "Dalje"}
        secondButtonOnClick={() => router.push(href)}
        secondButtonDisabled={false}
    />
}
