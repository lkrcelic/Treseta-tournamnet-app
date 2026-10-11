"use client";

import {createMultipleRoundsAPI, RepeatMatchupsError} from "@/app/_fetchers/round/createMultipleRounds";
import useLeagueTeams, {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import {matchesQuery, plural} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, Card, EmptyState, ErrorNote, LoadingRows, OutlineButton, PrimaryButton, SearchInput, SectionLabel, SolidButton, Stepper, SwitchRow, SwitchTrack} from "@/app/_ui/sp";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import React, {useEffect, useId, useMemo, useState} from "react";
import LeagueNotes from "./LeagueNotes";

const MAX_ROUNDS = 5;
const MAX_WINDOW = 200;

// Create Round for one league: the options, the teams present tonight and the create action. The phone page and
// Manage League's "Create round" view lay these pieces out differently.
export function useCreateRound(leagueId: number | null, defaultRounds?: number) {
  const router = useTransitionRouter();
  const [rounds, setRounds] = useState(4);
  const [windowSize, setWindowSize] = useState(8);
  const [query, setQuery] = useState("");
  // teams switched away from their default (active teams start on, inactive teams start off)
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // the pairs that would meet twice today, while the admin decides whether to create the rounds anyway
  const [repeats, setRepeats] = useState<[string, string][] | null>(null);

  const {teams, error: teamsError, loading, reload} = useLeagueTeams(leagueId);
  const inactive = useMemo(() => new Set((teams ?? []).filter((t) => !t.active).map((t) => t.id)), [teams]);

  // every active team starts as present, and Rounds starts at the league's rounds per night; switching league starts over
  useEffect(() => {
    setFlipped(new Set());
    setQuery("");
    setCreateError(null);
    if (defaultRounds) setRounds(Math.min(MAX_ROUNDS, defaultRounds));
  }, [leagueId, defaultRounds]);

  // an inactive team (one that stopped coming) can still be switched on for tonight
  const onByDefault = (id: number) => !inactive.has(id);
  const isOn = (t: LeagueTeam) => onByDefault(t.id) !== flipped.has(t.id);
  const visible = useMemo(() => (teams ?? []).filter((t) => matchesQuery(t.name, query)), [teams, query]);
  const allOn = visible.length > 0 && visible.every(isOn);
  const selected = (teams ?? []).filter(isOn);
  const count = selected.length;

  const toggle = (id: number) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setFlipped((prev) => {
      const next = new Set(prev);
      visible.forEach((t) => (!allOn === onByDefault(t.id) ? next.delete(t.id) : next.add(t.id)));
      return next;
    });

  const create = async ({window = windowSize, allowRepeats = false}: {window?: number; allowRepeats?: boolean} = {}) => {
    if (leagueId == null || count < 2 || creating) return;
    setCreating(true);
    setCreateError(null);
    setRepeats(null);
    try {
      const roundNumber = await createMultipleRoundsAPI(leagueId, selected.map((t) => t.id), rounds, window, allowRepeats);
      // replace, so the back button doesn't lead to this form again
      router.replace(`/round/pairings/${roundNumber}?league=${leagueId}`);
    } catch (e) {
      if (e instanceof RepeatMatchupsError) setRepeats(e.repeats);
      else setCreateError(e instanceof Error ? e.message : "Kolo nije moguće napraviti.");
      setCreating(false);
    }
  };
  // a bigger window gives every team more possible opponents; once one window holds every team it can't grow further
  const expandedWindow = Math.min(MAX_WINDOW, windowSize + 2);
  const canExpand = windowSize < count && windowSize < MAX_WINDOW;
  const expandWindow = () => {
    setWindowSize(expandedWindow);
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
        label="Rounds"
        value={rounds}
        onInc={() => setRounds((r) => Math.min(MAX_ROUNDS, r + 1))}
        onDec={() => setRounds((r) => Math.max(1, r - 1))}
        canInc={rounds < MAX_ROUNDS}
        canDec={rounds > 1}
      />
      {/* the pairing needs an even window */}
      <Stepper
        label="Window"
        value={windowSize}
        onInc={() => setWindowSize((w) => Math.min(MAX_WINDOW, w + 2))}
        onDec={() => setWindowSize((w) => Math.max(2, w - 2))}
        canInc={windowSize < MAX_WINDOW}
        canDec={windowSize > 2}
      />
    </Box>
  );

  const createButton = (
    <PrimaryButton onClick={() => create()} disabled={count < 2} loading={creating}>
      {creating ? "Stvaram kolo…" : `Create round · ${count} ${plural(count, "team", "teams", "teams")}`}
    </PrimaryButton>
  );

  const teamState = teamsError ? (
    <ErrorNote onRetry={reload} sx={{m: "12px"}}>
      {teamsError}
    </ErrorNote>
  ) : loading ? (
    <LoadingRows rows={8} height={56} />
  ) : visible.length === 0 ? (
    <EmptyState>{teams?.length ? "Nijedna ekipa ne odgovara pretrazi." : "Ova liga još nema ekipa."}</EmptyState>
  ) : null;

  return {teams, visible, inactive, isOn, toggle, toggleAll, allOn, query, setQuery, createError, steppers, createButton, repeatsDialog, teamState};
}

