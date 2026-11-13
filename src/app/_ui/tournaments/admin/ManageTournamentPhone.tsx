"use client";

import {
  addKoloAPI,
  addKoloTableAPI,
  admitTournamentTeamAPI,
  cancelTournamentAPI,
  deleteKoloAPI,
  deleteTournamentAPI,
  makeKoloAPI,
  publishKoloAPI,
  removeTournamentTeamAPI,
  restoreTournamentAPI,
  setRegistrationsOpenAPI,
  updateTournamentAPI,
} from "@/app/_fetchers/tournament";
import useNavStack from "@/app/_hooks/useNavStack";
import {useAdminTournament} from "@/app/_hooks/useTournaments";
import {AdminTournament, TournamentEntryView} from "@/app/_interfaces/tournament";
import {isByeTeam} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {KoloPair} from "@/app/_lib/matching/tournamentPairing";
import {nightLabel} from "@/app/_lib/nights";
import {koloRemovalWarns, koloSteps, removesResults, standingsOrderLabel} from "@/app/_lib/tournaments";
import {standingsTeamHref, toStandingsRows} from "@/app/_lib/ui/standings";
import {TableRow} from "@/app/_lib/ui/tables";
import {count, NOUN} from "@/app/_lib/ui/text";
import {replaceAddress, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {adminCardSx} from "@/app/_ui/admin/AdminParts";
import {DraftTableList} from "@/app/_ui/admin/DraftPhone";
import {PairSheet, useTableEdits} from "@/app/league/[leagueId]/daily-standings/ui/RoundEditing";
import {PhoneRoundTables} from "@/app/league/[leagueId]/daily-standings/ui/RoundTables";
import {
  BottomSheet,
  buttonBase,
  Card,
  ConfirmSheet,
  ellipsis,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  InfoNote,
  LoadingRows,
  OutlineButton,
  PrimaryButton,
  Screen,
  ScrollArea,
  SearchInput,
  SectionLabel,
  Segmented,
  Spinner,
  StandingsRows,
  SwitchTrack,
  tabPanelProps,
  tabular,
  TopBar,
} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import {ActiveSwitch, ArrivalButton, ArrivalChip, ArrivalSummaryLine, AtStartCard, dayOn, ExcludeControls, ExcludedStandings, ExclusionTag, TableStates, useTeamDay} from "./DayAdmin";
import {KoloTimerChip, KoloTimerOnNavy, ListDuration} from "./KoloTimer";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import React, {useEffect, useState} from "react";
import {draftOf, draftPayload, TournamentFields, useTournamentForm} from "../TournamentForm";
import {FillBar} from "../TournamentParts";
import {useCandidateSearch} from "./EntriesDesktop";
import {canAddKolo, koloRemoval, koloRemovalAction, koloRemovalText, koloRemovalTitle, koloRows, STEP_LOOK, tableTeams} from "./KolaDesktop";
import {defaultView, MANAGE_VIEWS, ManageView} from "./ManageTournamentDesktop";

// Upravljanje turnirom on the admin's phone (Claude Design "Turniri admin" M2–M9, M11–M13), as Upravljanje ligom: the
// navy card on top (Prijave otvorene with its switch until the start, then the Kolo being played), the tabs Prijave ·
// Čekanje · Kola · Poredak · Podaci, and the list. A Kolo opens as Skica kola (a draft: Uredi stolove, Složi ponovo,
// Objavi kolo) or as Dnevni poredak's round (its tables open the admin scorepad). Every rule and call is the
// computer's; a removal is asked in a sheet. ?view= and ?kolo= keep the tab and the Kolo in the address; while the
// tournament is played the page refreshes every 15 s.

const TABS: {key: ManageView; label: string}[] = [
  {key: "prijave", label: "Prijave"},
  {key: "cekanje", label: "Čekanje"},
  {key: "kola", label: "Kola"},
  {key: "poredak", label: "Poredak"},
  {key: "podaci", label: "Podaci"},
];

// a Kolo's tables but the bye's, and how many of them are done
function progress(rows: TableRow[]) {
  const tables = rows.filter((r) => !r.bye);
  return {tables: tables.length, done: tables.filter((r) => r.done).length};
}

export default function ManageTournamentPhone({id}: {id: number}) {
  const params = useSearchParams();
  const asked = params.get("view") as ManageView | null;
  const [view, setView] = useState<ManageView | null>(asked && MANAGE_VIEWS.includes(asked) ? asked : null);
  const askedKolo = Number(params.get("kolo"));
  const [kolo, setKolo] = useState<number | null>(asked === "kola" && Number.isInteger(askedKolo) && askedKolo > 0 ? askedKolo : null);
  const [live, setLive] = useState(false);
  const {tournament: t, setTournament, error, notFound, reload} = useAdminTournament(id, live ? 15_000 : undefined);
  const nav = useNavStack(t?.name ?? null, "/turniri/upravljanje");
  if (t && live !== (t.phase === "active")) setLive(t.phase === "active");

  const shown: ManageView = view ?? (t ? defaultView(t) : "prijave");
  const go = (v: ManageView, k: number | null = null) => {
    setView(v);
    setKolo(k);
    replaceAddress(`/turniri/${id}/upravljanje?view=${v}${v === "kola" && k ? `&kolo=${k}` : ""}`);
  };

  // a Kolo with its tables opens on its own screen; one not made yet stays on the list
  const koloView = t && kolo != null ? t.results.kolos.find((k) => k.number === kolo) : undefined;
  if (t && koloView) return <KoloPhone t={t} kolo={kolo!} onBack={() => go("kola")} onChanged={setTournament} reload={reload} />;

  return (
    <Screen fill gap={14}>
      <Box sx={{flex: "none", mx: "-6px"}}>
        <IconCircleButton label="Natrag" size={44} onClick={nav.back} sx={{"& svg": {fontSize: 26}}}>
          <ChevronLeftRoundedIcon />
        </IconCircleButton>
      </Box>
      <Box component="header" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "4px", px: "4px"}}>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
          {t ? `Turnir · ${nightLabel(t.date)}` : "Turnir"}
        </Box>
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em", textWrap: "balance"}}>
          {t?.name ?? "Upravljanje turnirom"}
        </Box>
      </Box>

      {notFound ? (
        <Card>
          <EmptyState>Ovaj turnir ne postoji.</EmptyState>
        </Card>
      ) : error && !t ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !t ? (
        <Box sx={{...adminCardSx, p: 0, overflow: "hidden"}}>
          <LoadingRows rows={7} height={64} />
        </Box>
      ) : (
        <ScrollArea bleed sx={{gap: "12px"}}>
          <StatusCard t={t} onChanged={setTournament} onOpen={(v, k) => go(v, k)} />
          <Segmented<ManageView>
            items={t.phase === "cancelled" ? TABS.filter((x) => x.key === "prijave" || x.key === "podaci") : TABS}
            value={shown}
            onChange={(v) => go(v)}
            label="Upravljanje turnirom"
            variant="track"
            idPrefix="tm"
          />
          <Box {...tabPanelProps("tm", shown)} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "12px"}}>
            {shown === "prijave" || shown === "cekanje" ? (
              <EntriesTab key={shown} t={t} waiting={shown === "cekanje"} onChanged={setTournament} />
            ) : shown === "kola" ? (
              <KolaTab t={t} onOpen={(k) => go("kola", k)} onChanged={setTournament} />
            ) : shown === "poredak" ? (
              <StandingsTab t={t} />
            ) : (
              <DetailsTab t={t} onChanged={setTournament} />
            )}
          </Box>
        </ScrollArea>
      )}
    </Screen>
  );
}

