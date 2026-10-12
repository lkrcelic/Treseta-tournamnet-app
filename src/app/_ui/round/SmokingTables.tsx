"use client";

import {getSmokingPlanAPI} from "@/app/_fetchers/league/smoking";
import {SmokingPlan, SmokingPlanSide, SmokingPlanTeam} from "@/app/_interfaces/smoking";
import {missedTitle, planHeading, roundDotLabel, shareTitle, smokersLabel} from "@/app/_lib/ui/smoking";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ellipsis, ErrorNote, IconTile, LoadingRows, SwitchTrack, tabular} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import {Box} from "@mui/material";
import {useEffect, useId, useRef, useState} from "react";

// Novo kolo · Pušački stolovi and the Pušački raspored (Claude Design "Pušači i pušački stolovi", 12g). How the tables
// are given out is in _lib/matching/smokingTables.ts; the copy with counts is in _lib/ui/smoking.ts.

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
            Pušački stolovi
          </Box>
          <Box component="span" aria-live="polite" sx={{fontSize: 12.5, color: color.muted}}>
            {summary}
          </Box>
        </Box>
        <Box component="button" type="button" role="switch" aria-checked={on} aria-label="Pušački stolovi" onClick={onToggle} sx={{...buttonBase, display: "flex", borderRadius: "16px"}}>
          <SwitchTrack on={on} />
        </Box>
      </Box>
      {on && (
        <>
          {tableCount > 0 ? (
            <>
              <Box sx={{fontSize: 12.5, color: color.ink2}}>Odaberi stolove za kojima se smije pušiti.</Box>
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
            <Box sx={{fontSize: 12.5, color: color.ink2}}>Uključi barem dvije ekipe da odabereš stolove.</Box>
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
            Pušački raspored · rotacija
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Pušački raspored se nije učitao.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);
  return {plan, error, reload: () => setNonce((n) => n + 1)};
}

// "2 pušačka stola × 3 kola · 6 ekipa s pušačima"
function planLine(plan: SmokingPlan | null): string {
  if (!plan) return "";
  const tables = Math.max(0, ...plan.rounds.map((r) => r.tables.length));
  return planHeading(tables, plan.roundNumbers.length, plan.teams.filter((t) => t.smokers > 0).length);
}

// Tonight's smoking tables, round by round
function PlanRounds({plan}: {plan: SmokingPlan}) {
  if (!plan.roundNumbers.length) {
    return (
      <Box sx={{p: "14px 16px", borderRadius: "14px", background: color.cream2, fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
        Večerašnja kola još nisu napravljena. Kad budu, ovdje će se vidjeti njihovi pušački stolovi.
      </Box>
    );
  }
  return (
    <>
      {plan.rounds.map((r) => (
        <Box key={r.roundNumber} component="section" aria-label={`Kolo ${r.roundNumber}`} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>Kolo {r.roundNumber}</Box>
          {r.tables.length === 0 ? (
            <Box sx={{fontSize: 14, color: color.muted, px: "4px"}}>U ovom kolu nema pušačkih stolova.</Box>
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

// The rule of _lib/matching/smokingTables.ts (matchNeed: the tier, then the points) in the design's words (Desktop.dc
// "Kako se biraju stolovi"), with what the design doesn't have: matches with a team that hasn't sat at a smoking table
// tonight first, then the most missed nights, and the ten points for such a team (DECISIONS #32, #38)
function HowChosen() {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px", p: "14px 16px", borderRadius: "16px", background: color.paper, fontSize: 13.5, lineHeight: 1.5, color: color.ink}}>
      <Box sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>Kako se biraju stolovi</Box>
      <div>1. Prvo se sparuju ekipe po poretku. Pušački stolovi odlučuju samo gdje se meč igra.</div>
      <div>
        2. Prednost imaju mečevi s ekipom koja večeras još nije sjela za pušački stol, a od njih oni u kojima takva ekipa
        ima najviše propuštenih večeri (Propušteno). Propuštena večer vrijedi više od dodatnih pušača.
      </div>
      <div>
        3. Među mečevima s jednakom prednošću odlučuju bodovi: deset za svaku ekipu koja večeras još nije sjela za pušački
        stol, jedan po pušaču za stolom, te do tri boda više za ekipu koja je ove sezone imala manje kola za pušačkim
        stolom od svog udjela (do tri manje za onu koja je imala više). Mečevi s najviše bodova dobivaju pušačke stolove,
        redom brojeva stolova gore. Ekipa s više pušača bira se češće, ali se sve ekipe s pušačima izmjenjuju.
      </div>
    </Box>
  );
}

// Tonight's rounds as dots: filled at a smoking table, a ring at another table, faint when not at a table
function TonightDots({team, roundNumbers}: {team: SmokingPlanTeam; roundNumbers: number[]}) {
  if (!roundNumbers.length) return <Box component="span" aria-label="Večeras još nema kola" sx={{color: color.faint}}>—</Box>;
  return (
    <Box component="span" sx={{display: "flex", gap: `${DOT_GAP}px`}}>
      {team.tonight.map((smoking, i) => {
        const text = roundDotLabel(roundNumbers[i], smoking);
        return (
          <Box
            key={roundNumbers[i]}
            component="span"
            role="img"
            title={text}
            aria-label={text}
            sx={{width: DOT, height: DOT, flex: "none", borderRadius: "50%", background: smoking ? color.navy : "transparent", boxShadow: `inset 0 0 0 1.5px ${color.navy}`, opacity: smoking == null ? 0.3 : 1}}
          />
        );
      })}
    </Box>
  );
}

// a rotation dot and the gap between dots; the Večeras column fits all of tonight's rounds (the design's 76 px holds 4).
// The other columns fit their headers ("Propušteno" on two lines), so the team names keep the room at 1024 px.
const DOT = 14;
const DOT_GAP = 5;
const rotationColumns = (rounds: number) => `minmax(0,1fr) 56px ${Math.max(76, rounds * DOT + (rounds - 1) * DOT_GAP)}px 56px 56px`;

// Every smoking team this season: smokers, tonight, rounds at a smoking table and nights without one. The design's
// columns, plus Propušteno, which the rule uses (DECISIONS #38).
function PlanRotation({plan}: {plan: SmokingPlan}) {
  const cell = {display: "flex", alignItems: "center"} as const;
  const columns = rotationColumns(plan.roundNumbers.length);
  return (
    <Box role="table" aria-label="Rotacija · ekipe s pušačima" sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
      <Box
        role="row"
        sx={{flex: "none", display: "grid", gridTemplateColumns: columns, gap: "8px", alignItems: "center", height: 32, px: "22px", borderBottom: `1px solid ${tint.navy[12]}`, fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
      >
        <span role="columnheader">Ekipa</span>
        <span role="columnheader">Pušači</span>
        <span role="columnheader">Večeras</span>
        <Box component="span" role="columnheader" sx={{textAlign: "right"}}>
          Udio
        </Box>
        {/* the soft hyphen breaks it as "Propu-/šteno" in its narrow column */}
        <Box component="span" role="columnheader" aria-label="Propušteno" sx={{textAlign: "right", lineHeight: 1.15}}>
          {"Propu­šteno"}
        </Box>
      </Box>
      <Box role="rowgroup" sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
        {plan.teams.length === 0 && <Box sx={{p: "28px 22px", fontSize: 14, color: color.muted}}>Nijedna ekipa u ovoj ligi još nema pušača.</Box>}
        {plan.teams.map((t) => (
          <Box
            key={t.id}
            role="row"
            sx={{height: 46, display: "grid", gridTemplateColumns: columns, gap: "8px", alignItems: "center", px: "22px", borderBottom: `1px solid ${color.divider}`}}
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
            <Box
              component="span"
              role="cell"
              title={shareTitle(t.smokingRounds, t.rounds, t.fairShare)}
              sx={{textAlign: "right", fontSize: 13.5, fontWeight: 600, color: color.ink2, ...tabular}}
            >
              {t.smokingRounds} / {t.rounds}
            </Box>
            <Box
              component="span"
              role="cell"
              title={missedTitle(t.missedNights)}
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
        Rotacija · ekipe s pušačima
      </Box>
      <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
        Udio = kola za pušačkim stolom ove sezone, uključujući večeras. Propušteno = večeri s pušačem, a bez pušačkog stola.
      </Box>
    </Box>
  );
}

// Desktop: over the Novo kolo view (the design's "Pušački raspored · večeras")
export function SmokingPlanOverlay({leagueId, onClose}: {leagueId: number; onClose: () => void}) {
  const {plan, error, reload} = useSmokingPlan(leagueId);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  // the control that opened the plan, read while rendering (before the view under the plan turns inert); it gets the
  // focus back when the plan closes
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, [opener]);

  // the paper under the card hides the Novo kolo view at its rounded corners
  return (
    <Box sx={{position: "absolute", inset: 0, zIndex: 4, background: color.paper}}>
      <Box
        role="dialog"
        aria-labelledby={titleId}
        sx={{height: "100%", background: color.white, borderRadius: "24px", boxShadow: shadow.popover, display: "flex", flexDirection: "column", overflow: "hidden"}}
      >
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px", p: "18px 22px", borderBottom: `1px solid ${tint.navy[10]}`}}>
          <IconTile size={44} radius={12}>
            <SmokingRoomsRoundedIcon />
          </IconTile>
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
              Pušački raspored · večeras
            </Box>
            <Box component="span" sx={{fontSize: 14, color: color.muted}}>
              {planLine(plan)}
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
            Zatvori
          </Box>
        </Box>
        {error ? (
          <ErrorNote onRetry={reload} sx={{m: "18px 22px"}}>
            {error}
          </ErrorNote>
        ) : !plan ? (
          <LoadingRows rows={8} height={46} />
        ) : (
          // below 1200 px the rotation gets half, so its team names stay readable next to the extra Propušteno column
          <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: {xs: "minmax(0,1fr) minmax(0,1fr)", lg: "minmax(0,1.25fr) minmax(0,1fr)"}, overflow: "hidden"}}>
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
    </Box>
  );
}