export function InactiveBadge() {
  return (
    <Box
      component="span"
      sx={{height: 22, px: "8px", borderRadius: "11px", background: color.paper, color: color.muted, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", flex: "none"}}
    >
      Inactive
    </Box>
  );
}

// Manage League (desktop) · Create round: options, the league's notes and the create action on the left; who sits
// out and every team's switch on the right
export function CreateRoundView({leagueId, defaultRounds}: {leagueId: number; defaultRounds?: number}) {
  const cr = useCreateRound(leagueId, defaultRounds);
  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: "20px"}}>
      <Box sx={{minHeight: 0, display: "flex", flexDirection: "column", gap: "16px"}}>
        <Box component="section" aria-labelledby="cr-options" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
          <SectionLabel id="cr-options">Options</SectionLabel>
          {cr.steppers}
        </Box>
        <LeagueNotes key={leagueId} leagueId={leagueId} />
        <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
          {cr.createError && <ErrorNote>{cr.createError}</ErrorNote>}
          {cr.createButton}
        </Box>
      </Box>
      {cr.repeatsDialog}
      <Card component="section" aria-label="Prisutne ekipe" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        {!cr.teamState && cr.teams && <NotInRound teams={cr.teams} isOn={cr.isOn} inactive={cr.inactive} onAddBack={cr.toggle} />}
        <Box sx={{display: "flex", alignItems: "center", gap: "12px", p: "14px", borderBottom: `1px solid rgba(60,74,103,.1)`}}>
          <SearchInput soft height={48} placeholder="Search" aria-label="Traži ekipu" value={cr.query} onChange={(e) => cr.setQuery(e.target.value)} sx={{flex: 1}} />
          <Box
            component="button"
            type="button"
            role="switch"
            aria-checked={cr.allOn}
            onClick={cr.toggleAll}
            disabled={cr.visible.length === 0}
            sx={{...buttonBase, height: 48, display: "flex", alignItems: "center", gap: "12px", pl: "14px", pr: "8px", borderRadius: "14px", background: color.tableHead, fontSize: 15, fontWeight: 700, color: color.ink}}
          >
            <span>{cr.query ? "Select all filtered" : "Select all"}</span>
            <SwitchTrack on={cr.allOn} />
          </Box>
        </Box>
        {cr.teamState ?? (
          <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gridAutoRows: "56px", columnGap: "24px", p: "4px 14px"}}>
            {cr.visible.map((t) => (
              <SwitchRow key={t.id} checked={cr.isOn(t)} onChange={() => cr.toggle(t.id)} sx={{px: "4px", minHeight: 56}}>
                <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                  {t.name}
                </Box>
                {cr.inactive.has(t.id) && <InactiveBadge />}
              </SwitchRow>
            ))}
          </Box>
        )}
      </Card>
    </Box>
  );
}

