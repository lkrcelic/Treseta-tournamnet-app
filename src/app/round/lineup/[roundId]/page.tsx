"use client";

import {createOngoingMatchAPI} from "@/app/_fetchers/ongoingMatch/create";
import {getLineupAPI, saveLineupAPI} from "@/app/_fetchers/round/lineup";
import useAdminPhone from "@/app/_hooks/useAdminPhone";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import AdminBadge from "@/app/_ui/admin/AdminBadge";
import type {Lineup, LineupMember, LineupTeam} from "@/app/_lib/service/round/lineup";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, teamColor, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, CenteredSpinner, DesktopOnlyNote, DesktopShell, ErrorNote, IconCircleButton, InitialsAvatar, PrimaryButton, Screen, ScrollArea} from "@/app/_ui/sp";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useState} from "react";

// Započni igru · who plays this round (Claude Design 7c "Lineup card", desktop "tko igra"). Shown before the
// scoreboard of the round's first match: two players per team, suggested from the team's last round in the league
// (or its founders in the league's first round). A slot opens to swap in a teammate who isn't playing.
// With ?league=, an admin is opening the table's scorepad from Dnevni poredak: confirming goes on to that scorepad, where
// the admin's first hand starts the match (on the admin's phone, to the first match's board; admin-mobile 24). Anyone
// else on the phone gets the desktop-only note there.

const TITLE = "Tko igra ovu rundu?";
// the slot's background while it is open, per side (viewer's team green, opponent red)
const TINT = [tint.green[9], tint.red[8]] as const;
const NOTES = [
  {icon: <InsightsRoundedIcon />, text: "Ovi podaci potrebni su za izračun rejtinga svakog igrača."},
  {icon: <PersonAddRoundedIcon />, text: "Igrač nije na popisu? Neka napravi račun i javi se administratoru da ga doda u tim."},
];

