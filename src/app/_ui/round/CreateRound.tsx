"use client";

import {createMultipleRoundsAPI, RepeatMatchupsError} from "@/app/_fetchers/round/createMultipleRounds";
import {getCreateRoundDraftAPI, saveCreateRoundDraftAPI} from "@/app/_fetchers/round/createRoundDraft";
import useLeagueTeams, {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import {updateCachedLeague} from "@/app/_hooks/useLeagues";
import {CreateRoundDraft, isPlaying, MAX_ROUNDS, MAX_WINDOW, switchTeams} from "@/app/_lib/createRoundDraft";
import {onBeforeLogout} from "@/app/_utils/beforeLogout";
import {smokingSummary} from "@/app/_lib/ui/smoking";
import {count, matchesQuery, NOUN, plural} from "@/app/_lib/ui/text";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, EmptyState, ErrorNote, LoadingRows, OutlineButton, PrimaryButton, SearchInput, SectionLabel, SolidButton, Stepper, SwitchRow, SwitchTrack, TeamLabel} from "@/app/_ui/sp";
import useConferences from "@/app/_hooks/useConferences";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import React, {useEffect, useId, useMemo, useRef, useState} from "react";
import LeagueNotes from "./LeagueNotes";
import {SmokingPlanOverlay, SmokingTablesCard} from "./SmokingTables";

// the smoking tables picked when the switch goes on and the league remembers none (the design's default)
const FIRST_SMOKING_TABLES = [1, 2];
const SAVE_DELAY_MS = 500;

// the league's teams, loaded once by Upravljanje ligom for its Ekipe and Novo kolo views, so a team added on Ekipe is here
// at once
export type CreateRoundTeams = Pick<ReturnType<typeof useLeagueTeams>, "teams" | "error" | "loading" | "reload">;

// a save of Novo kolo still on its way, per league: Novo kolo opened again waits for it, so it doesn't show what was
// there before it
const savesOnTheWay = new Map<number, Promise<void>>();