// The rounds can't be made without some teams meeting twice today (with each other earlier today, or in two of the
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
      slotProps={{backdrop: {sx: {background: "rgba(21,24,31,.32)"}}}}
      PaperProps={{sx: {width: 480, maxWidth: "calc(100% - 32px)", m: "16px", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 30px 80px rgba(21,24,31,.3)"}}}
    >
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        <Box aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "14px", background: "rgba(188,71,73,.1)", color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
          <WarningRoundedIcon />
        </Box>
        <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.1}}>
          Some teams will play twice today
        </Box>
      </Box>
      <Box component="ul" aria-label="Ekipe koje se danas sastaju dvaput" sx={{listStyle: "none", m: 0, p: "4px 14px", borderRadius: "16px", background: color.paper, maxHeight: 220, overflowY: "auto"}}>
        {repeats.map(([a, b], i) => (
          <Box
            component="li"
            key={`${a}-${b}-${i}`}
            sx={{minHeight: 40, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: "8px", fontSize: 15, fontWeight: 600, borderBottom: i < repeats.length - 1 ? "1px solid rgba(60,74,103,.1)" : "none", "& > span:not([aria-hidden])": {overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}}
          >
            <span>{a}</span>
            <Box component="span" aria-hidden sx={{fontSize: 13, color: color.placeholder}}>
              vs
            </Box>
            <Box component="span" sx={{textAlign: "right"}}>
              {b}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.inkSoft}}>
        {expandedWindow
          ? `A bigger window gives every team more opponents to choose from (window ${windowSize} → ${expandedWindow}).`
          : "The window already holds every team, so it can't be expanded."}
      </Box>
      <Box sx={{display: "flex", gap: "10px", flexWrap: "wrap"}}>
        <OutlineButton height={52} onClick={onExpand} disabled={!expandedWindow} sx={{flex: "1 1 160px", fontSize: 16, border: `1.5px solid rgba(60,74,103,.25)`, "&:disabled": {opacity: 0.4}}}>
          Expand the window
        </OutlineButton>
        <SolidButton height={52} onClick={onContinue} sx={{flex: "1 1 160px", fontSize: 16}}>
          Continue
        </SolidButton>
      </Box>
    </Dialog>
  );
}

// The teams that won't be paired tonight, so the admin sees who's missing without scanning the list. "Inactive"
// teams are off because Manage League marks them inactive, "Off" ones were switched off here; a click on either puts
// the team back in the round.
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
          Not in this round
        </SectionLabel>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.muted, fontVariantNumeric: "tabular-nums"}}>
          {teams.length - out.length} / {teams.length} playing
        </Box>
      </Box>
      <Box sx={{borderRadius: "16px", background: color.tableHead, p: "12px 14px", display: "flex", flexDirection: "column", gap: "10px"}}>
        <Box role="status" sx={{display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap"}}>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 34, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums"}}>
            {out.length}
          </Box>
          <Box component="span" sx={{fontSize: 14, color: color.inkSoft}}>
            {out.length === 1 ? "team will sit out" : "teams will sit out"}
          </Box>
          {out.length > 0 && (
            <Box component="span" sx={{ml: "auto", fontSize: 12, fontWeight: 600, color: color.muted, whiteSpace: "nowrap"}}>
              {inactiveOut} inactive · {out.length - inactiveOut} off
            </Box>
          )}
        </Box>
        {out.length > 0 ? (
          <Box component="ul" aria-label="Ekipe koje ne igraju" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: "6px", maxHeight: 76, overflowY: "auto", scrollbarGutter: "stable"}}>
            {out.map((t) => {
              const why = inactive.has(t.id) ? "Inactive" : "Off";
              return (
                <Box component="li" key={t.id} sx={{minWidth: 0, maxWidth: "100%"}}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onAddBack(t.id)}
                    title={why === "Inactive" ? "Inactive in Manage League · click to add for tonight" : "Click to add back"}
                    aria-label={`${t.name}, ${why}. Dodaj u kolo`}
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
                      background: why === "Inactive" ? color.paper : "rgba(188,71,73,.1)",
                      color: why === "Inactive" ? color.muted : color.red,
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
                      sx={{height: 20, px: "6px", flex: "none", borderRadius: "10px", background: "rgba(255,255,255,.7)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", display: "flex", alignItems: "center"}}
                    >
                      {why}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{fontSize: 14, fontWeight: 600, color: color.green}}>All teams are in this round.</Box>
        )}
      </Box>
    </Box>
  );
}
