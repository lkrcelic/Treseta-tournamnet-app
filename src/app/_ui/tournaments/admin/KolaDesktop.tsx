"use client";

import {addKoloAPI, addKoloTableAPI, deleteKoloAPI, makeKoloAPI, publishKoloAPI} from "@/app/_fetchers/tournament";
import {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import {AdminTournament, KoloView} from "@/app/_interfaces/tournament";
import {isByeTeam} from "@/app/_lib/bye";
import {KoloPair} from "@/app/_lib/matching/tournamentPairing";
import {nightLabel} from "@/app/_lib/nights";
import {KOLO_MAX, KoloRemoval, koloRemovalOf, koloRemovalWarns, koloSteps, removesResults, tableWasPlayed} from "@/app/_lib/tournaments";
import {filterTables, TableFilter, tableColumns, TableRow, toTableRows} from "@/app/_lib/ui/tables";
import {toStandingsRows} from "@/app/_lib/ui/standings";
import useElementHeight from "@/app/_hooks/useElementHeight";
import {count, NOUN} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {ConfirmRemove, EditToggle, NewTableButton, PairDialog, RowActions, useTableEdits} from "@/app/league/[leagueId]/daily-standings/ui/RoundEditing";
import {DesktopTableRow, TABLE_ROW_HEIGHT} from "@/app/league/[leagueId]/daily-standings/ui/RoundTables";
import {buttonBase, Card, EmptyState, ErrorNote, IconCircleButton, InfoNote, LiveDot, NARROW_DESKTOP, OutlineButton, PrimaryButton, Segmented, Spinner, StandingsGrid} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import {TableStates} from "./DayAdmin";
import {KoloTimerChip, KoloTimerPanel} from "./KoloTimer";
import React, {useEffect, useId, useState} from "react";

// Upravljanje turnirom · Kola (Claude Design "Turniri admin" C1–C4): one Kolo's tables on the left with the Kolos 1…N
// above them (✓ played, a red dot live, the pencil a draft); on the right what comes next. Kolo 1 is drawn at random
// once sign-ups are closed; every later Kolo is paired by the standings by itself when the one before it is played to
// the end. A draft (Skica) is edited as Skica lige (Uredi parove), made again (Složi ponovo) and published (Objavi
// kolo); a published Kolo's tables are edited as on Dnevni poredak and open the admin scorepad.

type Props = {t: AdminTournament; kolo: number; onKolo: (n: number) => void; onChanged: (t: AdminTournament) => void; reload: () => void};

// The Kolo the tab opens on: the draft, else the one being played, else the last one out, else Kolo 1
export function defaultKolo(t: AdminTournament): number {
  const draft = t.results.kolos.find((k) => !k.published);
  if (draft) return draft.number;
  if (t.live_kolo) return t.live_kolo;
  const out = t.results.kolos.filter((k) => k.published).map((k) => k.number);
  return out.length ? Math.max(...out) : 1;
}

export const STEP_LOOK = {
  played: {label: "Odigrano", ink: color.green, bg: tint.green[12], icon: <CheckRoundedIcon />},
  live: {label: "Uživo", ink: color.red, bg: tint.red[10], icon: <RadioButtonCheckedRoundedIcon />},
  draft: {label: "Skica", ink: color.medal[0], bg: tint.gold[16], icon: <EditRoundedIcon />},
  waiting: {label: "Čeka", ink: color.muted, bg: color.lineFill, icon: null},
} as const;

// A Kolo's tables as table rows, without the teams' photos at the admin's rows (Skica lige has none either), so the
// names fit
export function koloRows(view: KoloView): TableRow[] {
  return toTableRows(view.tables.map((x) => ({...x, team1: {team_name: x.team1.team_name}, team2: {team_name: x.team2.team_name}})));
}

// Obriši kolo for one Kolo of the tournament — any of them, not only the last (null: it can't go, or the tournament
// is cancelled)
export function koloRemoval(t: AdminTournament, n: number): KoloRemoval | null {
  if (t.phase === "cancelled") return null;
  return koloRemovalOf(
    t.rounds,
    n,
    t.results.kolos.map((k) => {
      const rows = koloRows(k);
      // played: the same question the server asks (tableWasPlayed), not the table row's `started`, which reads the
      // wins and so misses a match finished without a winner
      const played = k.tables.some((x) =>
        tableWasPlayed({team1Id: x.team1_id, team2Id: x.team2_id, open: x.open, matches: x.matches.length, ongoing: x.ongoingMatches.length})
      );
      return {number: k.number, published: k.published, played, done: rows.length > 0 && rows.every((r) => r.done)};
    })
  );
}

// What deleting this Kolo does, for its confirmation: what goes with it, and what the tournament is left with
export function koloRemovalText(r: KoloRemoval): string {
  const what = {
    waiting: `Kolo ${r.number} još nije složeno, pa se ništa ne briše. `,
    draft: `Skica Kola ${r.number} se briše. `,
    out: `Stolovi Kola ${r.number} se brišu i igrači ih više ne vide. `,
    live: `Za stolovima Kola ${r.number} se igra: igre koje traju se prekidaju, a svi rezultati tog kola se brišu. Poredak i rejting se računaju ponovo. `,
    played: `Kolo ${r.number} je odigrano: svi njegovi rezultati se brišu, a poredak i rejting se računaju ponovo. `,
  }[r.step];
  // a made Kolo takes the made Kolos after it: they were paired by its results
  const after = r.alsoGo.length
    ? `${r.alsoGo.length === 1 ? `I Kolo ${r.alsoGo[0]} se briše` : `Brišu se i kola ${r.alsoGo.join(", ")}`}, jer su složena po rezultatima ovog. `
    : "";
  // the plan is one Kolo shorter, so whatever was after it keeps its place a number lower
  const shift = r.number <= r.rounds ? "Kola iza njega pomiču se za jedan broj. " : "";
  return `${what}${after}${shift}Turnir će imati ${count(r.rounds, NOUN.kolo)}.${r.ends ? " Sva kola koja ostaju su odigrana, pa je turnir time završen." : ""}`;
}

export const koloRemovalTitle = (r: KoloRemoval) => (removesResults(r) ? `Obrisati Kolo ${r.number} s rezultatima?` : `Obrisati Kolo ${r.number}?`);
export const koloRemovalAction = (r: KoloRemoval) => (removesResults(r) ? "Obriši s rezultatima" : "Obriši kolo");

// Dodaj kolo: up to 20, not for a cancelled tournament
export const canAddKolo = (t: AdminTournament) => t.phase !== "cancelled" && t.rounds < KOLO_MAX;

// The teams a table can seat, in the shape the pair dialog takes
export function tableTeams(t: AdminTournament): LeagueTeam[] {
  return t.entries.map((e) => ({id: e.team_id, name: e.team_name, players: e.players.map((p) => p.username ?? p.name), active: true, conferenceId: null, smokers: 0}));
}

export default function KolaDesktop({t, kolo, onKolo, onChanged, reload}: Props) {
  const router = useTransitionRouter();
  const steps = koloSteps(t.rounds, t.results.kolos.map((k) => ({number: k.number, published: k.published, tables: k.tables.length, done: k.tables.filter((x) => !x.open).length, live: 0})));
  const view = t.results.kolos.find((k) => k.number === kolo) ?? null;
  const step = steps.find((s) => s.number === kolo)?.step ?? "waiting";
  const rows = view ? koloRows(view) : [];
  const [areaRef, areaHeight] = useElementHeight<HTMLDivElement>();
  // one column while every table fits the card's height, as Dnevni poredak; else two
  const twoColumns = tableColumns(rows.length, areaHeight == null ? undefined : Math.floor(areaHeight / TABLE_ROW_HEIGHT)) > 1;
  const [filter, setFilter] = useState<TableFilter>("all");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repeats, setRepeats] = useState<KoloPair[]>([]);
  const edits = useTableEdits(view ? {leagueId: 0, date: t.date, roundNumber: kolo, onChanged: reload, addTable: (a, b) => addKoloTableAPI(t.id, kolo, a, b)} : null);
  const visible = filterTables(rows, filter);
  const done = rows.filter((r) => r.done).length;
  const live = rows.filter((r) => r.live).length;

  useEffect(() => {
    setEditing(false);
    edits.reset();
    edits.setPair(null);
    setFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kolo, view?.published]);

  const run = async (what: string, call: () => Promise<AdminTournament>, then?: (t: AdminTournament) => void) => {
    setBusy(what);
    setError(null);
    try {
      const next = await call();
      onChanged(next);
      then?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije uspjelo.");
    }
    setBusy(null);
  };
  const make = (redo: boolean) =>
    run(
      redo ? "redo" : "make",
      async () => {
        const r = await makeKoloAPI(t.id, redo);
        setRepeats(r.made.repeats);
        return r.tournament;
      },
      (next) => onKolo(defaultKolo(next))
    );
  const publish = () => run("publish", () => publishKoloAPI(t.id, kolo), () => setRepeats([]));
  // Dodaj kolo: one more at the end (a finished tournament's new Kolo is drafted at once, so it opens); Obriši kolo:
  // the Kolo that is open, its results too after the warning
  const removal = koloRemoval(t, kolo);
  const addable = canAddKolo(t);
  const [askDelete, setAskDelete] = useState(false);
  const [full, setFull] = useState(false);
  const add = () =>
    run("add", () => addKoloAPI(t.id, t.rounds + 1), (next) => {
      const draft = next.results.kolos.find((k) => !k.published);
      if (draft && !t.results.kolos.some((k) => !k.published)) onKolo(draft.number);
    });
  const remove = () =>
    removal &&
    run("delete", () => deleteKoloAPI(t.id, removal.number, removesResults(removal)), (next) => {
      setAskDelete(false);
      if (kolo > next.rounds) onKolo(defaultKolo(next));
    });

  const chip = (n: number, s: keyof typeof STEP_LOOK) => {
    const on = n === kolo;
    const look = STEP_LOOK[s];
    // a Kolo still to come is in the row but has nothing to open
    const off = s === "waiting" && !on;
    return (
      <Box
        key={n}
        component="button"
        type="button"
        role="tab"
        aria-selected={on}
        aria-label={`Kolo ${n}, ${look.label.toLowerCase()}`}
        onClick={() => onKolo(n)}
        disabled={off}
        sx={{
          ...buttonBase,
          ...(off && {cursor: "default", opacity: 0.55}),
          flex: "none",
          minWidth: 44,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          px: "10px",
          borderRadius: "10px",
          background: on ? color.navy : "transparent",
          color: on ? color.white : s === "waiting" ? color.faint : color.ink,
          fontSize: 14,
          fontWeight: 700,
          boxShadow: on ? shadow.pill : "none",
          "& svg": {fontSize: 16, color: on ? color.cream : s === "played" ? color.green : color.medal[0]},
        }}
      >
        {s === "played" && <CheckRoundedIcon aria-hidden />}
        {s === "draft" && <EditRoundedIcon aria-hidden />}
        {n}
        {s === "live" && <LiveDot size={7} />}
      </Box>
    );
  };

  const look = STEP_LOOK[step];
  const statusTag = (
    <Box component="span" sx={{flex: "none", height: 30, display: "flex", alignItems: "center", gap: "6px", px: "10px", borderRadius: "10px", background: look.bg, color: look.ink, fontSize: 13, fontWeight: 700, "& svg": {fontSize: 17}}}>
      {look.icon}
      {view && view.published && step !== "played" ? (live > 0 ? "Uživo" : "Objavljeno") : look.label}
    </Box>
  );

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 330px"}, gap: "20px"}}>
      <Card component="section" aria-label={`Kolo ${kolo}`} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px", p: "16px 18px"}}>
          <Box sx={{flex: "1 0 150px", minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
              {nightLabel(t.date)} · {t.name}
            </Box>
            <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05}}>
              Kolo {kolo} od {t.rounds}
            </Box>
          </Box>
          <Box role="tablist" aria-label="Kola turnira" sx={{flex: "0 1 auto", minWidth: 0, display: "flex", gap: "4px", p: "4px", borderRadius: "14px", background: color.lineFill, overflowX: "auto", scrollbarWidth: "none"}}>
            {steps.map((s) => chip(s.number, s.step))}
          </Box>
          {(addable || removal) && (
            <Box sx={{flex: "none", display: "flex", gap: "6px"}}>
              {addable && (
                <IconCircleButton label="Dodaj kolo" size={40} onClick={add} disabled={busy != null} sx={{borderRadius: "12px", boxShadow: "none", background: color.lineFill, "& svg": {fontSize: 22}}}>
                  {busy === "add" ? <Spinner size={18} /> : <AddRoundedIcon />}
                </IconCircleButton>
              )}
              {removal && (
                <IconCircleButton
                  label={`Obriši Kolo ${removal.number}`}
                  size={40}
                  onClick={() => {
                    setError(null);
                    setAskDelete(true);
                  }}
                  disabled={busy != null}
                  sx={{borderRadius: "12px", boxShadow: "none", background: color.lineFill, color: color.red, "& svg": {fontSize: 20}}}
                >
                  <DeleteRoundedIcon />
                </IconCircleButton>
              )}
            </Box>
          )}
        </Box>
        {view && (
          <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "10px", p: "0 18px 14px", flexWrap: "wrap"}}>
            {statusTag}
            {/* the side card has the big timer (Kolo N traje); a finished tournament's side card hasn't, so it's here */}
            {t.phase === "finished" && <KoloTimerChip kolo={view} height={30} fontSize={13} />}
            <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 14, color: color.muted, whiteSpace: "nowrap"}}>
              {count(rows.filter((r) => !r.bye).length, NOUN.stol)}
              {rows.some((r) => r.bye) ? " + slobodna runda" : ""}
            </Box>
            {view.published && !editing && (
              <Segmented<TableFilter>
                items={[
                  {key: "all", label: "Svi", count: rows.length},
                  {key: "live", label: "Uživo", count: live, alert: true},
                  {key: "done", label: "Gotovo", count: done},
                ]}
                value={filter}
                onChange={setFilter}
                label="Filtriraj stolove"
                variant="panel"
                size={38}
                asTabs={false}
              />
            )}
            {editing && <NewTableButton onClick={() => edits.setPair({kind: "new", tableNumber: rows.reduce((m, r) => Math.max(m, r.table), 0) + 1})} />}
            {/* the Kolo over the whole screen, for the screen at the club: the tables and the standings beside them */}
            {view.published && (
              <IconCircleButton label="Preko cijelog ekrana" size={38} onClick={() => setFull(true)} sx={{borderRadius: "12px", boxShadow: "none", background: color.lineFill, "& svg": {fontSize: 22}}}>
                <FullscreenRoundedIcon />
              </IconCircleButton>
            )}
            {t.phase !== "finished" && (
              <EditToggle
                editing={editing}
                onClick={() => {
                  setEditing((e) => !e);
                  edits.reset();
                }}
              />
            )}
          </Box>
        )}
        {(edits.actionError || error) && <ErrorNote sx={{m: "0 18px 14px"}}>{edits.actionError ?? error}</ErrorNote>}
        <Box ref={areaRef} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
        {!view ? (
          <EmptyState>
            {kolo === 1
              ? "Kolo 1 se slaže nasumično kad zatvoriš prijave."
              : `Kolo ${kolo} se slaže po poretku kad svi stolovi Kola ${kolo - 1} završe.`}
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>Nema stolova za ovaj filter.</EmptyState>
        ) : (
          <Box
            component="ul"
            aria-label={`Kolo ${kolo}: ${count(rows.length, NOUN.stol)}`}
            // two columns of tables, a hairline between them; under 1280 px wide one, so the names fit
            sx={{
              listStyle: "none",
              m: 0,
              p: 0,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: twoColumns ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
              alignContent: "start",
              borderTop: `1px solid ${color.line}`,
              ...(twoColumns && {"& > li:nth-of-type(odd)": {borderRight: `1px solid ${color.divider}`}}),
              [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr)", "& > li:nth-of-type(odd)": {borderRight: "none"}},
            }}
          >
            {visible.map((row) => (
              <DesktopTableRow
                key={row.id}
                t={row}
                dense={false}
                draft={!view.published}
                href={view.published && !editing && !row.bye ? `/turniri/${t.id}/stol/${row.id}` : undefined}
                actions={
                  editing ? (
                    <RowActions
                      t={row}
                      onEdit={() => edits.setPair({kind: "edit", row})}
                      onRemove={() => {
                        edits.setConfirmId(row.id);
                        edits.setActionError(null);
                      }}
                    />
                  ) : undefined
                }
                onOpen={editing ? () => edits.setPair({kind: "edit", row}) : undefined}
                fresh={editing && row.table === edits.freshTable}
                confirm={
                  editing && edits.confirmId === row.id ? (
                    <ConfirmRemove t={row} busy={edits.removing} onCancel={() => edits.setConfirmId(null)} onConfirm={() => edits.remove(row.id)} />
                  ) : undefined
                }
              />
            ))}
          </Box>
        )}
        </Box>
        {full && view && <KoloFullscreen t={t} kolo={kolo} rows={rows} live={live} done={done} onClose={() => setFull(false)} />}
        {askDelete && removal && (
          <DeleteKoloDialog removal={removal} busy={busy === "delete"} error={error} onClose={() => setAskDelete(false)} onConfirm={remove} />
        )}
        {editing && edits.pair && (
          <PairDialog
            target={edits.pair}
            rows={rows}
            teams={tableTeams(t)}
            roundLabel={`Kolo ${kolo}`}
            onClose={() => edits.setPair(null)}
            onSave={edits.savePair}
            byeWins={t.matches_per_round}
          />
        )}
      </Card>
      <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        <SideCard t={t} kolo={kolo} view={view} step={step} done={done} tables={rows.length} busy={busy} repeats={repeats} onMake={make} onPublish={publish} onPlayers={() => router.push(`/turniri/${t.id}/poredak`)} />
        {view && view.published && <TableStates t={t} kolo={view} onChanged={onChanged} />}
        <InfoNote icon={<InfoRoundedIcon />}>
          {kolo === 1 && step !== "played" && step !== "live"
            ? "Od drugog kola parovi se slažu po poretku (švicarski sustav): ekipe sličnih bodova igraju jedna protiv druge i ne ponavljaju protivnika. Slobodna runda radi isto kao u ligi: kod neparnog broja ekipa jedna ekipa nema protivnika i dobiva pobjedu."
            : "Dodir na stol otvara admin scorepad kao u ligi: Ispravi korak po korak, Ručni unos, Obriši igru."}
        </InfoNote>
      </Box>
    </Box>
  );
}

