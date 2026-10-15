"use client";

import {deleteLeagueRoundAPI, LeagueRoundSummary} from "@/app/_fetchers/admin/daily";
import {addTeamToLeagueAPI, removeTeamFromLeagueAPI, setLeagueTeamActiveAPI} from "@/app/_fetchers/league/leagues";
import {getCreateRoundDraftAPI} from "@/app/_fetchers/round/createRoundDraft";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import useLeagueRounds from "@/app/_hooks/useLeagueRounds";
import useLeagueTeams, {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import useLeagues from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import {useLeagueStandings} from "@/app/_hooks/useStandings";
import {createRoundNight, isPlaying} from "@/app/_lib/createRoundDraft";
import {NIGHT_STATUS_LABEL, NightStatus, nightLabel, nightsLeftLabel, nightStatus} from "@/app/_lib/nights";
import {count, NOUN} from "@/app/_lib/ui/text";
import {replaceAddress, TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {
  AddOption,
  BottomSheet,
  buttonBase,
  ConfirmSheet,
  dateInputFix,
  ellipsis,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  LeagueEyebrowButton,
  LoadingRows,
  OutlineButton,
  PrimaryButton,
  Screen,
  ScrollArea,
  SearchAddField,
  Segmented,
  SolidButton,
  SwitchTrack,
  tabular,
  TextField,
  TimeField,
} from "@/app/_ui/sp";
import {searchTeams} from "@/app/_ui/teams/teamSearch";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import {Box} from "@mui/material";
import React, {useEffect, useMemo, useState} from "react";
import {useLeagueDetails} from "@/app/league/[leagueId]/manage/LeagueDetailsView";
import {useLeagueDates} from "@/app/league/[leagueId]/manage/DatesView";
import {adminCardSx, adminLabelSx, DayPicker, PhoneStepper} from "./AdminParts";

type Tab = "teams" | "rounds" | "dates" | "details";
const TABS: {key: Tab; label: string}[] = [
  {key: "teams", label: "Ekipe"},
  {key: "rounds", label: "Kola"},
  {key: "dates", label: "Datumi"},
  {key: "details", label: "Postavke"},
];
export const isLeagueTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

// Upravljanje ligom on the admin's phone (admin-mobile 05, 08–12): Novo kolo first, then the league's teams, rounds,
// nights and settings. The tab is in the address (?view=), so Back and a reload keep it. Every rule and call is the
// desktop's; a delete is asked in a sheet.
export default function LeaguePhone({leagueId, view}: {leagueId: number; view: Tab}) {
  const router = useTransitionRouter();
  const nav = useNavStack("Upravljanje ligom", "/");
  const leagues = useLeagues(leagueId);
  const [tab, setTab] = useState<Tab>(view);
  const teams = useLeagueTeams(leagueId);
  const pick = (t: Tab) => {
    setTab(t);
    replaceAddress(`/league/${leagueId}/manage?view=${t}`);
  };

  return (
    <Screen fill gap={14}>
      <Box sx={{flex: "none", mx: "-6px"}}>
        <IconCircleButton label="Natrag" size={44} onClick={nav.back} sx={{"& svg": {fontSize: 26}}}>
          <ChevronLeftRoundedIcon />
        </IconCircleButton>
      </Box>
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          {leagues.length > 0 && (
            <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={(id) => router.router.replace(`/league/${id}/manage?view=${tab}`)} onNewLeague={() => router.push("/league/new")} />
          )}
          <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em", whiteSpace: "nowrap"}}>
            Upravljanje ligom
          </Box>
        </Box>
        <IconCircleButton label="Nova liga" size={48} onClick={() => router.push("/league/new")}>
          <AddRoundedIcon />
        </IconCircleButton>
      </Box>

      <ScrollArea bleed sx={{gap: "12px"}}>
        <NewRoundCard leagueId={leagueId} teams={teams.teams} />
        <Segmented<Tab> items={TABS} value={tab} onChange={pick} label="Upravljanje ligom" variant="track" idPrefix="lg" />
        {tab === "teams" ? (
          <TeamsTab leagueId={leagueId} data={teams} />
        ) : tab === "rounds" ? (
          <RoundsTab leagueId={leagueId} />
        ) : tab === "dates" ? (
          <DatesTab leagueId={leagueId} defaultTime={leagues.find((l) => l.id === leagueId)?.startTime ?? null} />
        ) : (
          <SettingsTab leagueId={leagueId} />
        )}
      </ScrollArea>
    </Screen>
  );
}

// The navy Novo kolo card: tonight and how many teams play (the admin's choice for tonight, else the active teams)
function NewRoundCard({leagueId, teams}: {leagueId: number; teams: LeagueTeam[] | null}) {
  const tonight = useMemo(() => createRoundNight(), []);
  const [sittingOut, setSittingOut] = useState<Set<number> | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getCreateRoundDraftAPI(leagueId)
      .then((d) => !cancelled && setSittingOut(d ? new Set(d.sitting_out) : null))
      .catch(() => !cancelled && setSittingOut(null));
    return () => {
      cancelled = true;
    };
  }, [leagueId]);
  const playing = teams && sittingOut !== undefined ? teams.filter((t) => isPlaying(t, sittingOut)).length : null;
  return (
    <Box
      component={TransitionLink}
      href={`/league/${leagueId}/manage?view=create`}
      sx={{
        ...buttonBase,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        p: "16px",
        borderRadius: "22px",
        background: color.navy,
        color: color.white,
        textAlign: "left",
        textDecoration: "none",
        boxShadow: shadow.hero,
        "&:active": {transform: "scale(.99)"},
      }}
    >
      <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
        <AddCircleRoundedIcon />
      </Box>
      <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 18, fontWeight: 700}}>
          Novo kolo
        </Box>
        <Box component="span" sx={{fontSize: 14, color: color.cream, ...ellipsis}}>
          {nightLabel(tonight)}
          {playing != null ? ` · ${count(playing, NOUN.ekipa)} igra` : ""}
        </Box>
      </Box>
      <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26}} />
    </Box>
  );
}

