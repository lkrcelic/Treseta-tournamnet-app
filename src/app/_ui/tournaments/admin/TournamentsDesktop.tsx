"use client";

import {restoreTournamentAPI} from "@/app/_fetchers/tournament";
import {useAdminTournament, useAdminTournaments} from "@/app/_hooks/useTournaments";
import {AdminTournament, TournamentCard} from "@/app/_interfaces/tournament";
import {nightLabel} from "@/app/_lib/nights";
import {capacityLabel} from "@/app/_lib/tournaments";
import {dayMonth} from "@/app/_lib/ui/burza";
import {count, NOUN} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, DesktopShell, ellipsis, EmptyState, ErrorNote, InfoNote, LoadingRows, NARROW_DESKTOP, PrimaryButton, Spinner} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EventListRoundedIcon from "@mui/icons-material/EventNoteRounded";
import EventUpcomingRoundedIcon from "@mui/icons-material/EventRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";
import {DateTile, FillBar, StatusChip, statusOf, tournamentMeta, ViewTabs} from "../TournamentParts";
import {clockOf} from "./DayAdmin";

// The admin's Turniri (Claude Design "Turniri admin" A1): the tournaments by phase, Nadolazeći · Aktivni · Završeni,
// in a table on the left; the picked one on the right (PickedCard), with Prijave, Kola or Poredak to open it.

export type ListTab = "upcoming" | "active" | "finished";

// Nadolazeći soonest first; Aktivni and Završeni (cancelled ones too) newest first
// Aktivni: being played, or its day has come (Potvrda dolaska, before Kolo 1)
export const activeNow = (t: TournamentCard) => t.phase === "active" || (t.phase === "upcoming" && t.day != null && t.day.phase !== "before");

