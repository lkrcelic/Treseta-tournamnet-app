"use client";

import {AdminTournament, TournamentEntryView} from "@/app/_interfaces/tournament";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {Card, ellipsis, EmptyState, ErrorNote, InfoNote, NARROW_DESKTOP} from "@/app/_ui/sp";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {Box} from "@mui/material";
import React from "react";
import {ActiveSwitch, ArrivalButton, ArrivalChip, AtStartCard, clockOf, ExcludeControls, ExclusionTag, useMinutesLeft, useTeamDay} from "./DayAdmin";

// Upravljanje turnirom · Prijave on the computer on the tournament's day and after the start (Claude Design "Potvrda
// dolaska" AD1, "Turniri admin" A6, A6x). On the day: Tu · Nije potvrdilo · Lista čekanja · tu, one table of the teams
// in and waiting with Dolazak (Označi da je tu, Makni potvrdu) and Aktivna, and on the right what the start time will
// do. Once Kolo 1 is out: the teams with their state, Isključi ekipu (asked first) and Vrati, as the league's admin
// screens lay out a table on the left and a card on the right.

const handles = (e: TournamentEntryView) => e.players.map((p) => p.name).join(" · ");

function Tile({icon, value, label, tone}: {icon: React.ReactNode; value: string | number; label: string; tone?: string}) {
  return (
    <Box sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", p: "14px 16px", borderRadius: "20px", background: color.white, boxShadow: shadow.card}}>
      <Box aria-hidden sx={{flex: "none", width: 40, height: 40, borderRadius: "12px", background: tone ?? color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
        {icon}
      </Box>
      <Box sx={{minWidth: 0, display: "flex", flexDirection: "column"}}>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.1}}>
          {value}
        </Box>
        <Box component="span" sx={{fontSize: 13, color: color.ink2, ...ellipsis}}>
          {label}
        </Box>
      </Box>
    </Box>
  );
}

