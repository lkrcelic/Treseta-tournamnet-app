"use client";

import {restoreTournamentAPI, setRegistrationsOpenAPI} from "@/app/_fetchers/tournament";
import {useAdminTournament} from "@/app/_hooks/useTournaments";
import {AdminTournament} from "@/app/_interfaces/tournament";
import {replaceAddress} from "@/app/_lib/viewTransitions";
import {color} from "@/app/_styles/tokens";
import {buttonBase, Card, DesktopShell, EmptyState, ErrorNote, LoadingRows, PrimaryButton, Spinner, SwitchTrack} from "@/app/_ui/sp";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useState} from "react";
import {StatusChip, statusOf, ViewTabs} from "../TournamentParts";
import EntriesDesktop from "./EntriesDesktop";
import DayEntriesDesktop from "./DayEntriesDesktop";
import {ArrivalSummaryLine, clockOf, dayOn} from "./DayAdmin";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import {leagueDateString} from "@/app/_lib/dates";
import {nightLabel} from "@/app/_lib/nights";
import {tint} from "@/app/_styles/tokens";
import KolaDesktop, {defaultKolo} from "./KolaDesktop";
import {DetailsDesktop, StandingsDesktop} from "./StandingsDetailsDesktop";

// Upravljanje turnirom on the computer (Claude Design "Turniri admin" A3–A5, C1–C5): the tabs Prijave · Lista čekanja
// · Kola · Poredak · Podaci over the views, Prijave otvorene in the header until the tournament starts. ?view= and
// ?kolo= keep the tab and the Kolo in the address; while a Kolo is played the page refreshes every 15 s.

export type ManageView = "prijave" | "cekanje" | "kola" | "poredak" | "podaci";
export const MANAGE_VIEWS: ManageView[] = ["prijave", "cekanje", "kola", "poredak", "podaci"];

// before the start the sign-ups, after it the Kolos
export const defaultView = (t: Pick<AdminTournament, "phase">): ManageView => (t.phase === "upcoming" || t.phase === "cancelled" ? "prijave" : "kola");

