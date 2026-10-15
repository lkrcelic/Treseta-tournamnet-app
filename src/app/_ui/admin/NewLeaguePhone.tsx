"use client";

import {createLeagueAPI} from "@/app/_fetchers/league/leagues";
import useLeagues, {chooseLeague, reloadLeagues} from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import {END_DATE_ERROR, endsAfterStart, LEAGUE_NAME_TAKEN, leagueNameTaken} from "@/app/_interfaces/league";
import {generateNights, isIsoDate, nightLabel, sortNights} from "@/app/_lib/nights";
import {count, NOUN} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, shadow} from "@/app/_styles/tokens";
import {buttonBase, dateInputFix, ErrorNote, PrimaryButton, Screen, ScrollArea, SectionLabel, SolidButton, TextField, TimeField, TopBar} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import {Box} from "@mui/material";
import React, {useMemo, useState} from "react";
import {adminCardSx, DayPicker, PhoneStepper} from "./AdminParts";
import {EMPTY_PLACE, PlaceDraft, PlaceFields, placePayload, TIME_LABEL} from "./GatheringForm";

// Nova liga on the admin's phone (admin-mobile 13, 13b): the name, season, dates, play day and the rounds per night,
// then the league's nights, filled in from the dates and the play day (a night can be taken out or added), and last
// Okupljanje, when and where the nights gather. Teams join afterwards on Upravljanje ligom · Ekipe, where Kreiraj ligu
// opens. The rules are the desktop's.
export default function NewLeaguePhone() {
  const router = useTransitionRouter();
  const nav = useNavStack("Nova liga", "/");
  const leagues = useLeagues();
  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [playDay, setPlayDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [place, setPlace] = useState<PlaceDraft>(EMPTY_PLACE);
  const [rounds, setRounds] = useState(3);
  const [removed, setRemoved] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [newNight, setNewNight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const taken = leagueNameTaken(leagues, trimmed);
  const datesOk = endsAfterStart(startDate, endDate);
  const nights = useMemo(
    () => sortNights([...generateNights(startDate, endDate, playDay).filter((n) => !removed.includes(n)), ...extra]),
    [startDate, endDate, playDay, removed, extra]
  );
  const canAddNight = isIsoDate(newNight) && !nights.includes(newNight);
  const ok = !!trimmed && !taken && datesOk && !submitting;

  const create = async () => {
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      const league = await createLeagueAPI({
        league_name: trimmed,
        season: season.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        play_day: playDay,
        start_time: startTime || null,
        ...placePayload(place),
        rounds_per_night: rounds,
        team_ids: [],
        nights,
      });
      await reloadLeagues();
      // the new league is the one every admin screen shows now
      chooseLeague(league.league_id);
      router.replace(`/league/${league.league_id}/manage?view=teams`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Liga nije kreirana.");
      setSubmitting(false);
    }
  };

  const inputSx = {height: 52, borderRadius: "14px", fontSize: 16};
  return (
    <Screen fill gap={14}>
      <TopBar onBack={nav.back} title="Nova liga" />
      <ScrollArea bleed sx={{gap: "12px"}}>
        <Box component="form" noValidate onSubmit={(e: React.FormEvent) => (e.preventDefault(), create())} sx={{...adminCardSx, gap: "14px"}}>
          <TextField label="Naziv lige" placeholder="npr. Liga Utorak" value={name} onChange={(e) => setName(e.target.value)} error={taken ? LEAGUE_NAME_TAKEN : undefined} soft inputSx={inputSx} />
          <TextField label="Sezona" value={season} onChange={(e) => setSeason(e.target.value)} soft inputSx={inputSx} />
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
            <TextField label="Početak" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} soft inputSx={inputSx} />
            <TextField label="Kraj" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} error={datesOk ? undefined : END_DATE_ERROR} soft inputSx={inputSx} />
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
            <Box id="nl-day" sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
              Dan igranja · neobavezno
            </Box>
            <DayPicker value={playDay} onChange={setPlayDay} labelId="nl-day" />
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
            <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
              Kola po večeri
            </Box>
            <PhoneStepper label="Kola po večeri" value={rounds} onChange={setRounds} min={1} max={6} less="Manje kola po večeri" more="Više kola po večeri" />
          </Box>
        </Box>

        <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", px: "6px"}}>
          <SectionLabel sx={{px: 0}}>Večeri lige</SectionLabel>
          <Box component="span" sx={{fontSize: 14, color: color.muted}}>
            {count(nights.length, NOUN.večer)}
          </Box>
        </Box>
        <Box sx={{...adminCardSx, gap: "12px"}}>
          {nights.length > 0 ? (
            <Box component="ul" aria-label="Večeri lige" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: "8px"}}>
              {nights.map((n) => (
                <Box component="li" key={n} sx={{height: 44, display: "flex", alignItems: "center", gap: "2px", pl: "14px", pr: "2px", borderRadius: "14px", background: color.lineFill, fontSize: 15, fontWeight: 600}}>
                  {nightLabel(n)}
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Makni ${nightLabel(n)}`}
                    onClick={() => {
                      setRemoved((r) => [...r, n]);
                      setExtra((x) => x.filter((y) => y !== n));
                    }}
                    sx={{...buttonBase, width: 40, height: 40, borderRadius: "12px", color: color.muted, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 20}}}
                  >
                    <CloseRoundedIcon />
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
              Upiši početak, kraj i dan igranja pa se večeri same dodaju, ili dodaj večer po večer.
            </Box>
          )}
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "8px"}}>
            <Box
              component="input"
              type="date"
              aria-label="Datum večeri"
              value={newNight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewNight(e.target.value)}
              sx={{...dateInputFix, width: "100%", height: 52, boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${color.border}`, background: color.paper2, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none", "&:focus": {borderColor: color.navy, background: color.white}}}
            />
            <SolidButton
              height={52}
              disabled={!canAddNight}
              onClick={() => {
                setExtra((x) => [...x, newNight]);
                setRemoved((r) => r.filter((y) => y !== newNight));
                setNewNight("");
              }}
              sx={{px: "16px", borderRadius: "14px", fontSize: 16}}
            >
              <AddRoundedIcon aria-hidden sx={{fontSize: 22}} />
              Dodaj
            </SolidButton>
          </Box>
        </Box>

        <SectionLabel id="nl-gathering">Okupljanje</SectionLabel>
        <Box role="group" aria-labelledby="nl-gathering" sx={{...adminCardSx, gap: "14px"}}>
          <TimeField label={TIME_LABEL} value={startTime} onChange={setStartTime} clearLabel="Ukloni vrijeme okupljanja" soft inputSx={inputSx} />
          <PlaceFields value={place} onChange={setPlace} inputSx={inputSx} />
        </Box>
      </ScrollArea>
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px"}}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton icon={<EmojiEventsRoundedIcon />} onClick={create} disabled={!ok} loading={submitting} sx={ok ? undefined : {boxShadow: shadow.card}}>
          Kreiraj ligu
        </PrimaryButton>
      </Box>
    </Screen>
  );
}