function SideCard({
  t,
  kolo,
  view,
  step,
  done,
  tables,
  busy,
  repeats,
  onMake,
  onPublish,
  onPlayers,
}: {
  t: AdminTournament;
  kolo: number;
  view: KoloView | null;
  step: keyof typeof STEP_LOOK;
  done: number;
  tables: number;
  busy: string | null;
  repeats: KoloPair[];
  onMake: (redo: boolean) => void;
  onPublish: () => void;
  onPlayers: () => void;
}) {
  const card = {flex: "none", borderRadius: "24px", p: "22px", display: "flex", flexDirection: "column", gap: "12px"} as const;
  const title = (text: string) => (
    <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.1}}>
      {text}
    </Box>
  );
  const text = (s: React.ReactNode) => (
    <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink}}>
      {s}
    </Box>
  );
  const names = new Map(t.entries.map((e) => [e.team_id, e.team_name]));

  if (t.phase === "finished") {
    return (
      <Card component="section" sx={{...card, boxShadow: `${shadow.card}, inset 0 0 0 2px ${tint.green[35]}`}}>
        <Box sx={{display: "flex", alignItems: "center", gap: "8px", color: color.green, fontWeight: 700, "& svg": {fontSize: 22}}}>
          <EmojiEventsRoundedIcon aria-hidden />
          Turnir je završen
        </Box>
        {title(t.winner ? `Pobjednici: ${t.winner.team_name}` : "Sva kola su odigrana")}
        {t.winner && text(t.winner.players.join(" · "))}
        {text(`Nema otvorenih kola · ${t.completed_kolos} od ${t.rounds} odigrano. Turnir se sam završava kad nema otvorenih kola; nastavlja se samo ako dodaš novo kolo (+ pokraj kola).`)}
        <OutlineButton height={50} onClick={onPlayers} sx={{fontSize: 15, borderWidth: "1.5px"}}>
          <OpenInNewRoundedIcon sx={{fontSize: 20}} />
          Prikaz za igrače
        </OutlineButton>
      </Card>
    );
  }

  if (step === "draft") {
    return (
      <Box component="section" sx={{...card, background: color.cream}}>
        {title(`Skica Kola ${kolo}`)}
        {text(kolo === 1 ? "Prvo kolo je složeno nasumično. Igrači ne vide stolove dok ne objaviš kolo." : `Parovi su složeni po poretku nakon ${kolo - 1} kola. Provjeri pa objavi.`)}
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
        <PrimaryButton icon={<VisibilityRoundedIcon />} loading={busy === "publish"} disabled={busy != null || t.stale_draft} onClick={onPublish}>
          Objavi kolo
        </PrimaryButton>
        <OutlineButton height={50} onClick={() => onMake(true)} disabled={busy != null} sx={{fontSize: 15, borderWidth: "1.5px", background: color.white}}>
          <RefreshRoundedIcon sx={{fontSize: 20}} />
          Složi ponovo
        </OutlineButton>
      </Box>
    );
  }

  const next = t.next_kolo;
  if (step === "live" || step === "played") {
    const nextNumber = kolo + 1;
    const canMake = next != null && next.number === nextNumber && next.ready;
    return (
      <Card component="section" sx={card}>
        {title(step === "live" ? `Kolo ${kolo} traje` : `Kolo ${kolo} je odigrano`)}
        {view && <KoloTimerPanel kolo={view} />}
        <Box sx={{display: "flex", justifyContent: "space-between", fontSize: 14, color: color.ink2}}>
          <span>Gotovo</span>
          <Box component="span" sx={{fontWeight: 700, color: color.ink, fontVariantNumeric: "tabular-nums"}}>
            {done} / {count(tables, NOUN.stol)}
          </Box>
        </Box>
        <Box aria-hidden sx={{height: 6, borderRadius: "3px", background: color.lineFill, overflow: "hidden"}}>
          <Box sx={{height: "100%", width: `${tables ? (done / tables) * 100 : 0}%`, background: color.navy, borderRadius: "3px"}} />
        </Box>
        {nextNumber <= t.rounds && text(step === "live" ? `Kad svi stolovi završe, aplikacija složi skicu Kola ${nextNumber} po poretku.` : `Skica Kola ${nextNumber} slaže se po poretku.`)}
        {nextNumber <= t.rounds && (
          <PrimaryButton icon={<AutoAwesomeRoundedIcon />} loading={busy === "make"} disabled={!canMake || busy != null} onClick={() => onMake(false)}>
            Složi Kolo {nextNumber}
          </PrimaryButton>
        )}
      </Card>
    );
  }

  // a Kolo not made yet
  const isNext = next != null && next.number === kolo;
  return (
    <Card component="section" sx={card}>
      {title(`Kolo ${kolo}`)}
      {text(isNext ? (next!.reason ?? (kolo === 1 ? "Prijave su zatvorene: Kolo 1 se slaže nasumično." : "Prethodno kolo je odigrano.")) : `Kolo ${kolo} dolazi nakon Kola ${kolo - 1}.`)}
      {isNext && (
        <PrimaryButton icon={<AutoAwesomeRoundedIcon />} loading={busy === "make"} disabled={!next!.ready || busy != null} onClick={() => onMake(false)}>
          Složi Kolo {kolo}
        </PrimaryButton>
      )}
    </Card>
  );
}