export function tournamentsOf(list: TournamentCard[], tab: ListTab): TournamentCard[] {
  const inTab = list.filter((t) =>
    tab === "upcoming" ? t.phase === "upcoming" && !activeNow(t) : tab === "active" ? activeNow(t) : t.phase === "finished" || t.phase === "cancelled"
  );
  return inTab.sort((a, b) => (tab === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.id - b.id);
}

// "Otkazao Lovro, 22. 10. · 14 ekipa bilo prijavljeno"
export const cancelledLine = (t: TournamentCard) =>
  [t.cancelled_info ? `Otkazao ${t.cancelled_info.by ?? "admin"}, ${dayMonth(t.cancelled_info.at)}` : "Otkazan", `${count(t.teams + t.waiting, NOUN.ekipa)} bilo prijavljeno`].join(" · ");

const placeLine = (t: TournamentCard) => [t.location.name, t.location.address].filter(Boolean).join(", ") || "—";

export default function TournamentsDesktop() {
  const router = useTransitionRouter();
  const {tournaments, error, reload} = useAdminTournaments();
  const [tab, setTab] = useState<ListTab>("upcoming");
  const [picked, setPicked] = useState<number | null>(null);
  const list = tournamentsOf(tournaments ?? [], tab);
  const current = list.find((t) => t.id === picked) ?? list[0] ?? null;
  const counts = {
    upcoming: tournamentsOf(tournaments ?? [], "upcoming").length,
    active: tournamentsOf(tournaments ?? [], "active").length,
    finished: tournamentsOf(tournaments ?? [], "finished").length,
  };
  const grid = {flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 330px"}, gap: "20px"} as const;
  const cols = "minmax(0,1.6fr) minmax(0,1fr) 84px 190px";

  return (
    <DesktopShell
      active="manageTournaments"
      eyebrow="Admin"
      title="Turniri"
      right={
        <PrimaryButton icon={<AddRoundedIcon />} height={52} onClick={() => router.push("/turniri/novi")} sx={{px: "22px", fontSize: 16}}>
          Novi turnir
        </PrimaryButton>
      }
    >
      <ViewTabs<ListTab>
        label="Turniri"
        value={tab}
        onChange={(k) => {
          setTab(k);
          setPicked(null);
        }}
        items={[
          {key: "upcoming", label: "Nadolazeći", icon: <EventUpcomingRoundedIcon />, count: counts.upcoming},
          {key: "active", label: "Aktivni", icon: <PlayCircleRoundedIcon />, count: counts.active},
          {key: "finished", label: "Završeni", icon: <FlagRoundedIcon />, count: counts.finished},
        ]}
      />
      <Box sx={grid}>
        <Card component="section" aria-label="Popis turnira" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          <Box
            aria-hidden
            sx={{flex: "none", height: 40, display: "grid", gridTemplateColumns: cols, gap: "14px", alignItems: "center", pl: "20px", pr: "128px", background: color.paper2, borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
          >
            <span>Turnir</span>
            <span>Mjesto</span>
            <Box component="span" sx={{textAlign: "center"}}>
              Ekipe
            </Box>
            <Box component="span" sx={{textAlign: "right"}}>
              Prijave
            </Box>
          </Box>
          {error ? (
            <ErrorNote onRetry={reload} sx={{m: "14px"}}>
              {error}
            </ErrorNote>
          ) : !tournaments ? (
            <LoadingRows rows={6} height={72} />
          ) : list.length === 0 ? (
            <EmptyState>{tab === "upcoming" ? "Nema nadolazećih turnira. Napravi prvi s Novi turnir." : tab === "active" ? "Danas se ne igra nijedan turnir." : "Još nema završenih turnira."}</EmptyState>
          ) : (
            <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto"}}>
              {list.map((t) => {
                const on = current?.id === t.id;
                return (
                  <Box component="li" key={t.id} sx={{position: "relative"}}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setPicked(t.id)}
                      // a double click opens it (Upravljanje turnirom), as the card's Prijave, Kola or Poredak does
                      onDoubleClick={() => router.push(`/turniri/${t.id}/upravljanje`)}
                      aria-pressed={on}
                      sx={{
                        ...buttonBase,
                        width: "100%",
                        minHeight: 74,
                        display: "grid",
                        gridTemplateColumns: cols,
                        gap: "14px",
                        alignItems: "center",
                        pl: "20px",
                        // room for Otvori, which sits on top of the row (a button cannot hold another one)
                        pr: "128px",
                        py: "8px",
                        textAlign: "left",
                        borderBottom: `1px solid ${color.divider}`,
                        background: on ? color.cream2 : "transparent",
                        boxShadow: on ? shadow.mineBar : "none",
                        "&:hover": {background: on ? color.cream2 : color.paper2},
                      }}
                    >
                      <Box sx={{display: "flex", alignItems: "center", gap: "12px", minWidth: 0}}>
                        <DateTile date={t.date} size={46} done={t.phase === "finished" || t.phase === "cancelled"} />
                        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                          <Box component="span" sx={{fontSize: 16, fontWeight: 700, color: t.phase === "cancelled" ? color.muted : color.ink, textDecoration: t.phase === "cancelled" ? "line-through" : "none", ...ellipsis}}>
                            {t.name}
                          </Box>
                          <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                            {t.phase === "cancelled" ? cancelledLine(t) : tournamentMeta(t)}
                          </Box>
                        </Box>
                      </Box>
                      <Box component="span" sx={{fontSize: 14, color: color.ink2, ...ellipsis}}>
                        {placeLine(t)}
                      </Box>
                      <Box component="span" sx={{textAlign: "center", fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums"}}>
                        {capacityLabel(t.teams, t.max_teams)}
                      </Box>
                      <Box sx={{display: "flex", justifyContent: "flex-end"}}>
                        <StatusChip status={statusOf(t)} sx={{alignSelf: "center"}} />
                      </Box>
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => router.push(`/turniri/${t.id}/upravljanje`)}
                      aria-label={`Otvori ${t.name}`}
                      sx={{
                        ...buttonBase,
                        position: "absolute",
                        right: "20px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        height: 36,
                        px: "12px",
                        borderRadius: "12px",
                        border: `1.5px solid ${tint.navy[25]}`,
                        background: color.white,
                        color: color.navy,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: 13.5,
                        fontWeight: 700,
                        "&:hover": {background: color.paper2},
                        "& svg": {fontSize: 18},
                      }}
                    >
                      Otvori
                      <ArrowForwardRoundedIcon aria-hidden />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Card>
        <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
          {current && <PickedCard key={current.id} t={current} onChanged={reload} />}
          <InfoNote icon={<InfoRoundedIcon />}>Otvori ili dvoklik na turnir otvara upravljanje. Uredi, Kopiraj, Otkaži i Obriši su u turniru, u tabu Podaci; obrisati se može samo prije početka.</InfoNote>
        </Box>
      </Box>
    </DesktopShell>
  );
}

// The picked tournament on the right, by what the admin wants from it in each tab:
// - Nadolazeći: the latest sign-ups, with Prijave (Upravljanje turnirom · Prijave) and Stranica
// - Aktivni: on its day before Kolo 1 who is here; once it runs, the Kolo being played and the top three so far, with
//   Kola and Stranica
// - Završeni: the top three, Poredak and Stranica; a cancelled one has Vrati turnir (back with its sign-ups open)
// Kopiraj, Otkaži, Obriši and the sign-ups switch are in Upravljanje turnirom (Podaci, the header).
function PickedCard({t, onChanged}: {t: TournamentCard; onChanged: () => void}) {
  const router = useTransitionRouter();
  const {tournament: full, error: loadError} = useAdminTournament(t.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manage = (view: string) => router.push(`/turniri/${t.id}/upravljanje?view=${view}`);
  const today = activeNow(t) && t.phase === "upcoming";

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await restoreTournamentAPI(t.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turnir nije vraćen.");
    }
    setBusy(false);
  };

  const tile = {
    ...buttonBase,
    flex: 1,
    height: 52,
    borderRadius: "14px",
    background: color.paper2,
    color: color.navy,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    px: "14px",
    fontSize: 15,
    fontWeight: 700,
    "&:hover": {background: color.paper},
    "& svg": {fontSize: 20},
  } as const;
  const primary = {...tile, background: color.navy, color: color.white, "&:hover": {background: color.navy}} as const;
  const stranica = (
    <Box component="button" type="button" onClick={() => router.push(`/turniri/${t.id}`)} sx={tile}>
      <OpenInNewRoundedIcon aria-hidden />
      Stranica
    </Box>
  );

  let body: React.ReactNode;
  let actions: React.ReactNode;
  if (t.phase === "cancelled") {
    body = (
      <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
        <StatusChip status={statusOf(t)} sx={{alignSelf: "flex-start"}} />
        <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
          {cancelledLine(t)}
        </Box>
        <Box component="span" sx={{fontSize: 13.5, lineHeight: 1.45, color: color.muted}}>
          Otkazan greškom ili odgođen? Vrati ga: ide među nadolazeće s istim ekipama, a prijave se ponovo otvaraju.
        </Box>
      </Box>
    );
    actions = (
      <>
        <Box component="button" type="button" onClick={restore} disabled={busy} aria-busy={busy || undefined} sx={primary}>
          {busy ? <Spinner size={20} /> : <RestoreRoundedIcon aria-hidden />}
          Vrati turnir
        </Box>
        {stranica}
      </>
    );
  } else if (t.phase === "finished") {
    body = <TopThree full={full} title="Pobjednici" />;
    actions = (
      <>
        <Box component="button" type="button" onClick={() => manage("poredak")} sx={primary}>
          <LeaderboardRoundedIcon aria-hidden />
          Poredak
        </Box>
        {stranica}
      </>
    );
  } else if (t.phase === "active") {
    body = (
      <>
        <LiveLine t={t} full={full} />
        <TopThree full={full} title="Trenutno vode" />
      </>
    );
    actions = (
      <>
        <Box component="button" type="button" onClick={() => manage("kola")} sx={primary}>
          <EventListRoundedIcon aria-hidden />
          Kola
        </Box>
        {stranica}
      </>
    );
  } else {
    body = (
      <>
        {today && full?.arrival_summary ? (
          <Box sx={{display: "flex", gap: "8px"}}>
            <Stat value={full.arrival_summary.here} label="Tu" tone={tint.green[12]} />
            <Stat value={full.arrival_summary.not_confirmed} label="Nije potvrdilo" />
            <Stat value={full.arrival_summary.waiting} label="Čeka" tone={tint.gold[16]} />
          </Box>
        ) : (
          <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
            <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
              {t.registrations_open ? "Prijave otvorene" : "Prijave zatvorene"} · {t.max_teams != null ? `${t.teams} od ${t.max_teams} ekipa` : count(t.teams, NOUN.ekipa)}
              {t.waiting > 0 ? ` · ${t.waiting} na listi čekanja` : ""}
            </Box>
            <FillBar registered={t.teams} max={t.max_teams} />
          </Box>
        )}
        <LatestEntries full={full} />
      </>
    );
    actions = (
      <>
        <Box component="button" type="button" onClick={() => manage("prijave")} sx={primary}>
          <GroupsRoundedIcon aria-hidden />
          Prijave
        </Box>
        {stranica}
      </>
    );
  }

  return (
    <Card component="section" aria-labelledby={`t-${t.id}`} sx={{flex: "none", borderRadius: "24px", p: "22px", display: "flex", flexDirection: "column", gap: "14px"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
          {[nightLabel(t.date), t.start_time].filter(Boolean).join(" · ")}
        </Box>
        <Box component="h2" id={`t-${t.id}`} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1.1}}>
          {t.name}
        </Box>
        <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
          {[t.location.name, tournamentMeta({...t, start_time: null})].filter(Boolean).join(" · ")}
        </Box>
      </Box>
      {body}
      {loadError && !full && <ErrorNote>{loadError}</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "flex", gap: "8px", pt: "4px"}}>{actions}</Box>
    </Card>
  );
}

const LATEST = 5;

// Nadolazeći: the last teams to sign up (the waiting list too), newest first, with their players and when
function LatestEntries({full}: {full: AdminTournament | null}) {
  if (!full) return <LoadingRows rows={3} height={48} />;
  const latest = [...full.entries, ...full.waiting_list].sort((a, b) => b.registered_at.localeCompare(a.registered_at)).slice(0, LATEST);
  return (
    <Box component="section" aria-label="Zadnje prijave" sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
      <Box component="h3" sx={{m: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
        Zadnje prijave
      </Box>
      {latest.length === 0 ? (
        <Box component="span" sx={{fontSize: 14, color: color.muted}}>
          Još se nitko nije prijavio.
        </Box>
      ) : (
        <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "16px", background: color.paper2, overflow: "hidden"}}>
          {latest.map((e, i) => (
            <Box component="li" key={e.team_id} sx={{display: "flex", alignItems: "center", gap: "10px", p: "9px 12px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
              <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                <Box component="span" sx={{fontSize: 14.5, fontWeight: 700, ...ellipsis}}>
                  {e.team_name}
                  {e.status === "WAITING" && (
                    <Box component="span" sx={{ml: "6px", fontSize: 12, fontWeight: 700, color: color.medal[0]}}>
                      čeka {e.position}.
                    </Box>
                  )}
                </Box>
                <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                  {e.players.map((p) => p.name).join(" · ")}
                </Box>
              </Box>
              <Box component="span" sx={{flex: "none", fontSize: 12.5, color: color.muted, textAlign: "right", fontVariantNumeric: "tabular-nums"}}>
                {dayMonth(e.registered_at)} {clockOf(e.registered_at)}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Aktivni: the Kolo being played and how many of its tables are over, or that the next one waits to be published
function LiveLine({t, full}: {t: TournamentCard; full: AdminTournament | null}) {
  const kolo = t.live_kolo != null ? full?.results.kolos.find((k) => k.number === t.live_kolo) : null;
  const done = kolo ? kolo.tables.filter((x) => !x.open).length : null;
  const line =
    t.live_kolo != null
      ? `Kolo ${t.live_kolo} uživo${kolo ? ` · ${done} od ${kolo.tables.length} stolova gotovo` : ""}`
      : full?.next_kolo
        ? `Odigrano ${t.completed_kolos} od ${t.rounds} kola · Kolo ${full.next_kolo.number} čeka objavu`
        : `Odigrano ${t.completed_kolos} od ${t.rounds} kola`;
  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "10px", p: "14px", borderRadius: "16px", background: tint.red[6], color: color.red, fontSize: 15, fontWeight: 700, "& svg": {flex: "none"}}}>
      <PlayCircleRoundedIcon aria-hidden />
      {line}
    </Box>
  );
}

// Završeni (Pobjednici) and Aktivni (Trenutno vode): the first three of the standings
function TopThree({full, title}: {full: AdminTournament | null; title: string}) {
  if (!full) return <LoadingRows rows={3} height={48} />;
  const top = full.results.standings.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <Box component="section" aria-label={title} sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
      <Box component="h3" sx={{m: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
        {title}
      </Box>
      <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "6px"}}>
        {top.map((r, i) => (
          <Box component="li" key={r.team_id} sx={{display: "flex", alignItems: "center", gap: "12px", p: "10px 12px", borderRadius: "14px", background: color.medalBg[i]}}>
            <Box component="span" sx={{width: 30, height: 30, flex: "none", borderRadius: "10px", background: color.white, color: color.medal[i], display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.display, fontSize: 17, fontWeight: 800}}>
              {i + 1}
            </Box>
            <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
              <Box component="span" sx={{fontSize: 15, fontWeight: 700, ...ellipsis}}>
                {r.team.team_name}
              </Box>
              <Box component="span" sx={{fontSize: 12.5, color: color.ink2, ...ellipsis}}>
                {r.players.join(" · ")}
              </Box>
            </Box>
            <Box component="span" sx={{flex: "none", fontFamily: font.display, fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums"}}>
              {r.score}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// a number with its label (Tu, Nije potvrdilo, Čeka) on the day before Kolo 1
function Stat({value, label, tone = color.paper2}: {value: number; label: string; tone?: string}) {
  return (
    <Box sx={{flex: 1, display: "flex", flexDirection: "column", gap: "2px", p: "10px 12px", borderRadius: "14px", background: tone}}>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1}}>
        {value}
      </Box>
      <Box component="span" sx={{fontSize: 12.5, color: color.ink2}}>
        {label}
      </Box>
    </Box>
  );
}

// The desktop's inline confirmation (as Upravljanje ligom's): what happens, Odustani and the red action
export function Confirm({title, text, action, busy, onCancel, onConfirm}: {title: string; text: string; action: string; busy: boolean; onCancel: () => void; onConfirm: () => void}) {
  const small = {...buttonBase, flex: 1, height: 44, borderRadius: "12px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"} as const;
  return (
    <Box role="alert" sx={{display: "flex", flexDirection: "column", gap: "12px", p: "12px 14px", borderRadius: "16px", border: `1.5px solid ${tint.red[35]}`, background: tint.red[6]}}>
      <Box sx={{display: "flex", gap: "10px", "& > svg": {fontSize: 22, color: color.red, flex: "none"}}}>
        <WarningRoundedIcon aria-hidden />
        <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
            {title}
          </Box>
          <Box component="span" sx={{fontSize: 13, lineHeight: 1.45, color: color.ink2}}>
            {text}
          </Box>
        </Box>
      </Box>
      <Box sx={{display: "flex", gap: "8px"}}>
        <Box component="button" type="button" onClick={onCancel} disabled={busy} sx={{...small, border: `1.5px solid ${tint.navy[25]}`, background: color.white, color: color.navy}}>
          Odustani
        </Box>
        <Box component="button" type="button" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined} sx={{...small, background: color.red, color: color.white}}>
          {busy && <Spinner size={18} tone="white" />}
          {action}
        </Box>
      </Box>
    </Box>
  );
}
