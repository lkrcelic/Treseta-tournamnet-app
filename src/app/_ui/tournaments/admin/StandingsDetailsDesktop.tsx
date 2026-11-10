"use client";

import {cancelTournamentAPI, deleteTournamentAPI, updateTournamentAPI} from "@/app/_fetchers/tournament";
import {AdminTournament} from "@/app/_interfaces/tournament";
import {standingsOrderLabel} from "@/app/_lib/tournaments";
import {standingsTeamHref, toStandingsRows} from "@/app/_lib/ui/standings";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font} from "@/app/_styles/tokens";
import {Card, EmptyState, ErrorNote, InfoNote, NARROW_DESKTOP, OutlineButton, PrimaryButton, StandingsGrid, SuccessNote} from "@/app/_ui/sp";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {Box} from "@mui/material";
import {ExcludedStandings} from "./DayAdmin";
import React, {useState} from "react";
import {draftOf, draftPayload, TournamentFields, useTournamentForm} from "../TournamentForm";
import {Confirm} from "./TournamentsDesktop";

const grid = {flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 330px"}, gap: "20px"} as const;

// Upravljanje turnirom · Poredak (C5): the league's standings table, counted after every game: points (a win 2, a
// draw 1), then the difference; a red place is a team playing now
export function StandingsDesktop({t}: {t: AdminTournament}) {
  const router = useTransitionRouter();
  const rows = toStandingsRows(t.results.standings);
  const after = t.completed_kolos;
  return (
    <Box sx={grid}>
      <Card component="section" aria-label="Poredak" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", display: "flex", alignItems: "baseline", gap: "12px", p: "16px 20px"}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800}}>
            Poredak
          </Box>
          <Box component="span" sx={{fontSize: 15, color: color.ink2}}>
            {t.phase === "upcoming" ? "Turnir još nije počeo" : t.phase === "finished" ? "Konačni poredak" : `Nakon ${after} od ${t.rounds} kola${t.live_kolo ? ` · Kolo ${t.live_kolo} uživo` : ""}`}
          </Box>
        </Box>
        {rows.length === 0 ? (
          <EmptyState>Poredak će biti ovdje kad počne prvo kolo.</EmptyState>
        ) : (
          <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
            <StandingsGrid rows={rows} caption={`Poredak turnira ${t.name}`} rowHref={standingsTeamHref} />
          </Box>
        )}
      </Card>
      <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        <Card component="section" sx={{flex: "none", borderRadius: "24px", p: "22px", display: "flex", flexDirection: "column", gap: "12px"}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            Kako se računa
          </Box>
          <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5}}>
            Računa se sam nakon svake igre. {standingsOrderLabel(t.matches_per_round)}
          </Box>
          <OutlineButton height={50} onClick={() => router.push(`/turniri/${t.id}/poredak`)} sx={{fontSize: 15, borderWidth: "1.5px"}}>
            <OpenInNewRoundedIcon sx={{fontSize: 20}} />
            Prikaz za igrače
          </OutlineButton>
        </Card>
        <ExcludedStandings t={t} />
        <InfoNote icon={<InfoRoundedIcon />}>Crveni broj = ekipa trenutno igra. Rezultati se ispravljaju u tabu Kola (dodir na stol), i nakon kraja turnira.</InfoNote>
      </Box>
    </Box>
  );
}

// Upravljanje turnirom · Podaci (A5): the whole form filled in, Spremi promjene; Kopiraj, Otkaži and Obriši on the
// right. A started tournament keeps its date and format (the form says so at the fields).
export function DetailsDesktop({t, onChanged}: {t: AdminTournament; onChanged: (t: AdminTournament) => void}) {
  const router = useTransitionRouter();
  const form = useTournamentForm(draftOf(t));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<"cancel" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const started = t.started_at != null;
  const cancelled = t.cancelled_at != null;

  const save = async () => {
    if (!form.valid || !form.dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateTournamentAPI(t.id, draftPayload(form.draft));
      onChanged(next);
      form.rebase(draftOf(next));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promjene nisu spremljene.");
    }
    setSaving(false);
  };
  const act = async (kind: "cancel" | "delete") => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "cancel") {
        onChanged(await cancelTournamentAPI(t.id));
        setAsking(null);
      } else {
        await deleteTournamentAPI(t.id);
        router.replace("/turniri/upravljanje");
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije uspjelo.");
    }
    setBusy(false);
  };

  const action = {height: 50, fontSize: 15, borderWidth: "1.5px", justifyContent: "flex-start", px: "16px"} as const;
  return (
    <Box sx={grid}>
      <Card component="section" aria-label="Podaci turnira" sx={{minHeight: 0, overflowY: "auto", borderRadius: "24px", p: "24px 28px"}}>
        <TournamentFields form={form} locks={{started, registered: t.teams, finished: t.phase === "finished"}} />
      </Card>
      <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        <Card component="section" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "10px"}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
            Turnir
          </Box>
          <OutlineButton onClick={() => router.push(`/turniri/novi?kopiraj=${t.id}`)} sx={action}>
            <ContentCopyRoundedIcon sx={{fontSize: 20}} />
            Kopiraj turnir
          </OutlineButton>
          {!started && !cancelled && asking == null && (
            <>
              <OutlineButton tone={color.red} onClick={() => setAsking("cancel")} sx={action}>
                <EventBusyRoundedIcon sx={{fontSize: 20}} />
                Otkaži turnir
              </OutlineButton>
              <OutlineButton tone={color.red} onClick={() => setAsking("delete")} sx={action}>
                <DeleteRoundedIcon sx={{fontSize: 20}} />
                Obriši turnir
              </OutlineButton>
            </>
          )}
          {asking && (
            <Confirm
              title={asking === "cancel" ? `Otkazati ${t.name}?` : `Obrisati ${t.name}?`}
              text={asking === "cancel" ? "Turnir ostaje u popisu kao Otkazan. Prijavljene ekipe neće dobiti obavijest." : "Turnir i sve prijave nestaju iz aplikacije. Može se obrisati samo prije početka turnira."}
              action={asking === "cancel" ? "Otkaži turnir" : "Obriši turnir"}
              busy={busy}
              onCancel={() => setAsking(null)}
              onConfirm={() => act(asking)}
            />
          )}
        </Card>
        <InfoNote icon={<InfoRoundedIcon />}>
          {t.phase === "finished"
            ? "Sve se može mijenjati osim datuma. Ispravak rezultata (u tabu Kola, dodirom na stol) odmah mijenja poredak i rejting. Dodaj kolo nastavlja turnir."
            : started
              ? "Turnir je počeo: sve se može mijenjati osim datuma. Partija po kolu, zvanja i vrijeme partije vrijede za kola koja se tek slažu. Broj kola može ići do objavljenih kola, pa se turnir može završiti ranije."
              : "Sve se može mijenjati do početka turnira. Smanjiš li najveći broj ekipa, zadnje prijavljene idu na listu čekanja."}
        </InfoNote>
        {error && <ErrorNote>{error}</ErrorNote>}
        {saved && !form.dirty && <SuccessNote>Promjene su spremljene.</SuccessNote>}
        <Box sx={{flex: 1}} />
        {!cancelled && (
          <PrimaryButton icon={<CheckRoundedIcon />} loading={saving} disabled={!form.dirty || !form.valid} onClick={save} sx={{flex: "none"}}>
            Spremi promjene
          </PrimaryButton>
        )}
      </Box>
    </Box>
  );
}
