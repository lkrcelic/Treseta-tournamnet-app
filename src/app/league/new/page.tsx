"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {TeamExtendedResponse} from "@/app/_interfaces/team";
import {isByeTeam} from "@/app/_lib/bye";
import {matchesQuery, plural} from "@/app/_lib/ui/text";
import {createLeagueAPI} from "@/app/_fetchers/league/leagues";
import {END_DATE_ERROR, endsAfterStart} from "@/app/_interfaces/league";
import {invalidateLeagues} from "@/app/_hooks/useLeagues";
import {conferencesError} from "@/app/_lib/conferences";
import {generateNights, isIsoDate, nightLabel, sortNights} from "@/app/_lib/nights";
import {color, font, tint} from "@/app/_styles/tokens";
import {ConferenceDraft, ConferenceEditor, startingDrafts} from "@/app/_ui/league/ConferenceEditor";
import {
  buttonBase,
  Card,
  dateInputFix,
  DesktopOnlyNote,
  DesktopShell,
  ellipsis,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  LoadingRows,
  PrimaryButton,
  SearchInput,
  SuccessNote,
  SwitchTrack,
  TextField,
} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box} from "@mui/material";
import Link from "next/link";
import React, {useEffect, useMemo, useState} from "react";

const DAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const DAY_NAMES = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];

type TeamItem = {id: number; name: string; players: string};

// Nova liga is made on the desktop only (handoff §2: no admin editing on mobile); the phone says so
export default function CreateLeague() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <CreateLeagueDesktop /> : <DesktopOnlyNote />;
}