// Novo kolo for one league: the options, the smoking tables, the teams present tonight and the create action, laid
// out by Upravljanje ligom's "Novo kolo" view (desktop only). defaultSmokingTables: the ones of the league's last round
// creation (the switch starts on with them). The rounds are created as drafts; onCreated gets their night, and
// Upravljanje ligom opens Skica, where the admin approves and publishes them.
// What the admin sets up here is saved for them on the server for tonight (a reload, a trip to make a new team or
// another computer keeps it); until they change something it is the league's defaults.
function useCreateRound(leagueId: number, teamsData: CreateRoundTeams, onCreated: (date: string) => void, defaultRounds?: number, defaultSmokingTables?: number[]) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // the pairs that would meet twice today, while the admin decides whether to create the rounds anyway
  const [repeats, setRepeats] = useState<[string, string][] | null>(null);
  // pair every conference on its own, so teams only meet teams of their conference; off until the admin turns it on
  const [withinConferences, setWithinConferences] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  // null: nothing changed tonight
  const [draft, setDraft] = useState<CreateRoundDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<"loading" | "loadError" | "ready">("loading");
  const [draftNonce, setDraftNonce] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const unsaved = useRef<CreateRoundDraft | null>(null);

  const {teams, error: teamsError, loading, reload} = teamsData;
  const inactive = useMemo(() => new Set((teams ?? []).filter((t) => !t.active).map((t) => t.id)), [teams]);
  // the teams' conference dots in the list
  const conferences = useConferences(leagueId);
  const hasConferences = conferences.conferences.length > 0;

  useEffect(() => {
    let cancelled = false;
    setDraftStatus("loading");
    (savesOnTheWay.get(leagueId) ?? Promise.resolve())
      .catch(() => {})
      .then(() => getCreateRoundDraftAPI(leagueId))
      .then((saved) => {
        if (cancelled) return;
        setDraft(saved);
        setDraftStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setDraftStatus("loadError");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, draftNonce]);

  // "Samo unutar konferencija" starts off for every league
  useEffect(() => {
    setWithinConferences(false);
  }, [leagueId]);

  const save = (value: CreateRoundDraft, keepalive = false) => {
    unsaved.current = null;
    // one after another, so an older choice never lands over a newer one; a save while the page closes can't wait
    const previous = savesOnTheWay.get(leagueId) ?? Promise.resolve();
    const sending = keepalive ? saveCreateRoundDraftAPI(leagueId, value, true) : previous.catch(() => {}).then(() => saveCreateRoundDraftAPI(leagueId, value));
    savesOnTheWay.set(leagueId, sending);
    sending
      // a newer change may be waiting; its own save says how it went
      .then(
        () => unsaved.current == null && setSaveError(false),
        () => unsaved.current == null && setSaveError(true)
      )
      .finally(() => {
        if (savesOnTheWay.get(leagueId) === sending) savesOnTheWay.delete(leagueId);
      });
  };

  // leaving Novo kolo (another view, another page, or closing it) sends a change that is still waiting; logging out
  // waits for it, since it can't be saved once the session is gone
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(timer.current);
      if (unsaved.current) save(unsaved.current, true);
    };
    const offLogout = onBeforeLogout(async () => {
      window.clearTimeout(timer.current);
      if (unsaved.current) save(unsaved.current);
      await savesOnTheWay.get(leagueId);
    });
    window.addEventListener("pagehide", flush);
    return () => {
      offLogout();
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // Rounds starts at the league's rounds per night, and the smoking tables as the league's last round creation left them
  const remembered = defaultSmokingTables ?? [];
  const rounds = draft?.rounds ?? (defaultRounds ? Math.min(MAX_ROUNDS, defaultRounds) : 4);
  const windowSize = draft?.window_size ?? 8;
  const smokingOn = draft?.smoking_on ?? remembered.length > 0;
  const smokingPicked = draft?.smoking_tables ?? (remembered.length ? remembered : FIRST_SMOKING_TABLES);
  const sittingOut = useMemo(() => (draft ? new Set(draft.sitting_out) : null), [draft]);

  // the first change takes who sits out now, so the teams' active switches on Ekipe don't move them any more
  const change = (patch: Partial<CreateRoundDraft>) => {
    const next: CreateRoundDraft = {
      rounds,
      window_size: windowSize,
      smoking_on: smokingOn,
      smoking_tables: smokingPicked,
      sitting_out: draft ? draft.sitting_out : switchTeams(teams ?? [], null, [], true),
      ...patch,
    };
    setDraft(next);
    unsaved.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(next), SAVE_DELAY_MS);
  };
  const retrySave = () => {
    window.clearTimeout(timer.current);
    if (draft) save(draft);
  };

  // until a change the active teams play; an inactive team (one that stopped coming) can still be switched on for tonight
  const isOn = (t: LeagueTeam) => isPlaying(t, sittingOut);
  const visible = useMemo(() => (teams ?? []).filter((t) => matchesQuery(t.name, query)), [teams, query]);
  // "Označi sve" is about the active teams on the list (as in the design): an inactive team is switched on only by its
  // own switch, so one click can't pair the teams that stopped coming
  const activeVisible = visible.filter((t) => !inactive.has(t.id));
  const allOn = activeVisible.length > 0 && activeVisible.every(isOn);
  const selected = (teams ?? []).filter(isOn);
  const playing = selected.length;
  // a table per two teams; picks above tonight's number of tables wait for a bigger night
  const tableCount = Math.floor(playing / 2);
  const smokingTables = smokingPicked.filter((t) => t <= tableCount).sort((a, b) => a - b);
  const smokers = selected.reduce((sum, t) => sum + t.smokers, 0);
  const smokingTeams = selected.filter((t) => t.smokers > 0).length;

  const toggle = (id: number) => {
    const team = (teams ?? []).find((t) => t.id === id);
    if (team) change({sitting_out: switchTeams(teams ?? [], sittingOut, [id], !isOn(team))});
  };
  const toggleAll = () =>
    change({
      sitting_out: switchTeams(
        teams ?? [],
        sittingOut,
        activeVisible.map((t) => t.id),
        !allOn
      ),
    });

  const create = async ({window = windowSize, allowRepeats = false}: {window?: number; allowRepeats?: boolean} = {}) => {
    if (leagueId == null || playing < 2 || creating) return;
    setCreating(true);
    setCreateError(null);
    setRepeats(null);
    try {
      const tables = smokingOn ? smokingTables : [];
      const {date} = await createMultipleRoundsAPI(leagueId, selected.map((t) => t.id), rounds, window, allowRepeats, tables, hasConferences && withinConferences);
      // the next Create Round in this session starts with them too
      updateCachedLeague(leagueId, {smokingTables: tables});
      setCreating(false);
      onCreated(date);
    } catch (e) {
      if (e instanceof RepeatMatchupsError) setRepeats(e.repeats);
      else setCreateError(e instanceof Error ? e.message : "Kolo nije moguće napraviti.");
      setCreating(false);
    }
  };
  // a bigger window gives every team more possible opponents; once one window holds every team it can't grow further
  const expandedWindow = Math.min(MAX_WINDOW, windowSize + 2);
  const canExpand = windowSize < playing && windowSize < MAX_WINDOW;
  const expandWindow = () => {
    change({window_size: expandedWindow});
    create({window: expandedWindow});
  };
  const repeatsDialog = repeats && (
    <RepeatsDialog
      repeats={repeats}
      windowSize={windowSize}
      expandedWindow={canExpand ? expandedWindow : null}
      onContinue={() => create({allowRepeats: true})}
      onExpand={expandWindow}
      onClose={() => setRepeats(null)}
    />
  );

  const steppers = (
    <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
      <Stepper
        label="Kola"
        value={rounds}
        onInc={() => change({rounds: Math.min(MAX_ROUNDS, rounds + 1)})}
        onDec={() => change({rounds: Math.max(1, rounds - 1)})}
        canInc={rounds < MAX_ROUNDS}
        canDec={rounds > 1}
      />
      {/* the pairing needs an even window */}
      <Stepper
        label="Prozor"
        value={windowSize}
        onInc={() => change({window_size: Math.min(MAX_WINDOW, windowSize + 2)})}
        onDec={() => change({window_size: Math.max(2, windowSize - 2)})}
        canInc={windowSize < MAX_WINDOW}
        canDec={windowSize > 2}
      />
      {hasConferences && (
        <SwitchRow
          checked={withinConferences}
          onChange={setWithinConferences}
          sx={{gridColumn: "1 / -1", minHeight: 60, p: "10px 10px 10px 14px", borderRadius: "20px", background: color.white, boxShadow: shadow.card}}
        >
          <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
            <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
              Samo unutar konferencija
            </Box>
            <Box component="span" sx={{fontSize: 12, fontWeight: 500, color: color.muted}}>
              Ekipe igraju samo s ekipama svoje konferencije
            </Box>
          </Box>
        </SwitchRow>
      )}
    </Box>
  );

  const toggleSmokingTable = (n: number) => change({smoking_tables: smokingPicked.includes(n) ? smokingPicked.filter((t) => t !== n) : [...smokingPicked, n]});
  const smokingCard = (
    <SmokingTablesCard
      on={smokingOn}
      onToggle={() => {
        change({smoking_on: !smokingOn});
        setPlanOpen(false);
      }}
      tables={smokingTables}
      tableCount={tableCount}
      onToggleTable={toggleSmokingTable}
      summary={smokingSummary(smokingOn, smokingTables, smokers, smokingTeams)}
      onOpenPlan={() => setPlanOpen(true)}
    />
  );

  const showPlan = smokingOn && planOpen;
  const createButton = (
    // its shadow would show below the plan, which covers only the view
    <PrimaryButton onClick={() => create()} disabled={playing < 2} loading={creating} sx={showPlan ? {boxShadow: "none"} : undefined}>
      {creating ? "Kreiram kolo…" : `Kreiraj kolo · ${count(playing, NOUN.ekipa)}`}
    </PrimaryButton>
  );

  // nothing can be changed before the teams and the admin's saved choice are here: the first change takes who sits out
  const blocked = teamsError ? (
    <ErrorNote onRetry={reload} sx={{m: "12px"}}>
      {teamsError}
    </ErrorNote>
  ) : draftStatus === "loadError" ? (
    <ErrorNote onRetry={() => setDraftNonce((n) => n + 1)} sx={{m: "12px"}}>
      Odabir za novo kolo se nije učitao.
    </ErrorNote>
  ) : loading || draftStatus === "loading" ? (
    <LoadingRows rows={8} height={56} />
  ) : null;

  const teamState = visible.length === 0 ? (
    <EmptyState>{teams?.length ? "Nijedna ekipa ne odgovara pretrazi." : "Ova liga još nema ekipa."}</EmptyState>
  ) : null;

  return {
    teams,
    visible,
    inactive,
    isOn,
    toggle,
    toggleAll,
    allOn,
    canToggleAll: activeVisible.length > 0,
    query,
    setQuery,
    createError,
    saveError: saveError && <ErrorNote onRetry={retrySave}>Odabir nije spremljen.</ErrorNote>,
    blocked,
    steppers,
    smokingCard,
    planOpen: showPlan,
    closePlan: () => setPlanOpen(false),
    createButton,
    repeatsDialog,
    teamState,
    conferenceOf: conferences.of,
  };
}