// ---------- Ekipe (05, 08) ----------

function TeamsTab({leagueId, data}: {leagueId: number; data: ReturnType<typeof useLeagueTeams>}) {
  const {teams, setTeams, error, loading, reload} = data;
  const {standings} = useLeagueStandings(leagueId);
  const played = useMemo(() => new Map((standings ?? []).map((s) => [Number(s.team_id), s.rounds_played])), [standings]);
  const [outside, setOutside] = useState<AddOption[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [asking, setAsking] = useState<LeagueTeam | null>(null);
  const [removing, setRemoving] = useState(false);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  // every team, to add one that isn't in the league
  useEffect(() => {
    let cancelled = false;
    searchTeams("")
      .then((all) => !cancelled && setOutside(all.map((t) => ({id: t.id, name: t.title, sub: t.subtitle}))))
      .catch(() => !cancelled && setOutside([]));
    return () => {
      cancelled = true;
    };
  }, []);
  const inLeague = new Set((teams ?? []).map((t) => t.id));
  const options = (outside ?? []).filter((o) => !inLeague.has(Number(o.id)));

  const add = async (o: AddOption) => {
    setActionError(null);
    try {
      const {smokers} = await addTeamToLeagueAPI(leagueId, Number(o.id));
      setTeams((prev) => [{id: Number(o.id), name: o.name, players: [], active: true, smokers}, ...(prev ?? [])]);
      setJustAdded(Number(o.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ekipu nije moguće dodati.");
    }
  };
  // optimistic: the switch moves at once and goes back if the server refuses
  const setActive = async (t: LeagueTeam, active: boolean) => {
    setActionError(null);
    setTeams((prev) => prev?.map((x) => (x.id === t.id ? {...x, active} : x)) ?? prev);
    try {
      await setLeagueTeamActiveAPI(leagueId, t.id, active);
    } catch (e) {
      setTeams((prev) => prev?.map((x) => (x.id === t.id ? {...x, active: !active} : x)) ?? prev);
      setActionError(e instanceof Error ? e.message : "Status ekipe nije spremljen.");
    }
  };
  const remove = async () => {
    if (!asking) return;
    setRemoving(true);
    setActionError(null);
    try {
      await removeTeamFromLeagueAPI(leagueId, asking.id);
      setTeams((prev) => prev?.filter((x) => x.id !== asking.id) ?? prev);
      setAsking(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ekipa nije obrisana iz lige.");
    }
    setRemoving(false);
  };

  return (
    <>
      <SearchAddField
        placeholder="Dodaj ekipu · ime ekipe"
        icon={<GroupAddRoundedIcon />}
        options={options}
        onAdd={add}
        note="Neaktivne ekipe se ne uključuju automatski kad kreiraš novo kolo."
        noHit="Nijedna ekipa izvan lige ne odgovara. Novu ekipu napravi na kartici Ekipe."
        // in a scrolling column it keeps its height (and its hits) instead of giving way
        sx={{flex: "none"}}
      />
      {actionError && !asking && <ErrorNote>{actionError}</ErrorNote>}
      {error ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : loading || !teams ? (
        <Box sx={{...adminCardSx, p: 0, overflow: "hidden"}}>
          <LoadingRows rows={6} height={64} />
        </Box>
      ) : teams.length === 0 ? (
        <EmptyState>Ova liga još nema ekipa.</EmptyState>
      ) : (
        <Box component="ul" aria-label="Ekipe lige" sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
          {teams.map((t, i) => {
            const n = played.get(t.id);
            return (
              <Box
                component="li"
                key={t.id}
                sx={{minHeight: 68, display: "flex", alignItems: "center", gap: "8px", pl: "16px", pr: "6px", borderTop: i ? `1px solid ${color.line}` : "none", background: t.id === justAdded ? color.cream2 : "transparent"}}
              >
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", opacity: t.active ? 1 : 0.6}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                    {t.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {!t.active ? "Neaktivna · ne ulazi u nova kola" : n != null ? count(n, NOUN.odigranoKolo) : "Još nije igrala"}
                  </Box>
                </Box>
                <Box
                  component="button"
                  type="button"
                  role="switch"
                  aria-checked={t.active}
                  aria-label={`${t.name}: ${t.active ? "aktivna" : "neaktivna"}`}
                  onClick={() => setActive(t, !t.active)}
                  sx={{...buttonBase, height: 44, px: "4px", display: "flex", alignItems: "center", borderRadius: "16px"}}
                >
                  <SwitchTrack on={t.active} />
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label={`Obriši ${t.name} iz lige`}
                  onClick={() => {
                    setActionError(null);
                    setAsking(t);
                  }}
                  sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:active": {color: color.red}}}
                >
                  <DeleteRoundedIcon />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      <ConfirmSheet
        open={asking != null}
        onClose={() => setAsking(null)}
        onConfirm={remove}
        title="Obrisati ekipu iz lige?"
        text={asking ? `${asking.name} i njezini odigrani rezultati maknu se iz poretka ove lige. Ekipa i igrači ostaju u aplikaciji.` : ""}
        action="Obriši"
        icon={<DeleteRoundedIcon />}
        busy={removing}
        error={asking ? actionError : null}
      />
    </>
  );
}

// ---------- Kola (09, 10) ----------

const ROUND_LOOK: Record<LeagueRoundSummary["status"], {label: string; ink: string; bg: string}> = {
  draft: {label: "Skica", ink: color.muted, bg: color.lineFill},
  approved: {label: "Odobreno", ink: color.navy, bg: tint.navy[12]},
  new: {label: "Nije počelo", ink: color.ink2, bg: color.paper},
  live: {label: "U tijeku", ink: color.red, bg: tint.red[10]},
  played: {label: "Odigrano", ink: color.green, bg: tint.green[12]},
};

function RoundsTab({leagueId}: {leagueId: number}) {
  const {rounds, setRounds, error, reload} = useLeagueRounds(leagueId);
  const tonight = useMemo(() => createRoundNight(), []);
  const [asking, setAsking] = useState<LeagueRoundSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // the nights, latest first, each with its rounds in order
  const nights = useMemo(() => {
    const by = new Map<string, LeagueRoundSummary[]>();
    for (const r of rounds ?? []) by.set(r.date, [...(by.get(r.date) ?? []), r]);
    return Array.from(by, ([date, list]) => ({date, list: list.sort((a, b) => a.roundNumber - b.roundNumber)})).sort((a, b) => b.date.localeCompare(a.date));
  }, [rounds]);

  const remove = async () => {
    if (!asking) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteLeagueRoundAPI(leagueId, asking.date, asking.roundNumber);
      setRounds((prev) => prev?.filter((r) => !(r.date === asking.date && r.roundNumber === asking.roundNumber)) ?? prev);
      setAsking(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Kolo nije obrisano.");
    }
    setBusy(false);
  };
  const played = asking != null && (asking.status === "played" || asking.status === "live");

  return (
    <>
      <Box component="p" sx={{m: 0, px: "4px", fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
        Obriši kolo ako je greškom kreirano. Rezultati tog kola se brišu.
      </Box>
      {error ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !rounds ? (
        <Box sx={{...adminCardSx, p: 0, overflow: "hidden"}}>
          <LoadingRows rows={6} height={60} />
        </Box>
      ) : nights.length === 0 ? (
        <EmptyState>Ova liga nema kola.</EmptyState>
      ) : (
        nights.map((n) => (
          <Box component="section" key={n.date} aria-label={nightLabel(n.date)} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
            <Box sx={{px: "6px", display: "flex", alignItems: "baseline", gap: "8px"}}>
              <Box component="h2" sx={{m: 0, fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.ink2}}>
                {nightLabel(n.date)}
              </Box>
              {n.date === tonight && (
                <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                  Večeras
                </Box>
              )}
            </Box>
            <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
              {n.list.map((r, i) => {
                const look = ROUND_LOOK[r.status];
                return (
                  <Box component="li" key={r.roundNumber} sx={{minHeight: 60, display: "flex", alignItems: "center", gap: "10px", pl: "16px", pr: "6px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
                    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: "8px"}}>
                      <Box component="span" sx={{fontSize: 16, fontWeight: 600}}>
                        Kolo {r.roundNumber}
                      </Box>
                      <Box component="span" sx={{fontSize: 13, color: color.muted, ...tabular}}>
                        {count(r.tables, NOUN.stol)}
                      </Box>
                    </Box>
                    <Box component="span" sx={{flex: "none", height: 26, display: "flex", alignItems: "center", px: "9px", borderRadius: "8px", background: look.bg, color: look.ink, fontSize: 13, fontWeight: 700}}>
                      {look.label}
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      aria-label={`Obriši kolo ${r.roundNumber}, ${nightLabel(r.date)}`}
                      onClick={() => {
                        setActionError(null);
                        setAsking(r);
                      }}
                      sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:active": {color: color.red}}}
                    >
                      <DeleteRoundedIcon />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))
      )}
      <ConfirmSheet
        open={asking != null}
        onClose={() => setAsking(null)}
        onConfirm={remove}
        title="Obrisati kolo?"
        text={
          asking
            ? `Kolo ${asking.roundNumber} (${nightLabel(asking.date)}) ${played ? "i svi upisani rezultati tog kola se brišu" : `i ${count(asking.tables, NOUN.stol)} se brišu`}. Ovo se ne može poništiti.`
            : ""
        }
        action="Obriši kolo"
        icon={<DeleteRoundedIcon />}
        busy={busy}
        error={asking ? actionError : null}
      />
    </>
  );
}

// ---------- Datumi (11) ----------

const NIGHT_PILL: Record<NightStatus, {bg: string; ink: string}> = {
  played: {bg: tint.green[12], ink: color.green},
  notPlayed: {bg: "transparent", ink: color.muted},
  next: {bg: color.navy, ink: color.white},
  upcoming: {bg: color.lineFill, ink: color.ink2},
};

function DatesTab({leagueId, defaultTime}: {leagueId: number; defaultTime: string | null}) {
  const data = useLeagueNights(leagueId);
  const ld = useLeagueDates(leagueId, defaultTime, data);
  // the night opened to change its start time or to take it out
  const [open, setOpen] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const next = ld.nextIndex >= 0 ? ld.list[ld.nextIndex] : null;
  const opened = ld.list.find((n) => n.date === open) ?? null;

  return (
    <>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: "16px 18px", borderRadius: "22px", background: color.navy, color: color.white}}>
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream}}>
            Sljedeća večer
          </Box>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.1}}>
            {next ? nightLabel(next.date) : "—"}
            {next?.time && (
              <Box component="span" sx={{fontFamily: font.body, fontSize: 16, fontWeight: 600, color: color.cream, ml: "8px"}}>
                {next.time}
              </Box>
            )}
          </Box>
          <Box component="span" sx={{fontSize: 14, color: color.cream}}>
            {nightsLeftLabel(ld.toGo)}
          </Box>
        </Box>
        <EventRepeatRoundedIcon aria-hidden sx={{fontSize: 36, color: color.cream}} />
      </Box>

      <Box component="form" aria-label="Dodaj večer" noValidate onSubmit={(e: React.FormEvent) => (e.preventDefault(), ld.add())} sx={{flex: "none", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "8px"}}>
        <Box
          component="input"
          type="date"
          aria-label="Datum nove večeri"
          value={ld.draft}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => ld.setDraft(e.target.value)}
          aria-invalid={ld.duplicate || undefined}
          sx={{...dateInputFix, width: "100%", height: 52, boxSizing: "border-box", borderRadius: "16px", border: `1.5px solid ${ld.duplicate ? color.red : color.border}`, background: color.white, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none", "&:focus": {borderColor: color.navy}}}
        />
        <SolidButton type="submit" height={52} disabled={!ld.canAdd} loading={ld.adding} sx={{px: "16px", borderRadius: "16px", fontSize: 16}}>
          <AddRoundedIcon aria-hidden sx={{fontSize: 22}} />
          Dodaj
        </SolidButton>
      </Box>
      {ld.duplicate && <ErrorNote>Ta večer je već na popisu.</ErrorNote>}
      {ld.actionError && !open && <ErrorNote>{ld.actionError}</ErrorNote>}

      {ld.error && !ld.nights ? (
        <ErrorNote onRetry={ld.reload}>{ld.error}</ErrorNote>
      ) : !ld.nights ? (
        <Box sx={{...adminCardSx, p: 0, overflow: "hidden"}}>
          <LoadingRows rows={6} height={58} />
        </Box>
      ) : ld.list.length === 0 ? (
        <EmptyState>Liga još nema večeri. Dodaj prvu gore.</EmptyState>
      ) : (
        <Box component="ol" aria-label="Večeri lige" sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
          {ld.list.map((n, i) => {
            const isNext = i === ld.nextIndex;
            const status = nightStatus(n.date, isNext, ld.today, n.played);
            const future = n.date >= ld.today;
            const row = (
              <>
                <Box component="span" sx={{width: 28, flex: "none", fontSize: 14, fontWeight: 600, color: color.muted, ...tabular}}>
                  {i + 1}
                </Box>
                <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: "8px"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: isNext ? 700 : 600, color: future ? color.ink : color.muted}}>
                    {nightLabel(n.date)}
                  </Box>
                  {n.time && (
                    <Box component="span" sx={{fontSize: 13, color: color.muted, ...tabular}}>
                      {n.time}
                    </Box>
                  )}
                </Box>
                <Box component="span" sx={{flex: "none", height: 26, display: "flex", alignItems: "center", px: "9px", borderRadius: "8px", background: NIGHT_PILL[status].bg, color: NIGHT_PILL[status].ink, fontSize: 13, fontWeight: 700}}>
                  {NIGHT_STATUS_LABEL[status]}
                </Box>
              </>
            );
            const rowSx = {minHeight: 56, display: "flex", alignItems: "center", gap: "10px", pl: "16px", pr: "12px", background: isNext ? color.cream2 : "transparent", boxShadow: isNext ? shadow.mineBar : "none"} as const;
            return (
              <Box component="li" key={n.date} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                {future ? (
                  <Box
                    component="button"
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`${nightLabel(n.date)}${n.time ? `, ${n.time}` : ""}: ${NIGHT_STATUS_LABEL[status].toLowerCase()}. Promijeni`}
                    onClick={() => {
                      setOpen(n.date);
                      setTime(n.time ?? "");
                    }}
                    sx={{...buttonBase, ...rowSx, width: "100%", textAlign: "left"}}
                  >
                    {row}
                    <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.navy}} />
                  </Box>
                ) : (
                  <Box sx={rowSx}>{row}</Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <BottomSheet open={opened != null} onClose={() => setOpen(null)} title={opened ? nightLabel(opened.date) : ""} closable busy={ld.savingTime != null || ld.removing != null}>
        {opened && (
          <>
            <TimeField
              label="Početak večeri"
              value={time}
              onChange={setTime}
              clearLabel={defaultTime ? `Vrati zadani početak (${defaultTime})` : "Ukloni početak"}
            />
            <Box component="p" sx={{m: 0, fontSize: 13.5, lineHeight: 1.45, color: color.ink2}}>
              {defaultTime ? `Zadani početak lige je ${defaultTime}. Prazno polje vraća zadani.` : "Liga nema zadani početak. Postavi ga u Postavkama."}
            </Box>
            {ld.actionError && <ErrorNote>{ld.actionError}</ErrorNote>}
            <SolidButton
              height={54}
              loading={ld.savingTime === opened.date}
              disabled={(time || null) === (opened.time ?? null)}
              onClick={async () => {
                await ld.setTime(opened.date, time || null);
                setOpen(null);
              }}
              sx={{fontSize: 16}}
            >
              Spremi početak
            </SolidButton>
            {!opened.played && (
              <OutlineButton
                height={54}
                tone={color.red}
                disabled={ld.removing != null}
                onClick={async () => {
                  await ld.remove(opened.date);
                  setOpen(null);
                }}
                sx={{fontSize: 16, borderWidth: "1.5px", borderColor: tint.red[35]}}
              >
                <DeleteRoundedIcon aria-hidden sx={{fontSize: 20}} />
                Makni večer
              </OutlineButton>
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}

// ---------- Postavke (12) ----------

function SettingsTab({leagueId}: {leagueId: number}) {
  const leagues = useLeagues(leagueId);
  const f = useLeagueDetails(leagueId, leagues);
  const inputSx = {height: 52, borderRadius: "14px", fontSize: 16};
  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e: React.FormEvent) => (e.preventDefault(), f.save())}
      sx={{...adminCardSx, gap: "14px"}}
    >
      <TextField label="Naziv lige" value={f.d.name} onChange={(e) => f.set("name", e.target.value)} soft inputSx={inputSx} />
      <TextField label="Sezona" value={f.d.season} onChange={(e) => f.set("season", e.target.value)} soft inputSx={inputSx} />
      <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
        <TextField label="Početak" type="date" value={f.d.start} onChange={(e) => f.set("start", e.target.value)} soft inputSx={inputSx} />
        <TextField label="Kraj" type="date" value={f.d.end} min={f.d.start || undefined} onChange={(e) => f.set("end", e.target.value)} soft inputSx={inputSx} />
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box id="st-day" sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
          Dan igranja · neobavezno
        </Box>
        <DayPicker value={f.d.day} onChange={(v) => f.set("day", v)} labelId="st-day" />
      </Box>
      <TimeField label="Početak večeri · neobavezno" value={f.d.time} onChange={(v) => f.set("time", v)} clearLabel="Ukloni početak večeri" soft inputSx={inputSx} />
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box component="span" sx={{...adminLabelSx, fontSize: 14, color: color.ink2, pl: "4px"}}>
          Kola po večeri
        </Box>
        <PhoneStepper label="Kola po večeri" value={f.d.rounds} onChange={(n) => f.set("rounds", n)} min={1} max={6} less="Manje kola po večeri" more="Više kola po večeri" />
      </Box>
      {f.error && f.dirty && (
        <Box role="alert" sx={{fontSize: 14, fontWeight: 600, color: color.red, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
          <ErrorRoundedIcon />
          {f.error}
        </Box>
      )}
      {f.serverError && <ErrorNote>{f.serverError}</ErrorNote>}
      <PrimaryButton
        type="submit"
        icon={!f.dirty && f.saved ? <CheckCircleRoundedIcon /> : <SaveRoundedIcon />}
        disabled={!f.canSave}
        loading={f.saving}
        height={56}
        bg={!f.dirty && f.saved ? tint.green[12] : undefined}
        ink={!f.dirty && f.saved ? color.green : undefined}
        sx={!f.dirty && f.saved ? {opacity: 1, boxShadow: "none"} : undefined}
      >
        {!f.dirty && f.saved ? "Spremljeno" : "Spremi promjene"}
      </PrimaryButton>
      {f.dirty && (
        <Box component="button" type="button" onClick={f.discard} sx={{...buttonBase, height: 44, color: color.navy, fontSize: 15, fontWeight: 600}}>
          Odbaci promjene
        </Box>
      )}
    </Box>
  );
}