// Obriši kolo on the computer: what goes (a warning when results go too), Odustani and the red action
function DeleteKoloDialog({removal, busy, error, onClose, onConfirm}: {removal: KoloRemoval; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void}) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 520, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.15}}>
        {koloRemovalTitle(removal)}
      </Box>
      <Box sx={{display: "flex", gap: "12px", alignItems: "flex-start", p: "14px", borderRadius: "16px", background: tint.red[8], "& > svg": {fontSize: 26, color: color.red, flex: "none"}}}>
        {koloRemovalWarns(removal) ? <WarningRoundedIcon aria-hidden /> : <DeleteRoundedIcon aria-hidden />}
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink}}>
          {koloRemovalText(removal)}
        </Box>
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "flex", gap: "10px"}}>
        <OutlineButton height={52} onClick={onClose} disabled={busy} sx={{flex: 1, fontSize: 16, border: `1.5px solid ${tint.navy[25]}`}}>
          Odustani
        </OutlineButton>
        <PrimaryButton height={52} bg={color.red} onClick={onConfirm} loading={busy} sx={{flex: 1, fontSize: 16, borderRadius: "16px", boxShadow: "none"}}>
          {koloRemovalAction(removal)}
        </PrimaryButton>
      </Box>
    </Dialog>
  );
}