// Why a team sits out: "inactive" teams are off because Upravljanje ligom marks them inactive, "off" ones were switched
// off here
type OutReason = "inactive" | "off";
const OUT_LABEL: Record<OutReason, string> = {inactive: "Neaktivna", off: "Isključena"};
const OUT_HINT: Record<OutReason, string> = {
  inactive: "Neaktivna u Upravljanju ligom · klikni da je dodaš za večeras",
  off: "Klikni za vraćanje",
};

function InactiveBadge() {
  return (
    <Box
      component="span"
      sx={{height: 22, px: "8px", borderRadius: "11px", background: color.paper, color: color.muted, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", flex: "none"}}
    >
      {OUT_LABEL.inactive}
    </Box>
  );
}

// Upravljanje ligom (desktop) · Novo kolo: options, the smoking tables, the league's notes and the create action on the
// left; who sits out and every team's switch on the right. The smoking plan opens over both.
export function CreateRoundView({
  leagueId,
  teams,
  onCreated,
  defaultRounds,
  defaultSmokingTables,
}: {
  leagueId: number;
  teams: CreateRoundTeams;
  // the rounds are drafts on this night (YYYY-MM-DD)
  onCreated: (date: string) => void;
  defaultRounds?: number;
  defaultSmokingTables?: number[];
}) {
  const cr = useCreateRound(leagueId, teams, onCreated, defaultRounds, defaultSmokingTables);
  if (cr.blocked) {
    return (
      <Card component="section" aria-label="Novo kolo" sx={{flex: 1, minHeight: 0, overflow: "hidden", borderRadius: "24px"}}>
        {cr.blocked}
      </Card>
    );
  }
  // under the plan the view can't be reached by Tab or a screen reader (React 18 has no inert prop, hence the spread)
  const hidden = cr.planOpen ? ({inert: ""} as object) : {};
  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: "20px", position: "relative"}}>
      {cr.planOpen && <SmokingPlanOverlay leagueId={leagueId} onClose={cr.closePlan} />}
      <Box {...hidden} sx={{minHeight: 0, display: "flex", flexDirection: "column", gap: "16px"}}>
        {/* the options scroll and the create action stays in view (a big league has a row of table chips per 8 tables) */}
        <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto"}}>
          <Box component="section" aria-labelledby="cr-options" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
            <SectionLabel id="cr-options">Postavke</SectionLabel>
            {cr.steppers}
          </Box>
          {cr.smokingCard}
          <LeagueNotes key={leagueId} leagueId={leagueId} />
        </Box>
        <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
          {cr.saveError}
          {cr.createError && <ErrorNote>{cr.createError}</ErrorNote>}
          {cr.createButton}
        </Box>
      </Box>
      {cr.repeatsDialog}
      <Card {...hidden} component="section" aria-label="Prisutne ekipe" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        {!cr.teamState && cr.teams && <NotInRound teams={cr.teams} isOn={cr.isOn} inactive={cr.inactive} onAddBack={cr.toggle} />}
        <Box sx={{display: "flex", alignItems: "center", gap: "12px", p: "14px", borderBottom: `1px solid ${tint.navy[10]}`}}>
          <SearchInput soft height={48} placeholder="Traži" aria-label="Traži ekipu" value={cr.query} onChange={(e) => cr.setQuery(e.target.value)} sx={{flex: 1}} />
          <Box
            component="button"
            type="button"
            role="switch"
            aria-checked={cr.allOn}
            onClick={cr.toggleAll}
            disabled={!cr.canToggleAll}
            sx={{...buttonBase, height: 48, display: "flex", alignItems: "center", gap: "12px", pl: "14px", pr: "8px", borderRadius: "14px", background: color.paper2, fontSize: 15, fontWeight: 700, color: color.ink}}
          >
            <span>{cr.query ? "Označi sve filtrirane" : "Označi sve"}</span>
            <SwitchTrack on={cr.allOn} />
          </Box>
        </Box>
        {cr.teamState ?? (
          <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gridAutoRows: "56px", columnGap: "24px", p: "4px 14px"}}>
            {cr.visible.map((t) => (
              <SwitchRow key={t.id} checked={cr.isOn(t)} onChange={() => cr.toggle(t.id)} sx={{px: "4px", minHeight: 56}}>
                <TeamLabel name={t.name} conference={cr.conferenceOf(t.id)} />
                {cr.inactive.has(t.id) && <InactiveBadge />}
              </SwitchRow>
            ))}
          </Box>
        )}
      </Card>
    </Box>
  );
}