export default function ManageTournamentDesktop({id}: {id: number}) {
  const params = useSearchParams();
  const asked = params.get("view") as ManageView | null;
  const [view, setView] = useState<ManageView | null>(asked && MANAGE_VIEWS.includes(asked) ? asked : null);
  const askedKolo = Number(params.get("kolo"));
  const [kolo, setKolo] = useState<number | null>(Number.isInteger(askedKolo) && askedKolo > 0 ? askedKolo : null);
  const [live, setLive] = useState(false);
  const {tournament: t, setTournament, error, notFound, reload} = useAdminTournament(id, live ? 15_000 : undefined);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  if (t && live !== (t.phase === "active")) setLive(t.phase === "active");

  const shown: ManageView = view ?? (t ? defaultView(t) : "prijave");
  const shownKolo = kolo ?? (t ? defaultKolo(t) : 1);
  const go = (v: ManageView, k: number | null = kolo) => {
    setView(v);
    setKolo(k);
    replaceAddress(`/turniri/${id}/upravljanje?view=${v}${v === "kola" && k ? `&kolo=${k}` : ""}`);
  };

  const toggleRegistrations = async () => {
    if (!t) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      setTournament(await setRegistrationsOpenAPI(t.id, !t.registrations_open));
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Prijave nisu promijenjene.");
    }
    setSwitching(false);
  };

  const restore = async () => {
    if (!t) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      setTournament(await restoreTournamentAPI(t.id));
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Turnir nije vraćen.");
    }
    setSwitching(false);
  };

  const right =
    t && dayOn(t) ? (
      <Box sx={{height: 52, display: "flex", alignItems: "center", gap: "10px", px: "18px", borderRadius: "26px", background: color.navy, color: color.white}}>
        <ArrivalSummaryLine t={t} />
      </Box>
    ) : t && t.phase === "upcoming" ? (
      <Box
        component="button"
        type="button"
        role="switch"
        aria-checked={t.registrations_open}
        onClick={toggleRegistrations}
        disabled={switching}
        sx={{...buttonBase, height: 52, display: "flex", alignItems: "center", gap: "12px", pl: "18px", pr: "10px", borderRadius: "26px", background: color.white, fontSize: 15, fontWeight: 700, color: t.registrations_open ? color.green : color.muted}}
      >
        {t.registrations_open ? "Prijave otvorene" : "Prijave zatvorene"}
        {switching ? <Spinner size={20} /> : <SwitchTrack on={t.registrations_open} onColor={color.green} />}
      </Box>
    ) : t ? (
      <StatusChip status={statusOf(t)} height={36} sx={{alignSelf: "center", fontSize: 14}} />
    ) : null;

  return (
    <DesktopShell active="manageTournaments" eyebrow="Admin · Turnir" title={t?.name ?? "Turnir"} back={{label: "Turniri", href: "/turniri/upravljanje"}} right={right}>
      {notFound ? (
        <Card sx={{borderRadius: "24px"}}>
          <EmptyState>Ovaj turnir ne postoji.</EmptyState>
        </Card>
      ) : error && !t ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !t ? (
        <Card sx={{flex: 1, overflow: "hidden", borderRadius: "24px"}}>
          <LoadingRows rows={8} height={60} />
        </Card>
      ) : (
        <>
          {t.phase === "cancelled" && (
            <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px", p: "16px 20px", borderRadius: "22px", background: color.lineFill, border: `1.5px dashed ${tint.navy[22]}`}}>
              <EventBusyRoundedIcon aria-hidden sx={{fontSize: 28, color: color.red}} />
              <Box sx={{flex: 1, display: "flex", flexDirection: "column", gap: "2px"}}>
                <Box component="span" sx={{fontSize: 17, fontWeight: 700}}>
                  Turnir je otkazan
                </Box>
                <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
                  {t.cancelled_at ? `Otkazao ${t.cancelled_by ?? "admin"}, ${nightLabel(leagueDateString(new Date(t.cancelled_at)))} u ${clockOf(t.cancelled_at)} · prijave zatvorene` : "Prijave zatvorene"}
                </Box>
              </Box>
              {/* Vrati turnir: back among the upcoming ones, with the sign-ups open */}
              <PrimaryButton icon={<RestoreRoundedIcon />} height={46} loading={switching} onClick={restore} sx={{flex: "none", width: "auto", px: "18px", fontSize: 15}}>
                Vrati turnir
              </PrimaryButton>
            </Box>
          )}
          <ViewTabs<ManageView>
            label="Upravljanje turnirom"
            value={shown}
            onChange={(v) => go(v)}
            items={[
              {key: "prijave" as const, label: "Prijave", icon: <GroupsRoundedIcon />, count: t.teams},
              {key: "cekanje" as const, label: "Lista čekanja", icon: <HourglassTopRoundedIcon />, count: t.waiting},
              {key: "kola" as const, label: "Kola", icon: <EventNoteRoundedIcon />, count: t.rounds},
              {key: "poredak" as const, label: "Poredak", icon: <EmojiEventsRoundedIcon />},
              {key: "podaci" as const, label: "Podaci", icon: <TuneRoundedIcon />},
            ].filter((x) => t.phase !== "cancelled" || x.key === "prijave" || x.key === "podaci")}
          />
          {switchError && <ErrorNote>{switchError}</ErrorNote>}
          {shown === "prijave" || shown === "cekanje" ? (
            (dayOn(t) || t.started_at) && t.phase !== "cancelled" ? (
              <DayEntriesDesktop t={t} onChanged={setTournament} />
            ) : (
              <EntriesDesktop key={shown} t={t} waiting={shown === "cekanje"} onChanged={setTournament} />
            )
          ) : shown === "kola" ? (
            <KolaDesktop t={t} kolo={shownKolo} onKolo={(k) => go("kola", k)} onChanged={setTournament} reload={reload} />
          ) : shown === "poredak" ? (
            <StandingsDesktop t={t} />
          ) : (
            <DetailsDesktop t={t} onChanged={setTournament} />
          )}
        </>
      )}
    </DesktopShell>
  );
}