function CreateLeagueDesktop() {
  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [playDay, setPlayDay] = useState(1);
  const [roundsPerNight, setRoundsPerNight] = useState(3);
  // the nights filled in from the dates and the play day, minus the removed ones, plus the added ones
  const [removedNights, setRemovedNights] = useState<string[]>([]);
  const [extraNights, setExtraNights] = useState<string[]>([]);
  const [newNight, setNewNight] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamItem[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [created, setCreated] = useState<{id: number; text: string; conferences: boolean} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // conferences are named and colored here; the teams are put in them in Manage League
  const [withConferences, setWithConferences] = useState(false);
  const [conferenceDrafts, setConferenceDrafts] = useState<ConferenceDraft[]>(startingDrafts);
  const conferencesInvalid = withConferences ? conferencesError(conferenceDrafts) : null;

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
  const nights = useMemo(
    () => sortNights([...generateNights(startDate, endDate, playDay).filter((n) => !removedNights.includes(n)), ...extraNights]),
    [startDate, endDate, playDay, removedNights, extraNights]
  );
  const canAddNight = isIsoDate(newNight) && !nights.includes(newNight);
  const removeNight = (n: string) => {
    setRemovedNights((r) => [...r, n]);
    setExtraNights((e) => e.filter((x) => x !== n));
  };
  const addNight = () => {
    if (!canAddNight) return;
    setExtraNights((e) => [...e, newNight]);
    setRemovedNights((r) => r.filter((x) => x !== newNight));
    setNewNight("");
  };
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
    if (!endsAfterStart(startDate, endDate) || conferencesInvalid) return;
    setSubmitting(true);
    setSubmitError(null);
    const conferences = withConferences ? conferenceDrafts.map((c) => ({name: c.name.trim(), color: c.color})) : [];
    try {
      const league = await createLeagueAPI({
        league_name: name.trim(),
        season: season.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        play_day: playDay,
        rounds_per_night: roundsPerNight,
        team_ids: Array.from(selected),
        conferences,
        nights,
      });
      invalidateLeagues();
      const confText = conferences.length ? `, ${conferences.length} ${plural(conferences.length, "konferencija", "konferencije", "konferencija")}` : "";
      setCreated({
        id: league.league_id,
        text: `„${league.league_name}" je napravljena (${league.team_count} ${plural(league.team_count, "ekipa", "ekipe", "ekipa")}${confText}, ${DAY_NAMES[playDay]}, ${nights.length} ${plural(nights.length, "večer", "večeri", "večeri")}).`,
        conferences: conferences.length > 0,
      });
      setName("");
      setSelected(new Set());
      setWithConferences(false);
      setConferenceDrafts(startingDrafts());
      setRemovedNights([]);
      setExtraNights([]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Ligu nije moguće napraviti.");
    }
    setSubmitting(false);
  };

  const details = (
    <Box component="form" onSubmit={submit} noValidate sx={{display: "flex", flexDirection: "column", gap: "18px", flex: 1}}>
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
      <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,.7fr) minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>
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
          inputSx={{height: 52, borderRadius: "14px", fontSize: 16}}
        />
      </Box>
      <Box role="radiogroup" aria-labelledby="play-day" sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box id="play-day" sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
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
                color: playDay === i ? color.white : color.navy,
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
      <Box role="group" aria-labelledby="league-nights" sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
        <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between", px: "4px"}}>
          <Box id="league-nights" sx={{fontSize: 14, fontWeight: 600, color: color.ink2}}>
            League nights
          </Box>
          <Box component="span" aria-live="polite" sx={{fontSize: 13, color: color.muted}}>
            {nights.length} {nights.length === 1 ? "night" : "nights"}
          </Box>
        </Box>
        <Box sx={{fontSize: 13, lineHeight: 1.45, color: color.muted, px: "4px"}}>
          Filled in from start date, end date and play day. Remove a night that isn&apos;t played (holiday) or add an extra one.
        </Box>
        {nights.length > 0 && (
          <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: "6px"}}>
            {nights.map((n) => (
              <Box
                component="li"
                key={n}
                sx={{height: 36, display: "flex", alignItems: "center", gap: "2px", pl: "12px", pr: "4px", borderRadius: "18px", background: extraNights.includes(n) ? color.cream : color.paper, color: color.ink, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap"}}
              >
                {nightLabel(n)}
                <Box
                  component="button"
                  type="button"
                  onClick={() => removeNight(n)}
                  aria-label={`Remove the night ${nightLabel(n)}`}
                  sx={{...buttonBase, width: 28, height: 28, borderRadius: "50%", color: color.muted, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 18}, "&:hover": {background: tint.red[12], color: color.red}}}
                >
                  <CloseRoundedIcon />
                </Box>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{display: "flex", gap: "8px"}}>
          <Box
            component="input"
            type="date"
            aria-label="Extra night"
            value={newNight}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewNight(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNight();
              }
            }}
            sx={{...dateInputFix, flex: 1, minWidth: 0, height: 48, boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${color.border}`, background: color.paper2, px: "14px", font: "inherit", fontSize: 15, color: color.ink, outline: "none", "&:focus": {borderColor: color.navy, background: color.white}}}
          />
          <Box
            component="button"
            type="button"
            onClick={addNight}
            disabled={!canAddNight}
            sx={{...buttonBase, flex: "none", height: 48, px: "16px", border: `1.5px solid ${color.borderControl}`, borderRadius: "14px", background: color.white, color: color.navy, display: "flex", alignItems: "center", gap: "6px", fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.4}, "& svg": {fontSize: 20}}}
          >
            <AddRoundedIcon />
            Add night
          </Box>
        </Box>
      </Box>
      <Box role="group" aria-labelledby="rpn" sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", p: "12px 14px", borderRadius: "16px", background: color.paper2}}>
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
      <Box role="group" aria-labelledby="conf-title" sx={{display: "flex", flexDirection: "column", gap: "12px", p: "12px 14px", borderRadius: "16px", background: color.paper2}}>
        <Box
          component="button"
          type="button"
          role="switch"
          aria-checked={withConferences}
          aria-labelledby="conf-title"
          aria-describedby="conf-hint"
          onClick={() => {
            setWithConferences((on) => !on);
            setCreated(null);
          }}
          sx={{...buttonBase, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textAlign: "left", borderRadius: "10px"}}
        >
          <Box component="span" sx={{display: "flex", flexDirection: "column"}}>
            <Box id="conf-title" component="span" sx={{fontSize: 15, fontWeight: 600}}>
              Konferencije
            </Box>
            <Box id="conf-hint" component="span" sx={{fontSize: 13, color: color.muted}}>
              Skupine ekipa, svaka sa svojom bojom i vlastitom tablicom
            </Box>
          </Box>
          <SwitchTrack on={withConferences} />
        </Box>
        {withConferences && (
          <>
            <ConferenceEditor value={conferenceDrafts} onChange={setConferenceDrafts} />
            <Box sx={{fontSize: 13, color: color.muted, px: "2px"}}>Ekipe u konferencije rasporediš u Upravljanju ligom.</Box>
            {/* shown once a name is typed, so switching on doesn't open with an error */}
            {conferencesInvalid && conferenceDrafts.some((c) => c.name.trim()) && (
              <Box role="alert" sx={{fontSize: 14, fontWeight: 600, color: color.red, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
                <ErrorRoundedIcon />
                {conferencesInvalid}
              </Box>
            )}
          </>
        )}
      </Box>
      {submitError && <ErrorNote>{submitError}</ErrorNote>}
      {created && (
        <SuccessNote sx={{display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between", flexWrap: "wrap"}}>
          <span>{created.text}</span>
          <Box component={Link} href={`/league/${created.id}/manage${created.conferences ? "?view=teams" : ""}`} sx={{color: color.navy, fontWeight: 700}}>
            Manage League →
          </Box>
        </SuccessNote>
      )}
      <PrimaryButton type="submit" disabled={!name.trim() || !endsAfterStart(startDate, endDate) || !!conferencesInvalid} loading={submitting} sx={{mt: "auto"}}>
        {`Create league${count ? ` · ${count} teams` : ""}`}
      </PrimaryButton>
    </Box>
  );

  const teamList = (
    <>
      <Box sx={{flex: "none", p: "22px 20px 14px", display: "flex", flexDirection: "column", gap: "12px", borderBottom: `1px solid ${tint.navy[10]}`}}>
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
                    borderBottom: `1px solid ${color.divider}`,
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
                      background: on ? color.navy : color.white,
                      color: color.white,
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