// ---------- the navy card (M2, M5) ----------

const cardSx = {
  ...buttonBase,
  flex: "none",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  p: "16px",
  borderRadius: "22px",
  background: color.navy,
  color: color.white,
  textAlign: "left",
  boxShadow: shadow.hero,
} as const;

function CardIcon({children}: {children: React.ReactNode}) {
  return (
    <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
      {children}
    </Box>
  );
}

function CardText({title, sub}: {title: string; sub: string}) {
  return (
    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
      <Box component="span" sx={{fontSize: 18, fontWeight: 700, ...ellipsis}}>
        {title}
      </Box>
      <Box component="span" sx={{fontSize: 14, color: color.cream, ...ellipsis}}>
        {sub}
      </Box>
    </Box>
  );
}

// Before the start: Prijave otvorene / zatvorene, the card being its switch, with the places taken. Once it started:
// the Kolo being played (or its draft) with its tables done, opening that Kolo; once it is over the winners.
function StatusCard({t, onChanged, onOpen}: {t: AdminTournament; onChanged: (t: AdminTournament) => void; onOpen: (v: ManageView, kolo: number | null) => void}) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dayOn(t)) {
    return (
      <Box component="button" type="button" onClick={() => onOpen("prijave", null)} sx={{...cardSx, flexDirection: "row", alignItems: "center", gap: "14px"}}>
        <CardIcon>
          <ScheduleRoundedIcon />
        </CardIcon>
        <Box component="span" sx={{flex: 1, minWidth: 0}}>
          <ArrivalSummaryLine t={t} />
        </Box>
        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26}} />
      </Box>
    );
  }

  if (t.phase === "upcoming") {
    const toggle = async () => {
      setSwitching(true);
      setError(null);
      try {
        onChanged(await setRegistrationsOpenAPI(t.id, !t.registrations_open));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Prijave nisu promijenjene.");
      }
      setSwitching(false);
    };
    const places = t.max_teams != null ? `${t.teams} od ${count(t.max_teams, NOUN.ekipa)}` : `${count(t.teams, NOUN.ekipa)} · bez ograničenja`;
    return (
      <>
        <Box component="button" type="button" role="switch" aria-checked={t.registrations_open} onClick={toggle} disabled={switching} sx={cardSx}>
          <Box component="span" sx={{display: "flex", alignItems: "center", gap: "14px"}}>
            <CardIcon>{t.registrations_open ? <HowToRegRoundedIcon /> : <LockRoundedIcon />}</CardIcon>
            <CardText title={t.registrations_open ? "Prijave otvorene" : "Prijave zatvorene"} sub={`${places}${t.waiting ? ` · ${t.waiting} na čekanju` : ""}`} />
            {switching ? <Spinner size={22} tone="white" /> : <SwitchTrack on={t.registrations_open} onColor={color.green} offColor={tint.white[25]} />}
          </Box>
          <FillBar registered={t.teams} max={t.max_teams} onNavy />
        </Box>
        {error && <ErrorNote>{error}</ErrorNote>}
      </>
    );
  }

  if (t.phase === "cancelled") {
    // Vrati turnir: back among the upcoming ones, with the sign-ups open
    const restore = async () => {
      setSwitching(true);
      setError(null);
      try {
        onChanged(await restoreTournamentAPI(t.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Turnir nije vraćen.");
      }
      setSwitching(false);
    };
    return (
      <>
        <Box sx={{...cardSx, flexDirection: "row", alignItems: "center", gap: "14px", background: color.white, color: color.ink, boxShadow: shadow.card}}>
          <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: tint.red[10], color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
            <EventBusyRoundedIcon />
          </Box>
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 18, fontWeight: 700}}>
              Turnir je otkazan
            </Box>
            <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
              {t.cancelled_at ? `Otkazao ${t.cancelled_by ?? "admin"}, ${nightLabel(leagueDateString(new Date(t.cancelled_at)))} · prijave zatvorene` : "Ostaje u popisu kao Otkazan."}
            </Box>
          </Box>
        </Box>
        <PrimaryButton icon={<RestoreRoundedIcon />} loading={switching} onClick={restore} sx={{flex: "none"}}>
          Vrati turnir
        </PrimaryButton>
        {error && <ErrorNote>{error}</ErrorNote>}
      </>
    );
  }

  if (t.phase === "finished") {
    return (
      <Box component="button" type="button" onClick={() => onOpen("poredak", null)} sx={{...cardSx, flexDirection: "row", alignItems: "center", gap: "14px"}}>
        <CardIcon>
          <EmojiEventsRoundedIcon />
        </CardIcon>
        <CardText title="Turnir je završen" sub={`Nema otvorenih kola · ${t.completed_kolos} od ${t.rounds} odigrano${t.winner ? ` · pobjednici ${t.winner.team_name}` : ""}`} />
        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26}} />
      </Box>
    );
  }

  const draft = t.results.kolos.find((k) => !k.published);
  const playing = t.live_kolo != null ? t.results.kolos.find((k) => k.number === t.live_kolo) : undefined;
  const p = playing ? progress(koloRows(playing)) : null;
  const kolo = playing?.number ?? draft?.number ?? null;
  return (
    <Box component="button" type="button" onClick={() => onOpen("kola", kolo)} sx={cardSx}>
      <Box component="span" sx={{display: "flex", alignItems: "center", gap: "14px"}}>
        <CardIcon>{playing ? <PlayCircleRoundedIcon /> : <EditRoundedIcon />}</CardIcon>
        <CardText
          title={playing ? `Kolo ${playing.number} u tijeku` : draft ? `Skica Kola ${draft.number}` : `Odigrano ${t.completed_kolos} od ${t.rounds} kola`}
          sub={p ? `${p.done} od ${count(p.tables, NOUN.stol)} gotovo` : draft ? "Provjeri stolove pa objavi kolo." : "Kola"}
        />
        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26}} />
      </Box>
      {/* the tables done and, beside them, how long the Kolo has been going */}
      {p && playing && (
        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "12px"}}>
          <FillBar registered={p.done} max={p.tables} onNavy sx={{flex: 1, minWidth: 0}} />
          <KoloTimerOnNavy kolo={playing} />
        </Box>
      )}
    </Box>
  );
}

