"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {TeamExtendedResponse} from "@/app/_interfaces/team";
import {isByeTeam} from "@/app/_lib/bye";
import {matchesQuery, plural} from "@/app/_lib/ui/text";
import {createLeagueAPI} from "@/app/_fetchers/league/leagues";
import {END_DATE_ERROR, endsAfterStart} from "@/app/_interfaces/league";
import {invalidateLeagues} from "@/app/_hooks/useLeagues";
import {color, font} from "@/app/_styles/tokens";
import {
  buttonBase,
  Card,
  DesktopShell,
  ellipsis,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  LoadingRows,
  PrimaryButton,
  Screen,
  ScreenTitle,
  SearchInput,
  SuccessNote,
  TextField,
} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box} from "@mui/material";
import Link from "next/link";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useEffect, useMemo, useState} from "react";

const DAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const DAY_NAMES = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];

type TeamItem = {id: number; name: string; players: string};

export default function CreateLeague() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();

  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [playDay, setPlayDay] = useState(1);
  const [roundsPerNight, setRoundsPerNight] = useState(3);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamItem[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [created, setCreated] = useState<{id: number; text: string} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((all: TeamExtendedResponse[]) =>
        setTeams(
          all
            .filter((t) => !isByeTeam(t.team_id))
            .map((t) => ({id: t.team_id, name: t.team_name, players: (t.teamPlayers ?? []).map((tp) => tp.player.username).join(" · ")}))
            .sort((a, b) => a.name.localeCompare(b.name, "hr"))
        )
      )
      .catch(() => setTeamsError("Ekipe nije moguće učitati."));
  }, []);

  const visible = useMemo(() => (teams ?? []).filter((t) => matchesQuery(t.name, query)), [teams, query]);
  const count = selected.size;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setNameError("Upiši ime lige.");
      return;
    }
    if (!endsAfterStart(startDate, endDate)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const league = await createLeagueAPI({
        league_name: name.trim(),
        season: season.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        play_day: playDay,
        rounds_per_night: roundsPerNight,
        team_ids: Array.from(selected),
      });
      invalidateLeagues();
      setCreated({
        id: league.league_id,
        text: `„${league.league_name}" je napravljena (${league.team_count} ${plural(league.team_count, "ekipa", "ekipe", "ekipa")}, ${DAY_NAMES[playDay]}).`,
      });
      setName("");
      setSelected(new Set());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Ligu nije moguće napraviti.");
    }
    setSubmitting(false);
  };

  const details = (
    <Box component="form" id="create-league" onSubmit={submit} noValidate sx={{display: "flex", flexDirection: "column", gap: "18px", flex: 1}}>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
        League details
      </Box>
      <TextField
        label="League name"
        placeholder="e.g. Proljetna liga 2026"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(undefined);
          setCreated(null);
        }}
        error={nameError}
        soft
        inputSx={{height: 52, borderRadius: "14px", fontSize: 16}}
      />
      {/* the phone puts the end date on its own row */}
      <Box sx={{display: "grid", gridTemplateColumns: isDesktop ? "minmax(0,.7fr) minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>
        <TextField label="Season" placeholder="2026" inputMode="numeric" value={season} onChange={(e) => setSeason(e.target.value)} soft inputSx={{height: 52, borderRadius: "14px", fontSize: 16}} />
        <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} soft inputSx={{height: 52, borderRadius: "14px", fontSize: 16}} />
        <TextField
          label="End date"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
          error={endsAfterStart(startDate, endDate) ? undefined : END_DATE_ERROR}
          soft
          sx={isDesktop ? undefined : {gridColumn: "1 / -1"}}
          inputSx={{height: 52, borderRadius: "14px", fontSize: 16}}
        />
      </Box>
      <Box role="radiogroup" aria-labelledby="play-day" sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box id="play-day" sx={{fontSize: 14, fontWeight: 600, color: color.inkSoft, pl: "4px"}}>
          Play day
        </Box>
        <Box sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: "6px"}}>
          {DAYS.map((d, i) => (
            <Box
              key={d}
              component="button"
              type="button"
              role="radio"
              aria-checked={playDay === i}
              aria-label={DAY_NAMES[i]}
              onClick={() => setPlayDay(i)}
              sx={{
                ...buttonBase,
                height: 48,
                borderRadius: "12px",
                background: playDay === i ? color.navy : color.paper,
                color: playDay === i ? "#FFFFFF" : color.navy,
                fontSize: 14,
                fontWeight: 700,
                transition: "background 160ms ease",
              }}
            >
              {d}
            </Box>
          ))}
        </Box>
      </Box>
      <Box role="group" aria-labelledby="rpn" sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", p: "12px 14px", borderRadius: "16px", background: color.tableHead}}>
        <Box sx={{display: "flex", flexDirection: "column"}}>
          <Box id="rpn" component="span" sx={{fontSize: 15, fontWeight: 600}}>
            Rounds per night
          </Box>
          <Box component="span" sx={{fontSize: 13, color: color.muted}}>
            Default for Create Round
          </Box>
        </Box>
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          <IconCircleButton label="Manje kola po večeri" size={44} onClick={() => setRoundsPerNight((r) => Math.max(1, r - 1))} disabled={roundsPerNight <= 1} sx={{borderRadius: "12px", "& svg": {fontSize: 22}}}>
            <RemoveRoundedIcon />
          </IconCircleButton>
          <Box component="output" aria-live="polite" sx={{minWidth: 28, textAlign: "center", fontFamily: font.display, fontSize: 28, fontWeight: 800}}>
            {roundsPerNight}
          </Box>
          <IconCircleButton label="Više kola po večeri" size={44} onClick={() => setRoundsPerNight((r) => Math.min(6, r + 1))} disabled={roundsPerNight >= 6} sx={{borderRadius: "12px", "& svg": {fontSize: 22}}}>
            <AddRoundedIcon />
          </IconCircleButton>
        </Box>
      </Box>
      {submitError && <ErrorNote>{submitError}</ErrorNote>}
      {created && (
        <SuccessNote sx={{display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between", flexWrap: "wrap"}}>
          <span>{created.text}</span>
          <Box component={Link} href={`/league/${created.id}/manage`} sx={{color: color.navy, fontWeight: 700}}>
            Manage League →
          </Box>
        </SuccessNote>
      )}
      {isDesktop && submitButton()}
    </Box>
  );

  function submitButton() {
    return (
      <PrimaryButton type="submit" form="create-league" disabled={!name.trim() || !endsAfterStart(startDate, endDate)} loading={submitting} sx={{mt: "auto"}}>
        {`Create league${count ? ` · ${count} teams` : ""}`}
      </PrimaryButton>
    );
  }

  const teamList = (
    <>
      <Box sx={{flex: "none", p: "22px 20px 14px", display: "flex", flexDirection: "column", gap: "12px", borderBottom: `1px solid rgba(60,74,103,.1)`}}>
        <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between"}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
            Teams
          </Box>
          <Box aria-live="polite" sx={{fontSize: 14, color: color.muted}}>
            {count} selected
          </Box>
        </Box>
        <SearchInput soft height={48} placeholder="Search teams" aria-label="Traži ekipe" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Box sx={{fontSize: 13, color: color.muted}}>Optional. You can add teams later in Manage League.</Box>
      </Box>
      {teamsError ? (
        <ErrorNote sx={{m: "14px"}}>{teamsError}</ErrorNote>
      ) : teams == null ? (
        <LoadingRows rows={8} height={56} />
      ) : visible.length === 0 ? (
        <EmptyState>Nijedna ekipa ne odgovara pretrazi.</EmptyState>
      ) : (
        <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable"}}>
          {visible.map((t) => {
            const on = selected.has(t.id);
            return (
              <Box component="li" key={t.id}>
                <Box
                  component="button"
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(t.id)}
                  sx={{
                    ...buttonBase,
                    width: "100%",
                    minHeight: 56,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    pl: "20px",
                    pr: "16px",
                    borderBottom: `1px solid rgba(60,74,103,.07)`,
                    textAlign: "left",
                  }}
                >
                  <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                    <Box component="span" sx={{fontSize: 15, fontWeight: 600, color: color.ink, ...ellipsis}}>
                      {t.name}
                    </Box>
                    <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                      {t.players || "—"}
                    </Box>
                  </Box>
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      width: 26,
                      height: 26,
                      flex: "none",
                      boxSizing: "border-box",
                      borderRadius: "8px",
                      border: `2px solid ${on ? color.navy : color.borderStrong}`,
                      background: on ? color.navy : color.card,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckRoundedIcon sx={{fontSize: 18, opacity: on ? 1 : 0}} />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <DesktopShell active="createLeague" eyebrow="Admin" title="Create League">
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "20px"}}>
          <Box sx={{minHeight: 0, display: "flex", flexDirection: "column", gap: "16px"}}>
            <Card sx={{flex: 1, p: "26px", display: "flex", flexDirection: "column", borderRadius: "24px", overflowY: "auto"}}>{details}</Card>
          </Box>
          <Card component="section" aria-label="Ekipe nove lige" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
            {teamList}
          </Card>
        </Box>
      </DesktopShell>
    );
  }

  return (
    <Screen>
      <Box>
        <IconCircleButton label="Nazad" onClick={() => router.push("/", "back")}>
          <ArrowBackRoundedIcon />
        </IconCircleButton>
      </Box>
      <ScreenTitle eyebrow="Admin" title="Create League" sx={{pt: "4px", pb: "8px"}} />
      <Card sx={{p: "20px", display: "flex", flexDirection: "column"}}>{details}</Card>
      <Card component="section" aria-label="Ekipe nove lige" sx={{display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: 520}}>
        {teamList}
      </Card>
      {submitButton()}
    </Screen>
  );
}
