"use client";

import {banPlayerAPI, banTeamAPI, changeBanAPI, getPlayerBanAPI, getTeamBanAPI, liftBanAPI} from "@/app/_fetchers/tournament";
import {BAN_LENGTHS, BAN_UNITS, BanLength, BanUnit, banDay, banDayShort, banDaysLeft, banUntil, untilLabel} from "@/app/_lib/bans";
import {leagueDateString} from "@/app/_lib/dates";
import type {BanView} from "@/app/_lib/service/bans/bans";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, Card, ConfirmSheet, ErrorNote, OutlineButton, PrimaryButton, Spinner, TextInput} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckBoxOutlineBlankRoundedIcon from "@mui/icons-material/CheckBoxOutlineBlankRounded";
import CheckBoxRoundedIcon from "@mui/icons-material/CheckBoxRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditCalendarRoundedIcon from "@mui/icons-material/EditCalendarRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box, Dialog} from "@mui/material";
import React, {useCallback, useEffect, useState} from "react";

// Zabrana prijava on the admin's Ekipa and Igrač (Claude Design "Zabrana prijava" Z1–Z7 on the phone, ZD1–ZD3 on the
// computer): whether the team or player may sign up for tournaments, Zabrani prijave (how long, which of the team's
// players too, the reason only admins see), and while a ban holds Promijeni and Ukini (a team's also for its players).
// A player banned through a team says so ("preko ekipe"). The ban runs out by itself; there are no notices.

export type BanTarget = {kind: "team"; id: number; name: string; players: {id: number; name: string; username: string | null}[]} | {kind: "player"; id: number; name: string};

type State = {ban: BanView | null};

// "Zabranjena do 8. 11. 2026" / "Zabranjena trajno" (a player: Zabranjen)
export function bannedTitle(ban: Pick<BanView, "until">, kind: "team" | "player"): string {
  const word = kind === "team" ? "Zabranjena" : "Zabranjen";
  return ban.until ? `${word} do ${banDay(ban.until)}` : `${word} trajno`;
}

// The tag beside a name: "Zabranjena do 8. 11." / "Trajno"
export function BanTag({ban, kind}: {ban: Pick<BanView, "until">; kind: "team" | "player"}) {
  return (
    <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: "4px", height: 26, px: "8px", borderRadius: "8px", background: tint.red[10], color: color.red, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", "& svg": {fontSize: 15}}}>
      <BlockRoundedIcon aria-hidden />
      {ban.until ? `${kind === "team" ? "Zabranjena" : "Zabranjen"} do ${banDayShort(ban.until)}` : "Trajno"}
    </Box>
  );
}

function setBy(ban: BanView): string {
  const day = banDayShort(leagueDateString(new Date(ban.created_at)));
  return ban.created_by ? `Postavio ${ban.created_by.split(" ")[0]}, ${day}` : `Postavila aplikacija, ${day} (nedolazak u 1. kolu)`;
}