// ---------- Prijave · Čekanje (M2–M4, M13) ----------

const handles = (e: TournamentEntryView) => e.players.map((p) => (p.username ? `@${p.username}` : p.name)).join(" · ");

function EntriesTab({t, waiting, onChanged}: {t: AdminTournament; waiting: boolean; onChanged: (t: AdminTournament) => void}) {
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<TournamentEntryView | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const day = useTeamDay(t, onChanged);
  // the tournament's day before Kolo 1 (Tu smo, Aktivna), or the tournament under way (Isključi, Vrati)
  const onDay = dayOn(t);
  const started = t.started_at != null && t.phase !== "cancelled";
  // Dodaj ekipu: before the start, and all through a tournament with Otvorene prijave, where the team comes straight
  // in (or onto the waiting list) and plays from the next Kolo (DECISIONS #88)
  const editable = (t.phase === "upcoming" && !(t.day?.phase === "closed")) || (t.phase === "active" && t.signups_open_now);
  const list = waiting ? t.waiting_list : t.entries;
  const next = t.waiting_list[0];

  const act = async (teamId: number, call: () => Promise<AdminTournament>) => {
    setBusy(teamId);
    setError(null);
    try {
      onChanged(await call());
      setAsking(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije uspjelo.");
    }
    setBusy(null);
  };

  return (
    <>
      {editable ? (
        <Box
          component="button"
          type="button"
          onClick={() => setAdding(true)}
          aria-haspopup="dialog"
          sx={{
            ...buttonBase,
            flex: "none",
            height: 50,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            px: "14px",
            borderRadius: "14px",
            border: `1.5px dashed ${tint.navy[35]}`,
            background: color.white,
            fontSize: 15,
            color: color.muted,
            textAlign: "left",
            "& svg": {fontSize: 22, color: color.navy},
          }}
        >
          <GroupAddRoundedIcon aria-hidden />
          Dodaj ekipu · ime ekipe
        </Box>
      ) : t.phase === "cancelled" ? null : started ? (
        <InfoNote icon={<InfoRoundedIcon />}>Turnir je krenuo: isključi umjesto briši. Isključena ekipa ne igra ostala kola, a odigrana ostaju u poretku.</InfoNote>
      ) : (
        <InfoNote icon={<InfoRoundedIcon />}>Početak je prošao: prijave su zatvorene. Ekipe koje stignu kasnije označi pa ih uključi prekidačem.</InfoNote>
      )}
      {t.phase === "active" && t.signups_open_now && (
        <InfoNote icon={<InfoRoundedIcon />}>Prijave su otvorene cijeli turnir: dodana ekipa odmah je u turniru (ili na listi čekanja) i igra od idućeg kola.</InfoNote>
      )}
      {(error || day.error) && !asking && <ErrorNote>{error ?? day.error}</ErrorNote>}
      <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", px: "6px"}}>
        <SectionLabel sx={{px: 0}}>
          {t.phase === "cancelled"
            ? `Bile su prijavljene · ${list.length}`
            : waiting
              ? "Prva ulazi kad se netko odjavi"
              : started && t.arrival_summary
                ? `${t.arrival_summary.active} aktivnih · ${t.arrival_summary.excluded} ${t.arrival_summary.excluded === 1 ? "isključena" : "isključene"}`
                : onDay
                  ? "Nepotvrđene možeš ručno označiti"
                  : "Prijavljene ekipe"}
        </SectionLabel>
        <Box component="span" sx={{flex: "none", fontSize: 13, fontWeight: 600, color: color.ink2, ...tabular}}>
          {onDay && !waiting ? "Aktivna" : waiting ? count(list.length, NOUN.ekipa) : started ? "" : t.max_teams != null ? `${t.teams} / ${t.max_teams}` : t.teams}
        </Box>
      </Box>
      {list.length === 0 ? (
        <Card>
          <EmptyState>{waiting ? "Nitko ne čeka." : "Još nema prijavljenih ekipa."}</EmptyState>
        </Card>
      ) : (
        <Box component="ul" aria-label={waiting ? "Lista čekanja" : "Prijavljene ekipe"} sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
          {list.map((e, i) => (
            <Box component="li" key={e.team_id} sx={{minHeight: 64, display: "flex", alignItems: "center", gap: "10px", pl: "16px", pr: "6px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
              {waiting && (
                <Box component="span" sx={{flex: "none", width: 22, fontFamily: font.display, fontSize: 18, fontWeight: 800, color: color.navy, ...tabular}}>
                  {e.position}
                </Box>
              )}
              <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", py: "8px", opacity: e.excluded || (started && !e.active) ? 0.6 : 1}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                  {e.team_name}
                </Box>
                {e.excluded ? (
                  <ExclusionTag x={e.excluded} />
                ) : (onDay || (started && waiting)) ? (
                  <Box sx={{display: "flex"}}>
                    <ArrivalChip e={e} />
                  </Box>
                ) : started && !e.active ? (
                  <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.muted}}>
                    Neaktivna
                  </Box>
                ) : (
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {handles(e)}
                  </Box>
                )}
              </Box>
              {(onDay || (started && (waiting || !e.active))) && !e.excluded && !e.arrival && <ArrivalButton e={e} day={day} />}
              {onDay && !waiting && <ActiveSwitch e={e} day={day} />}
              {started && !waiting && <ExcludeControls e={e} day={day} t={t} />}
              {started && !waiting && !e.excluded && !e.active && <ActiveSwitch e={e} day={day} />}
              {waiting && editable && (
                <Box
                  component="button"
                  type="button"
                  onClick={() => act(e.team_id, () => admitTournamentTeamAPI(t.id, e.team_id))}
                  disabled={busy != null}
                  aria-label={`Ubaci ${e.team_name} u turnir`}
                  sx={{...buttonBase, flex: "none", height: 38, display: "flex", alignItems: "center", gap: "6px", px: "14px", borderRadius: "12px", background: color.navy, color: color.white, fontSize: 14, fontWeight: 600}}
                >
                  {busy === e.team_id && !asking ? <Spinner size={16} tone="white" /> : null}
                  Ubaci
                </Box>
              )}
              {editable && !onDay && (
                <Box
                  component="button"
                  type="button"
                  aria-label={waiting ? `Makni ${e.team_name} s liste čekanja` : `Makni ${e.team_name} s turnira`}
                  onClick={() => {
                    setError(null);
                    setAsking(e);
                  }}
                  sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:active": {color: color.red}}}
                >
                  <DeleteRoundedIcon />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
      {onDay && !waiting && <AtStartCard t={t} />}
      <ConfirmSheet
        open={asking != null}
        onClose={() => setAsking(null)}
        onConfirm={() => asking && act(asking.team_id, () => removeTournamentTeamAPI(t.id, asking.team_id))}
        title={asking ? (waiting ? `Maknuti ${asking.team_name} s liste čekanja?` : `Maknuti ${asking.team_name} s turnira?`) : ""}
        text={`Ekipa neće dobiti obavijest.${!waiting && next ? ` Prva ekipa s liste čekanja (${next.team_name}) ulazi u turnir.` : ""}`}
        action="Makni ekipu"
        icon={<DeleteRoundedIcon />}
        busy={busy != null && asking != null}
        error={asking ? error : null}
      />
      {adding && <AddTeamSheet t={t} onClose={() => setAdding(false)} onAdded={onChanged} />}
    </>
  );
}

// Dodaj ekipu (M13): the teams found as the admin types (from 2 letters), a navy Dodaj on each that can come in (else
// why not), Nova ekipa for a team that isn't in the app yet; the search last, right above the keyboard
function AddTeamSheet({t, onClose, onAdded}: {t: AdminTournament; onClose: () => void; onAdded: (t: AdminTournament) => void}) {
  const router = useTransitionRouter();
  const {query, setQuery, hits, loading, adding, error, add} = useCandidateSearch(t, onAdded);
  const full = t.max_teams != null && t.teams >= t.max_teams;
  const note = (text: string) => (
    <Box component="li" sx={{p: "18px 16px", fontSize: 15, lineHeight: 1.45, color: color.muted}}>
      {text}
    </Box>
  );
  return (
    <BottomSheet open onClose={onClose} title="Dodaj ekipu" closable tall busy={adding != null}>
      <Box component="ul" aria-label="Ekipe" aria-live="polite" sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", listStyle: "none", m: 0, p: 0, borderRadius: "16px", background: color.paper2}}>
        {hits == null
          ? note("Upiši bar dva slova imena ekipe ili igrača.")
          : loading && hits.length === 0
            ? note("Tražim…")
            : hits.length === 0
              ? note("Nema takvih ekipa izvan turnira.")
              : hits.map((h) => (
                  <Box component="li" key={h.team_id} sx={{minHeight: 60, display: "flex", alignItems: "center", gap: "10px", pl: "16px", pr: "8px", py: "6px", borderBottom: `1px solid ${color.line}`}}>
                    <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                      <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                        {h.team_name}
                      </Box>
                      <Box component="span" sx={{fontSize: 13, color: h.reason ? color.red : color.muted, ...ellipsis}}>
                        {h.reason ?? (h.players.map((p) => (p.username ? `@${p.username}` : p.name)).join(" · ") || "—")}
                      </Box>
                    </Box>
                    {h.banned && (
                      <Box component="span" sx={{flex: "none", display: "inline-flex", alignItems: "center", gap: "4px", height: 32, px: "10px", borderRadius: "10px", background: tint.red[10], color: color.red, fontSize: 13, fontWeight: 700, "& svg": {fontSize: 17}}}>
                        <BlockRoundedIcon aria-hidden />
                        Zabrana
                      </Box>
                    )}
                    {!h.reason && (
                      <Box
                        component="button"
                        type="button"
                        onClick={() => add(h)}
                        disabled={adding != null}
                        aria-label={`Dodaj ${h.team_name} na turnir`}
                        sx={{...buttonBase, flex: "none", height: 40, display: "flex", alignItems: "center", gap: "6px", px: "14px", borderRadius: "12px", background: color.navy, color: color.white, fontSize: 14, fontWeight: 600}}
                      >
                        {adding === h.team_id && <Spinner size={16} tone="white" />}
                        Dodaj
                      </Box>
                    )}
                  </Box>
                ))}
      </Box>
      <Box sx={{flex: "none", fontSize: 13, lineHeight: 1.45, color: color.ink2}}>
        {full ? "Turnir je pun: dodana ekipa ide na listu čekanja. " : ""}Samo ekipe u kojima oba igrača imaju račun. Nova ekipa ide istim tokom kao u ligi.
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{flex: "none", display: "flex", gap: "10px"}}>
        <SearchInput variant="paper" height={52} placeholder="Traži ekipu ili igrača" aria-label="Traži ekipu ili igrača" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} enterKeyHint="search" autoFocus sx={{flex: 1}} />
        <IconCircleButton label="Nova ekipa" size={52} onClick={() => router.push("/teams?new=1")} sx={{borderRadius: "16px", boxShadow: "none", background: color.cream, "& svg": {fontSize: 24}}}>
          <GroupAddRoundedIcon />
        </IconCircleButton>
      </Box>
    </BottomSheet>
  );
}

// ---------- Kola (M5) ----------

function KolaTab({t, onOpen, onChanged}: {t: AdminTournament; onOpen: (kolo: number) => void; onChanged: (t: AdminTournament) => void}) {
  const [busy, setBusy] = useState<"make" | "add" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // which Kolo's bin was tapped (the sheet asks about it)
  const [asking, setAsking] = useState<number | null>(null);
  const steps = koloSteps(t.rounds, t.results.kolos.map((k) => ({number: k.number, published: k.published, tables: k.tables.length, done: k.tables.filter((x) => !x.open).length, live: 0})));
  const next = t.next_kolo;
  // the Kolo to make by hand: Kolo 1 (once sign-ups are closed; until then why not), or a later one the app didn't
  // make by itself when its Kolo before was played
  const toMake = next != null && !t.results.kolos.some((k) => k.number === next.number) && (next.number === 1 || next.ready) ? next : null;
  // Obriši kolo: any Kolo, its results too after the warning; Dodaj kolo: one more, up to 20
  const removal = asking == null ? null : koloRemoval(t, asking);
  const canAdd = canAddKolo(t);

  const run = async (what: "make" | "add" | "delete", call: () => Promise<AdminTournament>, then?: () => void) => {
    setBusy(what);
    setError(null);
    try {
      onChanged(await call());
      setAsking(null);
      then?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije uspjelo.");
    }
    setBusy(null);
  };
  const make = () => {
    let made = 0;
    run(
      "make",
      async () => {
        const r = await makeKoloAPI(t.id);
        made = r.made.number;
        return r.tournament;
      },
      () => onOpen(made)
    );
  };

  return (
    <>
      <Box component="p" sx={{m: 0, px: "4px", fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
        Prvo kolo se slaže nasumično, ostala po poretku. Novo kolo se slaže kad svi stolovi završe.
      </Box>
      {toMake && t.phase !== "finished" && t.phase !== "cancelled" && (
        <Box sx={{...adminCardSx, gap: "10px"}}>
          <Box component="span" sx={{fontSize: 15, lineHeight: 1.45}}>
            {toMake.reason ?? (toMake.number === 1 ? "Prijave su zatvorene: Kolo 1 se slaže nasumično." : `Kolo ${toMake.number - 1} je odigrano.`)}
          </Box>
          <PrimaryButton icon={<AutoAwesomeRoundedIcon />} loading={busy === "make"} disabled={!toMake.ready || busy != null} onClick={make} height={56}>
            Složi Kolo {toMake.number}
          </PrimaryButton>
        </Box>
      )}
      {error && asking == null && <ErrorNote>{error}</ErrorNote>}
      <Box component="ul" aria-label="Kola turnira" sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
        {steps.map((s, i) => {
          const view = t.results.kolos.find((k) => k.number === s.number);
          const rows = view ? koloRows(view) : [];
          const p = progress(rows);
          const look = STEP_LOOK[s.step];
          // a published Kolo nobody plays at yet is Objavljeno; once a table plays, Uživo
          const label = s.step === "live" && !rows.some((r) => r.started && !r.bye) ? "Objavljeno" : look.label;
          const line = (
            <>
              <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: "8px"}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: view ? color.ink : color.faint}}>
                  Kolo {s.number}
                </Box>
                {view && (
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...tabular, ...ellipsis}}>
                    {s.step === "live" ? `${p.done}/${p.tables} gotovo` : count(p.tables, NOUN.stol)}
                    <ListDuration kolo={view} />
                  </Box>
                )}
              </Box>
              <Box component="span" sx={{flex: "none", height: 26, display: "flex", alignItems: "center", gap: "4px", px: "9px", borderRadius: "8px", background: label === "Objavljeno" ? tint.green[12] : look.bg, color: label === "Objavljeno" ? color.green : look.ink, fontSize: 13, fontWeight: 700}}>
                {s.step === "live" && label === "Uživo" && <Box component="span" aria-hidden sx={{width: 6, height: 6, borderRadius: "50%", background: color.red}} />}
                {label}
              </Box>
            </>
          );
          // every Kolo that can go has its own bin (DECISIONS #87)
          const bin = koloRemoval(t, s.number) != null && (
            <Box
              component="button"
              type="button"
              aria-label={`Obriši Kolo ${s.number}`}
              onClick={() => {
                setError(null);
                setAsking(s.number);
              }}
              disabled={busy != null}
              sx={{...buttonBase, width: 44, height: 44, flex: "none", mr: "6px", borderRadius: "12px", color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:active": {color: color.red}}}
            >
              <DeleteRoundedIcon />
            </Box>
          );
          return (
            <Box component="li" key={s.number} sx={{display: "flex", alignItems: "center", borderTop: i ? `1px solid ${color.line}` : "none"}}>
              {view ? (
                <Box
                  component="button"
                  type="button"
                  onClick={() => onOpen(s.number)}
                  aria-label={`Kolo ${s.number}, ${label.toLowerCase()}`}
                  sx={{...buttonBase, flex: 1, minWidth: 0, minHeight: 58, display: "flex", alignItems: "center", gap: "10px", pl: "16px", pr: bin ? "4px" : "10px", textAlign: "left", "&:active": {background: tint.navy[7]}}}
                >
                  {line}
                  <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy}} />
                </Box>
              ) : (
                // a Kolo still to come: in the list, but nothing to open yet
                <Box aria-disabled="true" sx={{flex: 1, minWidth: 0, minHeight: 58, display: "flex", alignItems: "center", gap: "10px", pl: "16px", pr: bin ? "4px" : "44px", opacity: 0.6}}>
                  {line}
                </Box>
              )}
              {bin}
            </Box>
          );
        })}
      </Box>
      {canAdd && (
        <Box
          component="button"
          type="button"
          onClick={() => run("add", () => addKoloAPI(t.id, t.rounds + 1))}
          disabled={busy != null}
          sx={{...buttonBase, flex: "none", height: 56, borderRadius: "18px", border: `1.5px dashed ${tint.navy[35]}`, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: 16, fontWeight: 600, "& svg": {fontSize: 22}}}
        >
          {busy === "add" ? <Spinner size={20} /> : <AddRoundedIcon aria-hidden />}
          Dodaj kolo
        </Box>
      )}
      {/* every Kolo but one nobody has made yet is asked with the warning sign; "s rezultatima" only when results really go */}
      <ConfirmSheet
        open={removal != null}
        onClose={() => setAsking(null)}
        onConfirm={() => removal && run("delete", () => deleteKoloAPI(t.id, removal.number, removesResults(removal)))}
        title={removal ? koloRemovalTitle(removal) : ""}
        text={removal ? koloRemovalText(removal) : ""}
        action={removal ? koloRemovalAction(removal) : ""}
        icon={removal && koloRemovalWarns(removal) ? <WarningRoundedIcon /> : <DeleteRoundedIcon />}
        busy={busy === "delete"}
        error={asking != null ? error : null}
      />
    </>
  );
}

// ---------- a Kolo (M6, M7) ----------

// A draft as Skica kola: its tables as a list, the pencil editing them (Uredi par, Ukloni stol, Dodaj stol in the
// sheet), Složi ponovo and Objavi kolo. A published Kolo as Dnevni poredak's round: its tables with the wins and
// the points of the match being played, each opening the admin scorepad; the pencil edits them there too.
function KoloPhone({t, kolo, onBack, onChanged, reload}: {t: AdminTournament; kolo: number; onBack: () => void; onChanged: (t: AdminTournament) => void; reload: () => void}) {
  const view = t.results.kolos.find((k) => k.number === kolo)!;
  const draft = !view.published;
  const rows = koloRows(view);
  const p = progress(rows);
  const [editing, setEditing] = useState(false);
  const edits = useTableEdits({leagueId: 0, date: t.date, roundNumber: kolo, onChanged: reload, addTable: (a, b) => addKoloTableAPI(t.id, kolo, a, b)});
  const [busy, setBusy] = useState<"publish" | "redo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repeats, setRepeats] = useState<KoloPair[]>([]);
  const removeRow = rows.find((r) => r.id === edits.confirmId) ?? null;
  const names = new Map(t.entries.map((e) => [e.team_id, e.team_name]));
  const editable = t.phase !== "finished";

  // publishing ends the editing of the draft
  useEffect(() => {
    setEditing(false);
    edits.reset();
    edits.setPair(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.published]);

  const run = async (what: "publish" | "redo", call: () => Promise<AdminTournament>) => {
    setBusy(what);
    setError(null);
    try {
      onChanged(await call());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije uspjelo.");
    }
    setBusy(null);
  };
  const redo = () =>
    run("redo", async () => {
      const r = await makeKoloAPI(t.id, true);
      setRepeats(r.made.repeats);
      return r.tournament;
    });
  const publish = () =>
    run("publish", async () => {
      const next = await publishKoloAPI(t.id, kolo);
      setRepeats([]);
      return next;
    });
  const toggleEdit = () => {
    setEditing((e) => !e);
    edits.reset();
  };

  return (
    <Screen fill gap={14}>
      <TopBar
        onBack={onBack}
        eyebrow={draft ? `Turnir · Kolo ${kolo}` : `Turnir · ${t.name}`}
        title={draft ? "Skica kola" : `Kolo ${kolo}`}
        right={
          <Box sx={{display: "flex", gap: "8px"}}>
            {!draft && !editing && (
              <IconCircleButton label="Osvježi" size={44} onClick={reload} sx={{"& svg": {fontSize: 22}}}>
                <RefreshRoundedIcon />
              </IconCircleButton>
            )}
            {editable && (
              <IconCircleButton
                label={editing ? "Završi uređivanje stolova" : "Uredi stolove"}
                aria-pressed={editing}
                size={44}
                onClick={toggleEdit}
                sx={{...(editing && {background: color.navy, color: color.white}), "& svg": {fontSize: 22}}}
              >
                {editing ? <CheckRoundedIcon /> : <EditRoundedIcon />}
              </IconCircleButton>
            )}
          </Box>
        }
      />

      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "10px", minHeight: 32}}>
        {draft ? (
          <Box component="span" sx={{flex: "none", height: 32, display: "flex", alignItems: "center", gap: "6px", px: "10px", borderRadius: "10px", background: color.white, color: color.navy, fontSize: 14, fontWeight: 700, boxShadow: shadow.card, "& svg": {fontSize: 18}}}>
            <AutoAwesomeRoundedIcon aria-hidden />
            {kolo === 1 ? "Nasumično" : `Po poretku nakon ${kolo - 1} kola`}
          </Box>
        ) : (
          <Box component="span" sx={{flex: "none", height: 32, display: "flex", alignItems: "center", gap: "5px", px: "10px", borderRadius: "10px", background: p.done === p.tables ? tint.green[12] : tint.red[10], color: p.done === p.tables ? color.green : color.red, fontSize: 14, fontWeight: 700, "& svg": {fontSize: 18}}}>
            {p.done === p.tables ? <CheckCircleRoundedIcon aria-hidden /> : null}
            {p.done === p.tables ? "Odigrano" : `${p.done}/${p.tables} gotovo`}
          </Box>
        )}
        {!draft && <KoloTimerChip kolo={view} />}
        <Box component="span" sx={{flex: 1, minWidth: 0, textAlign: "right", fontSize: 14, color: color.ink2, whiteSpace: "nowrap", ...ellipsis}}>
          {count(p.tables, NOUN.stol)}
          {rows.some((r) => r.bye) ? " + slobodna" : ""}
        </Box>
      </Box>

      <ScrollArea bleed sx={{gap: "10px"}}>
        {(edits.actionError || error) && !removeRow && <ErrorNote>{edits.actionError ?? error}</ErrorNote>}
        {editing ? (
          <PhoneRoundTables
            title={`Kolo ${kolo} · ${count(rows.length, NOUN.stol)}`}
            rows={rows}
            draft={draft}
            fresh={edits.freshTable}
            edit={{
              onPair: (r) => edits.setPair({kind: "edit", row: r}),
              onRemove: (r) => {
                edits.setActionError(null);
                edits.setConfirmId(r.id);
              },
              onAdd: () => edits.setPair({kind: "new", tableNumber: rows.reduce((m, r) => Math.max(m, r.table), 0) + 1}),
            }}
          />
        ) : draft ? (
          <DraftTableList rows={rows} label={`Skica Kola ${kolo}, stolovi`} />
        ) : (
          <>
            <TableStates t={t} kolo={view} onChanged={onChanged} />
            <PhoneRoundTables title={`Kolo ${kolo}`} rows={rows} tableTarget={(r) => ({href: `/turniri/${t.id}/stol/${r.id}`})} />
          </>
        )}
      </ScrollArea>

      {draft && !editing && (
        <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
          {t.stale_draft && (
            <Box role="alert" sx={{display: "flex", gap: "8px", p: "10px 12px", borderRadius: "14px", background: tint.red[10], color: color.red, fontSize: 14, lineHeight: 1.4, fontWeight: 600, "& svg": {fontSize: 20, flex: "none"}}}>
              <WarningRoundedIcon aria-hidden />
              Popis ekipa se promijenio nakon što je kolo složeno. Složi ga ponovo pa objavi.
            </Box>
          )}
          {repeats.length > 0 && (
            <Box role="status" sx={{display: "flex", gap: "8px", p: "10px 12px", borderRadius: "14px", background: tint.gold[16], fontSize: 14, lineHeight: 1.4, "& svg": {fontSize: 20, flex: "none", color: color.medal[0]}}}>
              <WarningRoundedIcon aria-hidden />
              {`Ponovo igraju jer drugačije nije moguće: ${repeats.map(([a, b]) => (isByeTeam(b) ? `${names.get(a) ?? a} (druga slobodna runda)` : `${names.get(a) ?? a} – ${names.get(b) ?? b}`)).join(", ")}.`}
            </Box>
          )}
          <Box component="span" sx={{px: "4px", fontSize: 13.5, lineHeight: 1.35, color: color.ink2}}>
            Igrači ne vide stolove dok ne objaviš kolo.
          </Box>
          <Box sx={{display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "10px"}}>
            <OutlineButton height={60} onClick={redo} disabled={busy != null} aria-label="Složi ponovo" sx={{width: 60, borderWidth: "1.5px", borderColor: tint.navy[25], background: color.white, "& svg": {fontSize: 24}}}>
              {busy === "redo" ? <Spinner size={22} /> : <RefreshRoundedIcon />}
            </OutlineButton>
            <PrimaryButton icon={<PublishRoundedIcon />} onClick={publish} loading={busy === "publish"} disabled={busy != null || t.stale_draft}>
              Objavi kolo
            </PrimaryButton>
          </Box>
        </Box>
      )}

      {editing && edits.pair && <PairSheet target={edits.pair} rows={rows} teams={tableTeams(t)} onClose={() => edits.setPair(null)} onSave={edits.savePair} byeWins={t.matches_per_round} />}
      <ConfirmSheet
        open={editing && removeRow != null}
        onClose={() => edits.setConfirmId(null)}
        onConfirm={() => removeRow && edits.remove(removeRow.id)}
        title="Ukloniti stol?"
        text={removeRow ? (draft ? `Stol ${removeRow.table} miče se iz ove skice.` : `Stol ${removeRow.table} miče se iz ovog kola, a upisane igre za taj stol se brišu.`) : ""}
        action="Ukloni stol"
        icon={<DeleteRoundedIcon />}
        busy={edits.removing}
        error={removeRow ? edits.actionError : null}
      />
    </Screen>
  );
}

// ---------- Poredak (M8) ----------

function StandingsTab({t}: {t: AdminTournament}) {
  const router = useTransitionRouter();
  const rows = toStandingsRows(t.results.standings);
  return (
    <>
      <Box component="span" sx={{px: "4px", fontSize: 14, color: color.ink2}}>
        {t.phase === "upcoming" ? "Turnir još nije počeo" : t.phase === "finished" ? "Konačni poredak" : `Nakon ${t.completed_kolos} od ${t.rounds} kola${t.live_kolo ? ` · Kolo ${t.live_kolo} uživo` : ""}`}
      </Box>
      <Card sx={{p: 0, overflow: "hidden"}}>{rows.length === 0 ? <EmptyState>Poredak će biti ovdje kad počne prvo kolo.</EmptyState> : <StandingsRows rows={rows} head rowHref={standingsTeamHref} />}</Card>
      <Box component="p" sx={{m: 0, px: "4px", fontSize: 13.5, lineHeight: 1.45, color: color.ink2}}>
        {standingsOrderLabel(t.matches_per_round)} Crveni broj = ekipa trenutno igra.
      </Box>
      <ExcludedStandings t={t} />
      <OutlineButton height={52} onClick={() => router.push(`/turniri/${t.id}/poredak`)} sx={{flex: "none", fontSize: 16, borderWidth: "1.5px", borderColor: tint.navy[25], background: color.white}}>
        <OpenInNewRoundedIcon sx={{fontSize: 20}} />
        Prikaz za igrače
      </OutlineButton>
    </>
  );
}

// ---------- Podaci (M9, M9b, M11, M12) ----------

function DetailsTab({t, onChanged}: {t: AdminTournament; onChanged: (t: AdminTournament) => void}) {
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
  const firstError = Object.values(form.errors)[0];
  const done = !form.dirty && saved;
  const action = {height: 52, fontSize: 16, borderWidth: "1.5px", justifyContent: "flex-start", px: "16px", background: color.white} as const;

  return (
    <Box component="form" noValidate onSubmit={(e: React.FormEvent) => (e.preventDefault(), save())} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "12px"}}>
      <Box sx={adminCardSx}>
        <TournamentFields form={form} locks={{started, registered: t.teams, finished: t.phase === "finished"}} compact />
      </Box>
      <InfoNote icon={<InfoRoundedIcon />}>
        {t.phase === "finished"
          ? "Sve se može mijenjati osim datuma. Ispravak rezultata (u tabu Kola, dodirom na stol) odmah mijenja poredak i rejting. Novo kolo dodaješ u tabu Kola, pa se turnir nastavlja."
          : started
            ? "Turnir je počeo: sve se može mijenjati osim datuma. Partija po kolu, zvanja i vrijeme partije vrijede za kola koja se tek slažu. Broj kola može ići do objavljenih kola, pa se turnir može završiti ranije."
            : "Sve se može mijenjati do početka turnira. Smanjiš li najveći broj ekipa, zadnje prijavljene idu na listu čekanja."}
      </InfoNote>
      {form.dirty && firstError && (
        <Box role="alert" sx={{px: "4px", fontSize: 14, fontWeight: 600, color: color.red}}>
          {firstError}
        </Box>
      )}
      {error && !asking && <ErrorNote>{error}</ErrorNote>}
      {!cancelled && (
        <PrimaryButton
          type="submit"
          icon={done ? <CheckCircleRoundedIcon /> : <SaveRoundedIcon />}
          disabled={!form.dirty || !form.valid}
          loading={saving}
          height={56}
          bg={done ? tint.green[12] : undefined}
          ink={done ? color.green : undefined}
          sx={done ? {opacity: 1, boxShadow: "none"} : undefined}
        >
          {done ? "Spremljeno" : "Spremi promjene"}
        </PrimaryButton>
      )}
      {form.dirty && (
        <Box component="button" type="button" onClick={form.reset} sx={{...buttonBase, height: 44, color: color.navy, fontSize: 15, fontWeight: 600}}>
          Odbaci promjene
        </Box>
      )}

      <SectionLabel sx={{mt: "8px"}}>Turnir</SectionLabel>
      <Box sx={{...adminCardSx, gap: "10px"}}>
        <OutlineButton onClick={() => router.push(`/turniri/novi?kopiraj=${t.id}`)} sx={{...action, borderColor: tint.navy[25]}}>
          <ContentCopyRoundedIcon sx={{fontSize: 20}} />
          Kopiraj turnir
        </OutlineButton>
        {!started && !cancelled && (
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
      </Box>
      <ConfirmSheet
        open={asking === "cancel"}
        onClose={() => setAsking(null)}
        onConfirm={() => act("cancel")}
        title={`Otkazati ${t.name}?`}
        text="Turnir ostaje u popisu kao Otkazan. Prijavljene ekipe neće dobiti obavijest."
        action="Otkaži turnir"
        icon={<EventBusyRoundedIcon />}
        busy={busy}
        error={asking === "cancel" ? error : null}
      />
      <ConfirmSheet
        open={asking === "delete"}
        onClose={() => setAsking(null)}
        onConfirm={() => act("delete")}
        title={`Obrisati ${t.name}?`}
        text="Turnir i sve prijave nestaju iz aplikacije. Može se obrisati samo prije početka turnira."
        action="Obriši turnir"
        icon={<DeleteRoundedIcon />}
        busy={busy}
        error={asking === "delete" ? error : null}
      />
    </Box>
  );
}