export default function LineupPage() {
  const {roundId} = useParams<{roundId: string}>();
  const id = Number(roundId);
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const adminPhone = useAdminPhone();
  const search = useSearchParams();
  const padLeague = Number(search.get("league")) || null;
  // the admin's phone opened it with Tko igra on the table's board (rather than on the way into a table not started)
  const fromPad = search.get("from") === "pad";
  const [lineup, setLineup] = useState<Lineup | null>(null);
  // the viewer's team first; selection per team, slot by slot
  const [teams, setTeams] = useState<LineupTeam[]>([]);
  const [selected, setSelected] = useState<number[][]>([[], []]);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getLineupAPI(id);
      const ordered = data.teams[1].mine && !data.teams[0].mine ? [data.teams[1], data.teams[0]] : [...data.teams];
      setLineup(data);
      setTeams(ordered);
      setSelected(ordered.map((t) => t.selected));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Ekipe nije moguće učitati.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (team: number, slot: number, playerId: number) => {
    setSelected((prev) => prev.map((ids, ti) => (ti === team ? ids.map((p, si) => (si === slot ? playerId : p)) : ids)));
    setOpenSlot(null);
  };

  const ready = teams.length === 2 && teams.every((t, i) => selected[i].length === t.needed && t.needed > 0);

  const confirm = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLineupAPI(id, {teams: teams.map((t, i) => ({team_id: t.id, player_ids: selected[i]}))});
      if (padLeague) {
        // back to the board it was opened from (which loads the table again), or on to the table's board
        if (fromPad && !isDesktop && window.history.length > 1) router.back();
        else router.replace(`/league/${padLeague}/daily-standings/table/${id}`);
        return;
      }
      const match = await createOngoingMatchAPI({round_id: id, score_threshold: MATCH_THRESHOLD});
      // replace: back from the scoreboard goes Home, not to this screen
      router.replace(`/ongoing-match/${match.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Igru nije moguće pokrenuti.");
      setSaving(false);
    }
  };

  const label = lineup ? [lineup.table != null && `Stol ${lineup.table}`, lineup.roundNumber != null && `Runda ${lineup.roundNumber}`].filter(Boolean).join(" · ") : "";
  const back = () => {
    // the admin's phone came from the table: back to it
    if (padLeague && !isDesktop) {
      if (window.history.length > 1) router.back();
      else router.push(`/league/${padLeague}/daily-standings/table/${id}`, "back");
      return;
    }
    router.push(padLeague ? `/league/${padLeague}/daily-standings` : "/", "back");
  };

  const slots = (t: LineupTeam, ti: number, big: boolean) => (
    <TeamSlots team={t} side={ti} selected={selected[ti]} openSlot={openSlot} onToggle={setOpenSlot} onPick={(s, p) => pick(ti, s, p)} big={big} />
  );
  const status = loadError ? <ErrorNote onRetry={load}>{loadError}</ErrorNote> : !lineup ? <CenteredSpinner /> : null;
  const footer = (
    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px"}}>
      {saveError && <ErrorNote sx={{alignSelf: "stretch"}}>{saveError}</ErrorNote>}
      <Box aria-hidden sx={{fontFamily: font.display, fontSize: isDesktop ? 15 : 14, fontWeight: 700, color: color.muted}}>
        ♠ Neka bolji pobijedi ♥
      </Box>
      <PrimaryButton
        onClick={confirm}
        disabled={!ready}
        loading={saving}
        height={isDesktop ? 60 : 62}
        sx={{borderRadius: "20px", fontWeight: 700, ...(isDesktop && {width: "auto", minWidth: 320, px: "32px"}), "& > span": {display: "flex", alignItems: "center", gap: "8px"}}}
      >
        Potvrdi i počni
        {!saving && <PlayArrowRoundedIcon />}
      </PrimaryButton>
    </Box>
  );

  if (padLeague && !isDesktop && !adminPhone) return <DesktopOnlyNote />;
  if (isDesktop) {
    return (
      <DesktopShell
        active={padLeague ? "daily" : "game"}
        back={padLeague ? {label: "Dnevni poredak", href: `/league/${padLeague}/daily-standings`} : undefined}
        eyebrow={label || "Započni igru"}
        title={TITLE}
      >
        {status ?? (
          <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "flex", justifyContent: "center"}}>
            <Box sx={{width: "100%", maxWidth: 980, display: "flex", flexDirection: "column", gap: "20px"}}>
              <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", gap: "16px", alignItems: "start"}}>
                {teams.map((t, ti) => (
                  <React.Fragment key={t.id}>
                    {ti === 1 && (
                      <Box aria-hidden sx={{alignSelf: "center", fontFamily: font.display, fontSize: 22, fontWeight: 800, color: color.muted}}>
                        vs
                      </Box>
                    )}
                    <Card component="section" aria-label={t.name} sx={{borderRadius: "24px", p: "16px 12px 10px", display: "flex", flexDirection: "column", gap: "4px"}}>
                      <Box component="h2" sx={{m: 0, display: "flex", alignItems: "center", gap: "10px", px: "8px", pb: "6px"}}>
                        <Box component="span" aria-hidden sx={{width: 12, height: 12, flex: "none", borderRadius: "50%", background: teamColor[ti]}} />
                        <TeamName side={ti} size={14}>{t.name}</TeamName>
                      </Box>
                      {slots(t, ti, true)}
                    </Card>
                  </React.Fragment>
                ))}
              </Box>
              <Notes centered />
              {footer}
            </Box>
          </Box>
        )}
      </DesktopShell>
    );
  }

  return (
    <Screen fill gap={12} sx={{px: 0}}>
      <Box sx={{display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 44px", alignItems: "center", px: "14px"}}>
        <IconCircleButton label="Natrag" size={44} onClick={back}>
          <ChevronLeftRoundedIcon sx={{fontSize: 26}} />
        </IconCircleButton>
        <Box sx={{textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: color.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
          {label}
        </Box>
        {padLeague && <AdminBadge />}
      </Box>
      <ScrollArea sx={{px: "20px", pt: "2px", pb: "12px"}}>
        <Box component="h1" sx={{m: 0, px: "4px", fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-.02em", textWrap: "pretty"}}>
          {TITLE}
        </Box>
        {status ?? (
          <>
            <Card sx={{borderRadius: "24px", py: "8px"}}>
              {teams.map((t, ti) => (
                <Box component="section" aria-label={t.name} key={t.id} sx={{display: "flex", flexDirection: "column"}}>
                  {ti === 1 && (
                    <Box aria-hidden sx={{display: "flex", alignItems: "center", gap: "10px", px: "16px", py: "4px", "& > i": {flex: 1, height: "1px", background: tint.navy[12]}}}>
                      <i />
                      <Box component="span" sx={{fontFamily: font.display, fontSize: 16, fontWeight: 800, color: color.muted}}>
                        vs
                      </Box>
                      <i />
                    </Box>
                  )}
                  <Box component="h2" sx={{m: 0, p: "8px 16px 4px", display: "flex"}}>
                    <TeamName side={ti} size={13}>{t.name}</TeamName>
                  </Box>
                  <Box sx={{px: "10px"}}>{slots(t, ti, false)}</Box>
                </Box>
              ))}
            </Card>
            <Notes />
          </>
        )}
      </ScrollArea>
      <Box sx={{px: "20px"}}>{footer}</Box>
    </Screen>
  );
}

function TeamName({side, size, children}: {side: number; size: number; children: React.ReactNode}) {
  return (
    <Box component="span" sx={{minWidth: 0, fontSize: size, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: teamColor[side], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
      {children}
    </Box>
  );
}

// A team's two seats; each opens a list of the teammates who aren't playing, and picking one takes the seat
function TeamSlots({
  team,
  side,
  selected,
  openSlot,
  onToggle,
  onPick,
  big,
}: {
  team: LineupTeam;
  side: number;
  selected: number[];
  openSlot: string | null;
  onToggle: (key: string | null) => void;
  onPick: (slot: number, playerId: number) => void;
  big: boolean;
}) {
  const byId = new Map(team.members.map((m) => [m.id, m]));
  if (team.needed === 0) {
    return <Box sx={{p: "8px 16px 12px", fontSize: 14, color: color.muted}}>Tim nema igrača.</Box>;
  }
  return (
    <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: big ? 0 : "8px", pb: big ? 0 : "4px"}}>
      {selected.map((playerId, s) => {
        const player = byId.get(playerId);
        const key = `${team.id}-${s}`;
        const open = openSlot === key;
        const others = team.members.filter((m) => !selected.includes(m.id));
        const listId = `lineup-${key}`;
        return (
          <Box component="li" key={key} sx={{display: "flex", flexDirection: "column", borderRadius: "16px", background: open ? TINT[side] : "transparent", transition: "background 160ms ease"}}>
            <Box
              component="button"
              type="button"
              onClick={() => onToggle(open ? null : key)}
              aria-expanded={open}
              aria-controls={listId}
              sx={{
                ...buttonBase,
                minHeight: big ? 64 : 60,
                display: "flex",
                alignItems: "center",
                gap: big ? "14px" : "12px",
                p: big ? "10px 10px 10px 12px" : "8px 8px 8px 10px",
                borderRadius: "16px",
                textAlign: "left",
                "&:hover": big ? {background: tint.navy[4]} : undefined,
              }}
            >
              <Avatar player={player} side={side} size={big ? 42 : 38} />
              <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                <Box component="span" sx={{fontSize: big ? 17 : 16, fontWeight: 600, color: color.ink, lineHeight: 1.25, textWrap: "pretty"}}>
                  {player?.name ?? "—"}
                </Box>
                {player && (
                  <Box component="span" sx={{fontSize: big ? 13.5 : 13, color: color.muted}}>
                    @{player.username}
                  </Box>
                )}
              </Box>
              <Box
                component="span"
                sx={{height: big ? 38 : 36, flex: "none", display: "flex", alignItems: "center", gap: "2px", pl: big ? "12px" : "10px", pr: big ? "8px" : "6px", borderRadius: "19px", background: color.paper, color: color.navy, fontSize: big ? 14 : 13, fontWeight: 600, "& svg": {fontSize: 20}}}
              >
                Promijeni
                {open ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              </Box>
            </Box>
            {open && (
              <Box id={listId} role="list" aria-label="Zamijeni igrača" sx={{display: "flex", flexDirection: "column", p: big ? "0 10px 10px 68px" : "0 8px 8px 60px"}}>
                {others.length > 0 ? (
                  others.map((m) => (
                    <Box
                      role="listitem"
                      component="button"
                      type="button"
                      key={m.id}
                      onClick={() => onPick(s, m.id)}
                      sx={{...buttonBase, minHeight: 48, display: "flex", alignItems: "center", p: big ? "6px 10px" : "6px 8px", borderTop: `1px solid ${color.line}`, fontSize: big ? 15.5 : 15, fontWeight: 500, color: color.ink, textAlign: "left", lineHeight: 1.25, "&:hover": big ? {background: tint.navy[4]} : undefined}}
                    >
                      {m.name}
                    </Box>
                  ))
                ) : (
                  <Box sx={{p: "10px", fontSize: 14, color: color.muted, borderTop: `1px solid ${color.line}`}}>Nema drugih igrača u timu.</Box>
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// The picked player's photo, or their initials on the team's colour
function Avatar({player, side, size}: {player?: LineupMember; side: number; size: number}) {
  return (
    <InitialsAvatar
      name={player?.name ?? ""}
      src={player?.photo_url}
      size={size}
      sx={{background: teamColor[side], color: color.white, fontFamily: "inherit", fontSize: size >= 42 ? 15 : 14, fontWeight: 700}}
    />
  );
}

function Notes({centered = false}: {centered?: boolean}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", alignItems: centered ? "center" : "stretch", gap: "10px", px: centered ? "8px" : "6px", pt: centered ? 0 : "2px"}}>
      {NOTES.map((n) => (
        <Box key={n.text} sx={{display: "flex", gap: "10px", alignItems: "flex-start", "& svg": {fontSize: centered ? 20 : 19, color: color.navy, flex: "none"}}}>
          {n.icon}
          <Box component="span" sx={{fontSize: centered ? 14.5 : 13.5, lineHeight: 1.45, color: color.ink2}}>
            {n.text}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