export default function DayEntriesDesktop({t, onChanged}: {t: AdminTournament; onChanged: (t: AdminTournament) => void}) {
  const day = useTeamDay(t, onChanged);
  const started = t.started_at != null;
  // a finished tournament's teams stay as they were (the server refuses changes too)
  const done = t.phase === "finished";
  const s = t.arrival_summary;
  const left = useMinutesLeft(t.day?.closes ?? null);
  const rows: {e: TournamentEntryView; waiting: boolean}[] = [...t.entries.map((e) => ({e, waiting: false})), ...t.waiting_list.map((e) => ({e, waiting: true}))];
  const cols = started ? "minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.1fr) 150px" : "minmax(0,1fr) minmax(0,1.3fr) 210px 140px 70px";

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "16px"}}>
      {!started && s && t.day && (
        <Box sx={{flex: "none", display: "flex", gap: "14px"}}>
          <Tile icon={<HowToRegRoundedIcon />} value={s.here} label="Tu" tone={tint.green[12]} />
          <Tile icon={<RadioButtonUncheckedRoundedIcon />} value={s.not_confirmed} label="Nije potvrdilo" />
          <Tile icon={<HourglassTopRoundedIcon />} value={`${s.waiting_here} od ${s.waiting}`} label="Lista čekanja · tu" tone={tint.gold[16]} />
          <Tile
            icon={<ScheduleRoundedIcon />}
            value={clockOf(t.day.closes)}
            label={t.day.phase === "closed" ? "Potvrda dolaska je zatvorena" : `Potvrda dolaska do ${clockOf(t.day.closes)}${left != null ? ` · još ${left} min` : ""}`}
          />
        </Box>
      )}
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 300px"}, gap: "20px"}}>
        <Card component="section" aria-label="Prijavljene ekipe" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          {day.error && <ErrorNote sx={{m: "12px 14px 0"}}>{day.error}</ErrorNote>}
          <Box
            aria-hidden
            sx={{flex: "none", height: 40, display: "grid", gridTemplateColumns: cols, gap: "12px", alignItems: "center", px: "20px", background: color.paper2, borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
          >
            <span>Ekipa</span>
            <span>Igrači</span>
            <span>{started ? "Stanje" : "Dolazak"}</span>
            {!started && <span />}
            <Box component="span" sx={{textAlign: "right"}}>
              {started ? "" : "Aktivna"}
            </Box>
          </Box>
          {rows.length === 0 ? (
            <EmptyState>Još nema prijavljenih ekipa.</EmptyState>
          ) : (
            <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto"}}>
              {rows.map(({e, waiting}) => (
                <Box
                  component="li"
                  key={e.team_id}
                  sx={{display: "grid", gridTemplateColumns: cols, gap: "12px", alignItems: "center", minHeight: 58, px: "20px", borderBottom: `1px solid ${tint.navy[7]}`, background: waiting ? color.paper2 : "transparent"}}
                >
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, opacity: e.excluded || (started && !e.active) ? 0.6 : 1, ...ellipsis}}>
                    {e.team_name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13.5, color: color.ink2, ...ellipsis}}>
                    {handles(e)}
                  </Box>
                  {started ? (
                    <>
                      <Box sx={{minWidth: 0}}>
                        {e.excluded ? (
                          <ExclusionTag x={e.excluded} />
                        ) : waiting ? (
                          <ArrivalChip e={e} waiting />
                        ) : (
                          <Box component="span" sx={{fontSize: 13.5, fontWeight: 700, color: e.active ? color.green : color.muted}}>
                            {e.active ? "Aktivna" : "Neaktivna"}
                          </Box>
                        )}
                      </Box>
                      <Box sx={{display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", ...(done && {display: "none"})}}>
                        {waiting && !e.arrival && <ArrivalButton e={e} day={day} />}
                        {!waiting && !e.excluded && !e.active && <ActiveSwitch e={e} day={day} />}
                        {!waiting && <ExcludeControls e={e} day={day} t={t} />}
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{minWidth: 0}}>
                        <ArrivalChip e={e} waiting={waiting} />
                      </Box>
                      <Box sx={{display: "flex", justifyContent: "flex-end"}}>
                        <ArrivalButton e={e} day={day} />
                      </Box>
                      <Box sx={{display: "flex", justifyContent: "flex-end"}}>
                        <ActiveSwitch e={e} day={day} />
                      </Box>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Card>
        <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
          {done ? (
            <InfoNote icon={<InfoRoundedIcon />}>
              Turnir je završen: prijave i lista čekanja se više ne mijenjaju. Rezultati se ispravljaju u tabu Kola, a podaci u tabu Podaci. Za novo kolo dodaj ga u tabu Kola.
            </InfoNote>
          ) : started ? (
            <InfoNote icon={<InfoRoundedIcon />}>
              Turnir je krenuo: ekipa se ne briše nego isključuje. Isključena ekipa ne igra ostala kola, odigrana ostaju u poretku, a dok turnir traje možeš je vratiti.
              Prva potvrđena ekipa s liste čekanja ulazi kad se mjesto oslobodi.
            </InfoNote>
          ) : (
            <>
              <AtStartCard t={t} />
              <InfoNote icon={<InfoRoundedIcon />}>
                {t.day?.phase === "closed"
                  ? `Samo aktivne ekipe ulaze u kolo. Potvrda dolaska je zatvorena u ${clockOf(t.day.closes)}: nepotvrđene ekipe su Neaktivne (ostaju prijavljene). Ekipu koja stigne kasnije označi pa je uključi prekidačem.`
                  : `Samo aktivne ekipe ulaze u kolo. U ${t.day ? clockOf(t.day.closes) : "vrijeme početka"} nepotvrđene ekipe postaju Neaktivne (ostaju prijavljene), a prva potvrđena s liste čekanja ulazi umjesto njih.`}
              </InfoNote>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
