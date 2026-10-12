"use client";

import {getSmokingPlanAPI} from "@/app/_fetchers/league/smoking";
import {SmokingPlan, SmokingPlanSide, SmokingPlanTeam} from "@/app/_interfaces/smoking";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ellipsis, ErrorNote, IconTile, LoadingRows, SwitchTrack, tabular} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import {Box} from "@mui/material";
import {useEffect, useId, useRef, useState} from "react";

// Create Round · Smoking tables and the Smoking plan (Claude Design "Pušači i pušački stolovi", 12g). How the tables
// are given out is in _lib/matching/smokingTables.ts.

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "Tables 1, 2 · 9 smokers in 6 teams"
export function smokingSummary(on: boolean, tables: number[], smokers: number, smokingTeams: number): string {
  if (!on) return "Off · all tables are non-smoking";
  if (!tables.length) return "No table selected";
  return `${tables.length === 1 ? "Table" : "Tables"} ${tables.join(", ")} · ${count(smokers, "smoker", "smokers")} in ${count(smokingTeams, "team", "teams")}`;
}

// The switch and, while it is on, a chip for every table tonight (half the teams in the round)
export function SmokingTablesCard({
  on,
  onToggle,
  tables,
  tableCount,
  onToggleTable,
  summary,
  onOpenPlan,
}: {
  on: boolean;
  onToggle: () => void;
  // the smoking tables picked, among 1..tableCount
  tables: number[];
  tableCount: number;
  onToggleTable: (table: number) => void;
  summary: string;
  onOpenPlan: () => void;
}) {
  const titleId = useId();
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{flex: "none", background: color.white, borderRadius: "18px", p: "14px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: shadow.card}}
    >
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        <IconTile size={40} radius={12}>
          <SmokingRoomsRoundedIcon />
        </IconTile>
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
          <Box component="span" id={titleId} sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
            Smoking tables
          </Box>
          <Box component="span" aria-live="polite" sx={{fontSize: 12.5, color: color.muted}}>
            {summary}
          </Box>
        </Box>
        <Box component="button" type="button" role="switch" aria-checked={on} aria-label="Smoking tables" onClick={onToggle} sx={{...buttonBase, display: "flex", borderRadius: "16px"}}>
          <SwitchTrack on={on} />
        </Box>
      </Box>
      {on && (
        <>
          {tableCount > 0 ? (
            <>
              <Box sx={{fontSize: 12.5, color: color.ink2}}>Select the tables where smoking is allowed.</Box>
              <Box role="group" aria-label="Pušački stolovi" sx={{display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))", gap: "5px"}}>
                {Array.from({length: tableCount}, (_, k) => k + 1).map((n) => {
                  const picked = tables.includes(n);
                  return (
                    <Box
                      key={n}
                      component="button"
                      type="button"
                      aria-pressed={picked}
                      aria-label={`Stol ${n}`}
                      onClick={() => onToggleTable(n)}
                      sx={{
                        ...buttonBase,
                        height: 34,
                        minWidth: 0,
                        borderRadius: "10px",
                        border: `1.5px solid ${picked ? color.navy : color.borderControl}`,
                        background: picked ? color.navy : color.white,
                        color: picked ? color.white : color.navy,
                        fontSize: 13,
                        fontWeight: 700,
                        ...tabular,
                        transition: "background 140ms ease, color 140ms ease",
                      }}
                    >
                      {n}
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <Box sx={{fontSize: 12.5, color: color.ink2}}>Switch on at least two teams to pick the tables.</Box>
          )}
          <Box
            component="button"
            type="button"
            onClick={onOpenPlan}
            sx={{
              ...buttonBase,
              height: 40,
              borderRadius: "12px",
              background: color.paper,
              color: color.navy,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pl: "14px",
              pr: "8px",
              fontSize: 14,
              fontWeight: 600,
              "&:hover": {background: color.lineFill},
              "& svg": {fontSize: 20},
            }}
          >
            Smoking plan · rotation
            <ChevronRightRoundedIcon aria-hidden />
          </Box>
        </>
      )}
    </Box>
  );
}

// The plan, fetched each time the overlay opens (the rounds may have been created in between)
function useSmokingPlan(leagueId: number) {
  const [plan, setPlan] = useState<SmokingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    getSmokingPlanAPI(leagueId)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Plan nije moguće učitati.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);
  return {plan, error, reload: () => setNonce((n) => n + 1)};
}

// "2 smoking tables × 3 rounds · 6 teams with smokers"
function planHeading(plan: SmokingPlan | null): string {
  if (!plan) return "";
  const teams = count(plan.teams.filter((t) => t.smokers > 0).length, "team", "teams");
  if (!plan.roundNumbers.length) return `No rounds tonight yet · ${teams} with smokers`;
  const tables = Math.max(0, ...plan.rounds.map((r) => r.tables.length));
  return `${count(tables, "smoking table", "smoking tables")} × ${count(plan.roundNumbers.length, "round", "rounds")} · ${teams} with smokers`;
}

const smokersLabel = (n: number) => (n ? count(n, "smoker", "smokers") : "no smokers");

// Tonight's smoking tables, round by round
function PlanRounds({plan}: {plan: SmokingPlan}) {
  if (!plan.roundNumbers.length) {
    return (
      <Box sx={{p: "14px 16px", borderRadius: "14px", background: color.cream2, fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
        Tonight&apos;s rounds aren&apos;t created yet. Their smoking tables show here once they are.
      </Box>
    );
  }
  return (
    <>
      {plan.rounds.map((r) => (
        <Box key={r.roundNumber} component="section" aria-label={`Round ${r.roundNumber}`} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>Round {r.roundNumber}</Box>
          {r.tables.length === 0 ? (
            <Box sx={{fontSize: 14, color: color.muted, px: "4px"}}>No smoking tables in this round.</Box>
          ) : (
            r.tables.map((t) => (
              <Box
                key={t.table}
                sx={{display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 22px minmax(0,1fr)", gap: "10px", alignItems: "center", p: "10px 14px", borderRadius: "14px", background: color.cream2}}
              >
                <Box
                  component="span"
                  aria-label={`Pušački stol ${t.table}`}
                  sx={{height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", borderRadius: "9px", background: color.navy, color: color.white, fontSize: 12.5, fontWeight: 700, "& svg": {fontSize: 15}}}
                >
                  <SmokingRoomsRoundedIcon aria-hidden />
                  {t.table}
                </Box>
                <PlanSide side={t.teams[0]} />
                <Box component="span" aria-hidden sx={{fontSize: 12, fontWeight: 600, color: color.muted, textAlign: "center"}}>
                  vs
                </Box>
                <PlanSide side={t.teams[1]} />
              </Box>
            ))
          )}
        </Box>
      ))}
    </>
  );
}

function PlanSide({side}: {side: SmokingPlanSide}) {
  return (
    <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
      <Box component="span" sx={{fontSize: 15, fontWeight: 700, ...ellipsis}}>
        {side.name}
      </Box>
      <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
        {smokersLabel(side.smokers)}
      </Box>
    </Box>
  );
}

function HowChosen() {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px", p: "14px 16px", borderRadius: "16px", background: color.paper, fontSize: 13.5, lineHeight: 1.5, color: color.ink}}>
      <Box sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>How tables are chosen</Box>
      <div>1. Pairings are made first, by standings. Smoking tables only decide where a match sits.</div>
      <div>
        2. Teams that haven&apos;t sat at a smoking table tonight come first, and of them the teams that went the most nights with
        a smoker but without one (Missed). A missed night counts for more than extra smokers.
      </div>
      <div>
        3. Then each match gets a score: one point per smoker at the table, plus extra for teams that have had fewer smoking
        tables than their share this season. The highest scores get the smoking tables, in the order of the table numbers.
        A team with more smokers is picked more often, but every smoking team rotates in.
      </div>
    </Box>
  );
}

// Tonight's rounds as dots: filled at a smoking table, a ring at another table, faint when not at a table
function TonightDots({team, roundNumbers}: {team: SmokingPlanTeam; roundNumbers: number[]}) {
  if (!roundNumbers.length) return <Box component="span" aria-label="Večeras još nema rundi" sx={{color: color.faint}}>—</Box>;
  return (
    <Box component="span" sx={{display: "flex", gap: "5px"}}>
      {team.tonight.map((smoking, i) => {
        const text = `Round ${roundNumbers[i]}: ${smoking == null ? "not at a table" : smoking ? "smoking table" : "regular table"}`;
        return (
          <Box
            key={roundNumbers[i]}
            component="span"
            role="img"
            title={text}
            aria-label={text}
            sx={{width: 14, height: 14, flex: "none", borderRadius: "50%", background: smoking ? color.navy : "transparent", boxShadow: `inset 0 0 0 1.5px ${color.navy}`, opacity: smoking == null ? 0.3 : 1}}
          />
        );
      })}
    </Box>
  );
}

const shareTitle = (t: SmokingPlanTeam) => `${t.smokingRounds} of ${count(t.rounds, "round", "rounds")} at a smoking table; fair share ${t.fairShare}`;
const ROTATION_COLUMNS = "minmax(0,1fr) 76px 76px 60px 56px";

// Every smoking team this season: smokers, tonight, rounds at a smoking table and nights without one
function PlanRotation({plan}: {plan: SmokingPlan}) {
  const cell = {display: "flex", alignItems: "center"} as const;
  return (
    <Box role="table" aria-label="Rotation · smoking teams" sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
      <Box
        role="row"
        sx={{flex: "none", display: "grid", gridTemplateColumns: ROTATION_COLUMNS, gap: "8px", alignItems: "center", height: 32, px: "22px", borderBottom: `1px solid ${tint.navy[12]}`, fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
      >
        <span role="columnheader">Team</span>
        <span role="columnheader">Smokers</span>
        <span role="columnheader">Tonight</span>
        <Box component="span" role="columnheader" sx={{textAlign: "right"}}>
          Share
        </Box>
        <Box component="span" role="columnheader" sx={{textAlign: "right"}}>
          Missed
        </Box>
      </Box>
      <Box role="rowgroup" sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
        {plan.teams.length === 0 && <Box sx={{p: "28px 22px", fontSize: 14, color: color.muted}}>No team in this league has a smoker yet.</Box>}
        {plan.teams.map((t) => (
          <Box
            key={t.id}
            role="row"
            sx={{height: 46, display: "grid", gridTemplateColumns: ROTATION_COLUMNS, gap: "8px", alignItems: "center", px: "22px", borderBottom: `1px solid ${color.divider}`}}
          >
            <Box component="span" role="cell" sx={{fontSize: 14.5, fontWeight: 600, ...ellipsis}}>
              {t.name}
            </Box>
            <Box component="span" role="cell" aria-label={smokersLabel(t.smokers)} sx={{...cell, gap: "2px", color: color.navy, "& svg": {fontSize: 16}}}>
              <SmokingRoomsRoundedIcon aria-hidden />
              <Box component="span" aria-hidden sx={{fontSize: 14, fontWeight: 700}}>
                {t.smokers}
              </Box>
            </Box>
            <Box component="span" role="cell" sx={cell}>
              <TonightDots team={t} roundNumbers={plan.roundNumbers} />
            </Box>
            <Box component="span" role="cell" title={shareTitle(t)} sx={{textAlign: "right", fontSize: 13.5, fontWeight: 600, color: color.ink2, ...tabular}}>
              {t.smokingRounds} / {t.rounds}
            </Box>
            <Box
              component="span"
              role="cell"
              title={count(t.missedNights, "night", "nights") + " with a smoker but no smoking table"}
              sx={{textAlign: "right", fontSize: 13.5, fontWeight: 700, color: t.missedNights ? color.red : color.muted, ...tabular}}
            >
              {t.missedNights}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function RotationHeading() {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
      <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
        Rotation · smoking teams
      </Box>
      <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
        Share = rounds on a smoking table this season, including tonight. Missed = nights with a smoker but no smoking table.
      </Box>
    </Box>
  );
}

// Desktop: over the Create round view (the design's "Smoking plan · tonight")
export function SmokingPlanOverlay({leagueId, onClose}: {leagueId: number; onClose: () => void}) {
  const {plan, error, reload} = useSmokingPlan(leagueId);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Box
      role="dialog"
      aria-labelledby={titleId}
      sx={{position: "absolute", inset: 0, zIndex: 4, background: color.white, borderRadius: "24px", boxShadow: shadow.popover, display: "flex", flexDirection: "column", overflow: "hidden"}}
    >
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px", p: "18px 22px", borderBottom: `1px solid ${tint.navy[10]}`}}>
        <IconTile size={44} radius={12}>
          <SmokingRoomsRoundedIcon />
        </IconTile>
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
            Smoking plan · tonight
          </Box>
          <Box component="span" sx={{fontSize: 14, color: color.muted}}>
            {planHeading(plan)}
          </Box>
        </Box>
        <Box
          ref={closeRef}
          component="button"
          type="button"
          onClick={onClose}
          sx={{...buttonBase, height: 44, px: "16px", border: `1.5px solid ${color.borderControl}`, borderRadius: "12px", background: color.white, color: color.navy, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 20}}}
        >
          <CloseRoundedIcon aria-hidden />
          Close
        </Box>
      </Box>
      {error ? (
        <ErrorNote onRetry={reload} sx={{m: "18px 22px"}}>
          {error}
        </ErrorNote>
      ) : !plan ? (
        <LoadingRows rows={8} height={46} />
      ) : (
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", overflow: "hidden"}}>
          <Box sx={{minHeight: 0, overflowY: "auto", p: "18px 22px", display: "flex", flexDirection: "column", gap: "16px", borderRight: `1px solid ${tint.navy[10]}`}}>
            <PlanRounds plan={plan} />
            <HowChosen />
          </Box>
          <Box sx={{minHeight: 0, display: "flex", flexDirection: "column"}}>
            <Box sx={{flex: "none", p: "18px 22px 8px"}}>
              <RotationHeading />
            </Box>
            <PlanRotation plan={plan} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