// Kolo preko cijelog ekrana (the computer only): the Kolo's tables on two thirds of the screen and the tournament's
// standings on the last third, for the screen at the club. Nothing is edited here — the same rows (DesktopTableRow)
// and the same standings table (StandingsGrid) as the tabs Kola and Poredak, only bigger and without the shell. The
// page under it keeps refreshing every 15 s while the tournament is played, so the view follows the games by itself.
export function KoloFullscreen({t, kolo, rows, live, done, onClose}: {t: AdminTournament; kolo: number; rows: TableRow[]; live: number; done: number; onClose: () => void}) {
  const [areaRef, areaHeight] = useElementHeight<HTMLDivElement>();
  const twoColumns = tableColumns(rows.length, areaHeight == null ? undefined : Math.floor(areaHeight / TABLE_ROW_HEIGHT)) > 1;
  const standings = toStandingsRows(t.results.standings);
  const titleId = useId();
  const view = t.results.kolos.find((k) => k.number === kolo) ?? null;

  // the browser's own full screen too, so the tabs and the address bar go away; it needs the click that opened the
  // view, and a browser that refuses it just shows the view over the page
  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.({navigationUI: "hide"}).catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const headCard = {flex: "none", display: "flex", alignItems: "center", gap: "10px", p: "14px 20px"} as const;
  return (
    <Dialog open fullScreen onClose={onClose} aria-labelledby={titleId} PaperProps={{sx: {background: color.cream, display: "flex", flexDirection: "column"}}}>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "16px", p: "18px 24px 14px"}}>
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 14, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
            {nightLabel(t.date)} · {t.name}
          </Box>
          <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 38, fontWeight: 800, lineHeight: 1.05}}>
            Kolo {kolo} od {t.rounds}
          </Box>
        </Box>
        {live > 0 && (
          <Box component="span" sx={{flex: "none", height: 38, display: "flex", alignItems: "center", gap: "8px", px: "14px", borderRadius: "12px", background: tint.red[10], color: color.red, fontSize: 16, fontWeight: 700}}>
            <LiveDot size={9} />
            {count(live, NOUN.stol)} uživo
          </Box>
        )}
        {view && <KoloTimerChip kolo={view} height={38} fontSize={18} sx={{px: "14px", borderRadius: "12px", ...(view.ended_at == null && {background: color.navy, color: color.cream})}} />}
        <Box component="span" sx={{flex: "none", fontSize: 16, color: color.ink2}}>
          Gotovo {done} od {rows.length}
        </Box>
        <IconCircleButton label="Zatvori cijeli ekran" size={46} onClick={onClose} sx={{borderRadius: "14px", boxShadow: "none", background: color.white, "& svg": {fontSize: 26}}}>
          <CloseRoundedIcon />
        </IconCircleButton>
      </Box>
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: "20px", p: "0 24px 24px"}}>
        <Card component="section" aria-label={`Kolo ${kolo}`} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          <Box ref={areaRef} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
            {rows.length === 0 ? (
              <EmptyState>Ovo kolo nema stolova.</EmptyState>
            ) : (
              <Box
                component="ul"
                aria-label={`Kolo ${kolo}: ${count(rows.length, NOUN.stol)}`}
                sx={{
                  listStyle: "none",
                  m: 0,
                  p: 0,
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: twoColumns ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
                  alignContent: "start",
                  ...(twoColumns && {"& > li:nth-of-type(odd)": {borderRight: `1px solid ${color.divider}`}}),
                  [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr)", "& > li:nth-of-type(odd)": {borderRight: "none"}},
                }}
              >
                {rows.map((row) => (
                  <DesktopTableRow key={row.id} t={row} dense={false} />
                ))}
              </Box>
            )}
          </Box>
        </Card>
        <Card component="section" aria-label="Poredak" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          <Box sx={headCard}>
            <Box component="h3" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
              Poredak
            </Box>
            <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
              {t.completed_kolos === 0 ? "Prije prvog kola" : `Nakon ${t.completed_kolos} od ${t.rounds} kola`}
            </Box>
          </Box>
          {standings.length === 0 ? (
            <EmptyState>Poredak će biti ovdje kad počne prvo kolo.</EmptyState>
          ) : (
            <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
              {/* a third of the screen is narrow for the names, so NER goes out while nobody has a draw */}
              <StandingsGrid rows={standings} dense columns={standings.some((r) => r.draws > 0) ? ["wins", "draws", "losses"] : ["wins", "losses"]} caption={`Poredak turnira ${t.name}`} />
            </Box>
          )}
        </Card>
      </Box>
    </Dialog>
  );
}