// The rounds can't be made without some teams meeting twice tonight (with each other earlier today, or in two of the
// new rounds). The admin creates them anyway or tries again with a bigger window, which gives everyone more opponents.
function RepeatsDialog({
  repeats,
  windowSize,
  expandedWindow,
  onContinue,
  onExpand,
  onClose,
}: {
  repeats: [string, string][];
  windowSize: number;
  // null when the window already holds every team
  expandedWindow: number | null;
  onContinue: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 480, maxWidth: "calc(100% - 32px)", m: "16px", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        <Box aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "14px", background: tint.red[10], color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
          <WarningRoundedIcon />
        </Box>
        <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.1}}>
          Neke ekipe bi se večeras srele dvaput
        </Box>
      </Box>
      <Box component="ul" aria-label="Ekipe koje bi se večeras srele dvaput" sx={{listStyle: "none", m: 0, p: "4px 14px", borderRadius: "16px", background: color.paper, maxHeight: 220, overflowY: "auto"}}>
        {repeats.map(([a, b], i) => (
          <Box
            component="li"
            key={`${a}-${b}-${i}`}
            sx={{minHeight: 40, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: "8px", fontSize: 15, fontWeight: 600, borderBottom: i < repeats.length - 1 ? `1px solid ${tint.navy[10]}` : "none", "& > span:not([aria-hidden])": {overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}}
          >
            <span>{a}</span>
            <Box component="span" aria-hidden sx={{fontSize: 13, color: color.faint}}>
              vs
            </Box>
            <Box component="span" sx={{textAlign: "right"}}>
              {b}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.ink2}}>
        {expandedWindow
          ? `Veći prozor daje svakoj ekipi više mogućih protivnika (prozor ${windowSize} → ${expandedWindow}).`
          : "Prozor već obuhvaća sve ekipe pa se ne može proširiti."}
      </Box>
      <Box sx={{display: "flex", gap: "10px", flexWrap: "wrap"}}>
        <OutlineButton height={52} onClick={onExpand} disabled={!expandedWindow} sx={{flex: "1 1 160px", fontSize: 16, border: `1.5px solid ${tint.navy[25]}`, "&:disabled": {opacity: 0.4}}}>
          Proširi prozor
        </OutlineButton>
        <SolidButton height={52} onClick={onContinue} sx={{flex: "1 1 160px", fontSize: 16}}>
          Kreiraj svejedno
        </SolidButton>
      </Box>
    </Dialog>
  );
}