export default function BanSection({target, desktop = false}: {target: BanTarget; desktop?: boolean}) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | "change" | null>(null);
  const [lifting, setLifting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [withPlayers, setWithPlayers] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = target.kind === "team" ? await getTeamBanAPI(target.id) : await getPlayerBanAPI(target.id);
      setState({ban: s.ban});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zabrana se nije učitala.");
    }
  }, [target.kind, target.id]);

  useEffect(() => {
    load();
  }, [load]);

  const lift = async () => {
    if (!state?.ban) return;
    setBusy(true);
    try {
      await liftBanAPI(state.ban.id, target.kind === "team" && withPlayers);
      setLifting(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zabrana nije ukinuta.");
    }
    setBusy(false);
  };

  const ban = state?.ban ?? null;
  const today = leagueDateString();
  const teamBan = target.kind === "team";
  const viaTeam = ban?.via_team ?? null;
  return (
    <Card component="section" aria-label="Zabrana prijava" sx={{flex: "none", p: desktop ? "14px 18px" : "16px", borderRadius: "22px", display: "flex", flexDirection: "column", gap: desktop ? "8px" : "12px"}}>
      <Box component="h2" sx={{m: 0, fontSize: desktop ? 18 : 12.5, fontWeight: 700, ...(desktop ? {fontFamily: font.display, fontWeight: 800} : {letterSpacing: ".1em", textTransform: "uppercase", color: color.muted})}}>
        Zabrana prijava
      </Box>
      {!state && !error ? (
        <Spinner size={22} />
      ) : ban ? (
        <Box sx={{display: "flex", flexDirection: desktop ? "row" : "column", alignItems: desktop ? "center" : "stretch", gap: "12px"}}>
          <Box sx={{flex: 1, minWidth: 0, display: "flex", gap: "12px", p: "12px 14px", borderRadius: "16px", background: tint.red[8]}}>
            <BlockRoundedIcon aria-hidden sx={{fontSize: 24, color: color.red, flex: "none", mt: "1px"}} />
            <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
              <Box component="span" sx={{fontSize: 16, fontWeight: 700, color: color.red}}>
                {bannedTitle(ban, target.kind)}
              </Box>
              <Box component="span" sx={{fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
                {viaTeam
                  ? `Preko ekipe ${viaTeam.team_name}. Ne može prijaviti nijednu ekipu, a njegove ekipe ne igraju ni u ligi.`
                  : [
                      ban.until ? `Još ${banDaysLeft(ban.until, today)} ${banDaysLeft(ban.until, today) === 1 ? "dan" : "dana"}.` : null,
                      // the date ("31. 10.") already ends the sentence
                      setBy(ban).replace(/\.?$/, "."),
                      teamBan
                        ? ban.players.length === 0
                          ? "Samo ekipa, ne igrači."
                          : ban.players.length >= (target.kind === "team" ? target.players.length : 0)
                            ? "Vrijedi i za igrače."
                            : `Vrijedi i za: ${ban.players.map((p) => p.name).join(", ")}.`
                        : "Samo igrač, ne ekipa.",
                      // DECISIONS #73: a ban keeps the team (a player's: their teams) from the league's nights too
                      teamBan ? "Ne igra ni u ligi." : "Njegove ekipe ne igraju ni u ligi.",
                    ]
                      .filter(Boolean)
                      .join(" ")}
              </Box>
              {ban.reason && (
                <Box component="span" sx={{fontSize: 14, color: color.ink}}>
                  Razlog: {ban.reason}
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{display: "flex", gap: "10px", ...(desktop && {flex: "none", width: 300})}}>
            <OutlineButton height={46} onClick={() => setEditing("change")} sx={{flex: 1, fontSize: 15, borderWidth: "1.5px", "& svg": {fontSize: 20}}}>
              <EditCalendarRoundedIcon aria-hidden />
              Promijeni
            </OutlineButton>
            <OutlineButton height={46} tone={color.red} onClick={() => setLifting(true)} sx={{flex: 1, fontSize: 15, borderWidth: "1.5px", "& svg": {fontSize: 20}}}>
              <LockOpenRoundedIcon aria-hidden />
              Ukini
            </OutlineButton>
          </Box>
        </Box>
      ) : state ? (
        <Box sx={{display: "flex", flexDirection: desktop ? "row" : "column", alignItems: desktop ? "center" : "stretch", gap: "12px"}}>
          <Box sx={{flex: 1, display: "flex", alignItems: "center", gap: "10px"}}>
            <CheckCircleRoundedIcon aria-hidden sx={{fontSize: 24, color: color.green}} />
            <Box sx={{display: "flex", flexDirection: "column"}}>
              <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
                Može se prijavljivati
              </Box>
              <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
                Nema aktivne zabrane.
              </Box>
            </Box>
          </Box>
          <OutlineButton height={48} tone={color.red} onClick={() => setEditing("new")} sx={{fontSize: 15, borderWidth: "1.5px", "& svg": {fontSize: 20}, ...(desktop && {flex: "none", width: 300})}}>
            <BlockRoundedIcon aria-hidden />
            {teamBan ? "Zabrani prijave ekipi" : "Zabrani prijave igraču"}
          </OutlineButton>
        </Box>
      ) : null}
      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}
      {editing && (
        <BanEditor
          target={target}
          desktop={desktop}
          existing={editing === "change" ? ban : null}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      <ConfirmSheet
        open={lifting}
        onClose={() => setLifting(false)}
        onConfirm={lift}
        title={teamBan ? `Ukinuti zabranu ekipi ${target.name}?` : `Ukinuti zabranu igraču ${target.name}?`}
        text={
          teamBan
            ? "Ekipa se odmah može prijavljivati na turnire i igrati u ligi."
            : viaTeam
              ? `Zabrana preko ekipe ${viaTeam.team_name} prestaje za ovog igrača.`
              : "Igrač se odmah može prijavljivati na turnire, a njegove ekipe igrati u ligi."
        }
        action="Ukini zabranu"
        icon={<LockOpenRoundedIcon />}
        danger={false}
        busy={busy}
        error={null}
        extra={
          teamBan && ban && ban.players.length > 0 ? (
            <Box component="button" type="button" role="checkbox" aria-checked={withPlayers} onClick={() => setWithPlayers((w) => !w)} sx={{...buttonBase, display: "flex", alignItems: "center", gap: "10px", p: "10px 4px", textAlign: "left"}}>
              {withPlayers ? <CheckBoxRoundedIcon sx={{color: color.navy}} /> : <CheckBoxOutlineBlankRoundedIcon sx={{color: color.faint}} />}
              <Box sx={{display: "flex", flexDirection: "column"}}>
                <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
                  Ukini i igračima
                </Box>
                <Box component="span" sx={{fontSize: 13, color: color.ink2}}>
                  {ban.players.map((p) => p.name).join(" · ")}
                </Box>
              </Box>
            </Box>
          ) : undefined
        }
      />
    </Card>
  );
}

const chip = (on: boolean) =>
  ({
    ...buttonBase,
    height: 40,
    px: "14px",
    borderRadius: "12px",
    border: `1.5px solid ${on ? color.navy : color.line}`,
    background: on ? color.navy : color.white,
    color: on ? color.white : color.ink,
    fontSize: 14.5,
    fontWeight: 700,
  }) as const;

const label = {fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted} as const;

// How long, the players (a team), the reason, and Zabrani do … (or Spremi promjenu)
function BanEditor({target, desktop, existing, onClose, onSaved}: {target: BanTarget; desktop: boolean; existing: BanView | null; onClose: () => void; onSaved: () => void}) {
  const today = leagueDateString();
  const [length, setLength] = useState<BanLength>(existing ? (existing.until ? "custom" : "forever") : "month");
  const [n, setN] = useState(existing?.until ? banDaysLeft(existing.until, today) : 10);
  const [unit, setUnit] = useState<BanUnit>("days");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const players = target.kind === "team" ? target.players : [];
  const [picked, setPicked] = useState<number[]>(existing ? existing.players.map((p) => p.id) : players.map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const until = banUntil(today, length, {n, unit});

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {until, reason: reason.trim(), ...(target.kind === "team" && {player_ids: picked})};
      if (existing) await changeBanAPI(existing.id, body);
      else if (target.kind === "team") await banTeamAPI(target.id, body);
      else await banPlayerAPI(target.id, body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zabrana nije spremljena.");
      setBusy(false);
    }
  };

  const body = (
    <Box sx={{display: "flex", flexDirection: "column", gap: "14px"}}>
      <Box sx={{fontSize: 14.5, color: color.ink2}}>Ne može se prijaviti ni na jedan turnir dok zabrana traje.</Box>
      <Box sx={label}>Trajanje</Box>
      <Box role="radiogroup" aria-label="Trajanje" sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
        {BAN_LENGTHS.map((l) => (
          <Box key={l.key} component="button" type="button" role="radio" aria-checked={length === l.key} onClick={() => setLength(l.key)} sx={chip(length === l.key)}>
            {l.label}
          </Box>
        ))}
      </Box>
      {length === "custom" && (
        <Box sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
          <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
            <Box component="button" type="button" aria-label="Manje" onClick={() => setN((x) => Math.max(1, x - 1))} sx={{...chip(false), width: 44, px: 0, display: "flex", alignItems: "center", justifyContent: "center"}}>
              <RemoveRoundedIcon />
            </Box>
            <Box component="span" sx={{minWidth: 44, textAlign: "center", fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
              {n}
            </Box>
            <Box component="button" type="button" aria-label="Više" onClick={() => setN((x) => Math.min(999, x + 1))} sx={{...chip(false), width: 44, px: 0, display: "flex", alignItems: "center", justifyContent: "center"}}>
              <AddRoundedIcon />
            </Box>
          </Box>
          <Box role="radiogroup" aria-label="Jedinica" sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
            {BAN_UNITS.map((u) => (
              <Box key={u.key} component="button" type="button" role="radio" aria-checked={unit === u.key} onClick={() => setUnit(u.key)} sx={chip(unit === u.key)}>
                {u.label}
              </Box>
            ))}
          </Box>
        </Box>
      )}
      <Box sx={{display: "flex", alignItems: "center", gap: "8px", p: "10px 12px", borderRadius: "14px", background: color.paper, fontSize: 15, fontWeight: 700, "& svg": {fontSize: 20, color: color.navy}}}>
        <EventRoundedIcon aria-hidden />
        {untilLabel(until)}
      </Box>
      {players.length > 0 && (
        <>
          <Box sx={label}>Vrijedi i za igrače</Box>
          <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
            {players.map((p) => {
              const on = picked.includes(p.id);
              return (
                <Box
                  key={p.id}
                  component="button"
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id]))}
                  sx={{...buttonBase, display: "flex", alignItems: "center", gap: "10px", p: "8px 4px", textAlign: "left"}}
                >
                  {on ? <CheckBoxRoundedIcon sx={{color: color.navy}} /> : <CheckBoxOutlineBlankRoundedIcon sx={{color: color.faint}} />}
                  <Box sx={{display: "flex", flexDirection: "column"}}>
                    <Box component="span" sx={{fontSize: 15, fontWeight: 600}}>
                      {p.name}
                    </Box>
                    {p.username && (
                      <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                        @{p.username}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}
      <Box sx={label}>Razlog · nije obavezno</Box>
      <TextInput soft value={reason} maxLength={200} placeholder="Upiši razlog" onChange={(e) => setReason(e.target.value)} sx={{height: 50}} aria-label="Razlog" />
      {error && <ErrorNote>{error}</ErrorNote>}
      <PrimaryButton icon={<BlockRoundedIcon />} bg={color.red} loading={busy} onClick={save} sx={{height: 54, fontSize: 16}}>
        {existing ? "Spremi promjenu" : until ? `Zabrani do ${banDay(until)}` : "Zabrani trajno"}
      </PrimaryButton>
    </Box>
  );

  const title = `Zabrana prijava · ${target.name}`;
  return desktop ? (
    <Dialog open onClose={busy ? undefined : onClose} PaperProps={{sx: {width: 520, maxWidth: "calc(100% - 40px)", borderRadius: "26px", p: "24px", boxShadow: shadow.sheet}}}>
      <Box component="h2" sx={{m: "0 0 12px", fontFamily: font.display, fontSize: 24, fontWeight: 800}}>
        {title}
      </Box>
      {body}
      <OutlineButton height={46} onClick={onClose} disabled={busy} sx={{mt: "10px", borderWidth: "1.5px", borderColor: color.line}}>
        Odustani
      </OutlineButton>
    </Dialog>
  ) : (
    <BottomSheet open onClose={onClose} title={title} closable busy={busy}>
      {body}
    </BottomSheet>
  );
}
