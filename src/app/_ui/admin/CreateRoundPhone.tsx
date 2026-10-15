"use client";

import useLeagueTeams, {LeagueTeam} from "@/app/_hooks/useLeagueTeams";
import useLeagues from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import {createRoundNight, MAX_ROUNDS, MAX_WINDOW} from "@/app/_lib/createRoundDraft";
import {nightLabel} from "@/app/_lib/nights";
import {count, NOUN, plural} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {useCreateRound} from "@/app/_ui/round/CreateRound";
import LeagueNotes from "@/app/_ui/round/LeagueNotes";
import {SmokingTablesCard} from "@/app/_ui/round/SmokingTables";
import {BottomSheet, buttonBase, EmptyState, ErrorNote, PrimaryButton, Screen, ScrollArea, SearchInput, Segmented, SolidButton, SwitchRow, tabular, TopBar} from "@/app/_ui/sp";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box} from "@mui/material";
import React, {useMemo, useState} from "react";

// Why a team doesn't play tonight: inactive in Upravljanje ligom, or switched off here
const OUT = {inactive: "Neaktivna", off: "Isključena"} as const;

const cardSx = {flex: "none", background: color.white, borderRadius: "22px", p: "16px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: shadow.card} as const;
const labelSx = {fontSize: 15, fontWeight: 600, color: color.ink} as const;

// Novo kolo on the phone (admin-mobile 06, 07, 07b): how many rounds, the window, who plays tonight (changed in a
// sheet), the smoking tables and the league's notes, then Kreiraj. The choices are the desktop's (useCreateRound),
// saved for the admin on the server for tonight. The rounds are created as drafts and Skica kola opens.
export default function CreateRoundPhone({leagueId}: {leagueId: number}) {
  const router = useTransitionRouter();
  const nav = useNavStack("Novo kolo", `/league/${leagueId}/manage?view=teams`);
  const leagues = useLeagues(leagueId);
  const league = leagues.find((l) => l.id === leagueId);
  const teams = useLeagueTeams(leagueId);
  const tonight = useMemo(() => createRoundNight(), []);
  const [sheet, setSheet] = useState(false);
  const cr = useCreateRound(
    leagueId,
    teams,
    // the next page is Skica kola, in Novo kolo's place: Back from it goes to Upravljanje ligom
    (date) => router.replace(`/league/${leagueId}/manage?view=draft&date=${date}`),
    league?.roundsPerNight,
    league?.smokingTables
  );

  const all = cr.teams ?? [];
  const out = all.filter((t) => !cr.isOn(t));
  const reason = (t: LeagueTeam): keyof typeof OUT => (cr.inactive.has(t.id) ? "inactive" : "off");

  return (
    <Screen fill gap={14}>
      <TopBar onBack={nav.back} eyebrow={`${league?.name ?? "Liga"} · ${nightLabel(tonight)}`} title="Novo kolo" />
      {cr.blocked ? (
        <Box sx={{...cardSx, p: 0, overflow: "hidden"}}>{cr.blocked}</Box>
      ) : (
        <>
          <ScrollArea bleed sx={{gap: "12px"}}>
            <Box component="section" aria-label="Kola i prozor" sx={cardSx}>
              <Box component="span" id="cr-rounds" sx={labelSx}>
                Broj kola večeras
              </Box>
              <Segmented<number>
                items={Array.from({length: MAX_ROUNDS}, (_, i) => ({key: i + 1, label: String(i + 1)}))}
                value={cr.rounds}
                onChange={cr.setRounds}
                label="Broj kola večeras"
                variant="track"
                asTabs={false}
              />
              <Box component="span" sx={{...labelSx, mt: "4px"}}>
                Veličina prozora
              </Box>
              <WindowStepper value={cr.windowSize} onChange={cr.setWindow} />
              <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.5, color: color.ink2}}>
                Ekipa se sparuje s ekipama do {cr.windowSize} mjesta iznad ili ispod sebe na poretku, uz izbjegavanje ponovljenih parova.
              </Box>
              {cr.hasConferences && (
                <SwitchRow checked={cr.withinConferences} onChange={cr.setWithinConferences} sx={{minHeight: 56, mt: "4px"}}>
                  <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
                    <Box component="span" sx={labelSx}>
                      Samo unutar konferencija
                    </Box>
                    <Box component="span" sx={{fontSize: 13, fontWeight: 500, color: color.muted}}>
                      Ekipe igraju samo s ekipama svoje konferencije
                    </Box>
                  </Box>
                </SwitchRow>
              )}
            </Box>

            <Box component="section" aria-label="Tko igra večeras" sx={cardSx}>
              <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
                <Box role="status" sx={{display: "flex", flexDirection: "column", gap: "4px", minWidth: 0}}>
                  <Box component="span" sx={{fontFamily: font.display, fontSize: 34, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap", ...tabular}}>
                    {cr.playing} / {all.length}
                  </Box>
                  <Box component="span" sx={{fontSize: 15, color: color.ink2, lineHeight: 1.2, whiteSpace: "nowrap"}}>
                    {plural(cr.playing, "ekipa igra", "ekipe igraju", "ekipa igra")} večeras
                  </Box>
                </Box>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setSheet(true)}
                  aria-haspopup="dialog"
                  sx={{
                    ...buttonBase,
                    flex: "none",
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    px: "14px",
                    borderRadius: "14px",
                    border: `1.5px solid ${color.borderControl}`,
                    color: color.navy,
                    fontSize: 15,
                    fontWeight: 600,
                    "& svg": {fontSize: 18},
                  }}
                >
                  <EditRoundedIcon aria-hidden />
                  Promijeni
                </Box>
              </Box>
              {out.length > 0 && (
                <>
                  <Box component="span" sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
                    Ne igra {plural(out.length, "ekipa", "ekipe", "ekipa")} · {out.length}
                  </Box>
                  <Box component="ul" aria-label="Ekipe koje ne igraju" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: "8px"}}>
                    {out.map((t) => {
                      const why = reason(t);
                      return (
                        <Box component="li" key={t.id} sx={{minWidth: 0, maxWidth: "100%"}}>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => cr.toggle(t.id)}
                            aria-label={`${t.name}, ${OUT[why].toLowerCase()}. Dodaj u kolo`}
                            sx={{
                              ...buttonBase,
                              maxWidth: "100%",
                              minHeight: 44,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              pl: "14px",
                              pr: "8px",
                              borderRadius: "14px",
                              background: why === "inactive" ? color.lineFill : tint.red[10],
                              color: why === "inactive" ? color.ink2 : color.red,
                              fontSize: 15,
                              fontWeight: 600,
                            }}
                          >
                            <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                              {t.name}
                            </Box>
                            <Box component="span" aria-hidden sx={{flex: "none", height: 22, px: "7px", borderRadius: "7px", background: tint.white[70], fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center"}}>
                              {OUT[why]}
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}
            </Box>

            <SmokingTablesCard
              phone
              on={cr.smokingOn}
              onToggle={cr.toggleSmoking}
              tables={cr.smokingTables}
              tableCount={cr.tableCount}
              onToggleTable={cr.toggleSmokingTable}
              summary={cr.smokingText}
            />

            <LeagueNotes leagueId={leagueId} label="Bilješke lige" sx={{flex: "none", minHeight: 0, "& textarea": {minHeight: 88, flex: "none", borderRadius: "22px"}}} />
          </ScrollArea>

          <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
            {cr.saveError}
            {cr.createError && <ErrorNote>{cr.createError}</ErrorNote>}
            <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={cr.create} disabled={cr.playing < 2} loading={cr.creating}>
              {cr.creating ? "Kreiram kola…" : `Kreiraj ${count(cr.rounds, NOUN.kolo)} · ${count(cr.tableCount, NOUN.stol)}`}
            </PrimaryButton>
          </Box>
          {cr.repeatsDialog}
        </>
      )}

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Tko igra večeras?" closable tall>
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px"}}>
          <Box component="p" sx={{m: 0, flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
            Isključene ekipe ne ulaze u ovo kolo. Neaktivnu ekipu možeš uključiti samo za večeras.
          </Box>
          <SolidButton height={44} onClick={() => setSheet(false)} sx={{flex: "none", px: "18px", borderRadius: "14px", fontSize: 16}}>
            Gotovo
          </SolidButton>
        </Box>
        <Box component="ul" aria-label="Ekipe lige" sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", listStyle: "none", m: 0, p: 0, borderRadius: "16px", background: color.paper2}}>
          {cr.visible.length === 0 ? (
            <Box component="li">
              <EmptyState>{all.length ? "Nijedna ekipa ne odgovara pretrazi." : "Ova liga još nema ekipa."}</EmptyState>
            </Box>
          ) : (
            cr.visible.map((t) => (
              <Box component="li" key={t.id}>
                <SwitchRow checked={cr.isOn(t)} onChange={() => cr.toggle(t.id)} sx={{minHeight: 48, pl: "16px", pr: "12px", fontSize: 16, fontWeight: 600}}>
                  <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: cr.inactive.has(t.id) ? color.muted : undefined}}>
                    {t.name}
                  </Box>
                  {cr.inactive.has(t.id) && (
                    <Box component="span" sx={{flex: "none", height: 22, px: "8px", borderRadius: "11px", background: color.lineFill, color: color.muted, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center"}}>
                      {OUT.inactive}
                    </Box>
                  )}
                </SwitchRow>
              </Box>
            ))
          )}
        </Box>
        {/* last, so it stays right above the keyboard (07b) */}
        <SearchInput
          variant="paper"
          height={52}
          placeholder="Traži ekipu"
          aria-label="Traži ekipu"
          value={cr.query}
          onChange={(e) => cr.setQuery(e.target.value)}
          onClear={() => cr.setQuery("")}
          enterKeyHint="search"
        />
      </BottomSheet>
    </Screen>
  );
}

// − 8 + on a beige track (the window must stay even, so it steps by two)
function WindowStepper({value, onChange}: {value: number; onChange: (n: number) => void}) {
  const btn = {
    ...buttonBase,
    width: 48,
    height: 44,
    flex: "none",
    borderRadius: "12px",
    background: color.white,
    color: color.navy,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadow.raised,
    "&:disabled": {opacity: 0.4},
    "& svg": {fontSize: 24},
  } as const;
  return (
    <Box role="group" aria-label="Veličina prozora" sx={{display: "flex", alignItems: "center", gap: "8px", p: "4px", borderRadius: "16px", background: color.lineFill}}>
      <Box component="button" type="button" aria-label="Smanji prozor" onClick={() => onChange(value - 2)} disabled={value <= 2} sx={btn}>
        <RemoveRoundedIcon />
      </Box>
      <Box component="span" aria-live="polite" sx={{flex: 1, textAlign: "center", fontFamily: font.display, fontSize: 26, fontWeight: 800, ...tabular}}>
        {value}
      </Box>
      <Box component="button" type="button" aria-label="Povećaj prozor" onClick={() => onChange(value + 2)} disabled={value >= MAX_WINDOW} sx={btn}>
        <AddRoundedIcon />
      </Box>
    </Box>
  );
}