// The teams that won't be paired tonight, so the admin sees who's missing without scanning the list; a click on one
// puts the team back in the round.
function NotInRound({
  teams,
  isOn,
  inactive,
  onAddBack,
}: {
  teams: LeagueTeam[];
  isOn: (t: LeagueTeam) => boolean;
  inactive: Set<number>;
  onAddBack: (id: number) => void;
}) {
  const out = teams.filter((t) => !isOn(t));
  const inactiveOut = out.filter((t) => inactive.has(t.id)).length;
  return (
    <Box component="section" aria-labelledby="cr-out" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px", p: "14px 14px 0"}}>
      <Box sx={{px: "6px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px"}}>
        <SectionLabel id="cr-out" sx={{px: 0}}>
          Ne igraju ovo kolo
        </SectionLabel>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.muted, fontVariantNumeric: "tabular-nums"}}>
          {teams.length - out.length} / {teams.length} igra
        </Box>
      </Box>
      <Box sx={{borderRadius: "16px", background: color.paper2, p: "12px 14px", display: "flex", flexDirection: "column", gap: "10px"}}>
        <Box role="status" sx={{display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap"}}>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 34, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums"}}>
            {out.length}
          </Box>
          <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
            {plural(out.length, ...NOUN.ekipaNeIgra)}
          </Box>
          {out.length > 0 && (
            <Box component="span" sx={{ml: "auto", fontSize: 12, fontWeight: 600, color: color.muted, whiteSpace: "nowrap"}}>
              {count(inactiveOut, NOUN.neaktivna)} · {count(out.length - inactiveOut, NOUN.isključena)}
            </Box>
          )}
        </Box>
        {out.length > 0 ? (
          <Box component="ul" aria-label="Ekipe koje ne igraju" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: "6px", maxHeight: 76, overflowY: "auto", scrollbarGutter: "stable"}}>
            {out.map((t) => {
              const why: OutReason = inactive.has(t.id) ? "inactive" : "off";
              return (
                <Box component="li" key={t.id} sx={{minWidth: 0, maxWidth: "100%"}}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onAddBack(t.id)}
                    title={OUT_HINT[why]}
                    aria-label={`${t.name}, ${OUT_LABEL[why].toLowerCase()}. Dodaj u kolo`}
                    sx={{
                      ...buttonBase,
                      maxWidth: "100%",
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      pl: "12px",
                      pr: "6px",
                      borderRadius: "16px",
                      background: why === "inactive" ? color.paper : tint.red[10],
                      color: why === "inactive" ? color.muted : color.red,
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis"}}>
                      {t.name}
                    </Box>
                    <Box
                      component="span"
                      aria-hidden
                      sx={{height: 20, px: "6px", flex: "none", borderRadius: "10px", background: tint.white[70], fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", display: "flex", alignItems: "center"}}
                    >
                      {OUT_LABEL[why]}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{fontSize: 14, fontWeight: 600, color: color.green}}>Sve ekipe igraju ovo kolo.</Box>
        )}
      </Box>
    </Box>
  );
}
