"use client";

import useBurza from "@/app/_hooks/useBurza";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useMySchedule from "@/app/_hooks/useMySchedule";
import useLogout from "@/app/_hooks/useLogout";
import {OpenTable} from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {currentLeagueHref} from "@/app/_lib/league";
import {color, font, shadow, teamOnNavy, tint} from "@/app/_styles/tokens";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import {BurzaHomeCard, HomeTile, NextNightCard, NextNightPlaceholder, nextNight} from "@/app/_ui/home/HomeCards";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import {buttonBase, Card, ellipsis, ErrorNote, IconCircleButton, Screen, SectionLabel, Spinner, TeamDot, TextButton} from "@/app/_ui/sp";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import LibraryAddRoundedIcon from "@mui/icons-material/LibraryAddRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {Box} from "@mui/material";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React from "react";

export default function PhoneHome({
  isAdmin,
  openTable,
  openTableLoading = false,
}: {
  isAdmin: boolean;
  openTable: OpenTable | null;
  openTableLoading?: boolean;
}) {
  const router = useTransitionRouter();
  const leagueId = useSelectedLeagueId();
  const {logout, loggingOut} = useLogout();
  const {start, starting, error} = useStartGame();
  const {schedule, error: scheduleError} = useMySchedule();
  const next = nextNight(schedule);
  const {posts} = useBurza();

  return (
    <Screen>
      <Box component="header" sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", px: "4px", pb: "16px"}}>
        <Box component="h1" sx={{m: 0, fontWeight: "inherit"}}>
          <Brand size={44} />
        </Box>
        <IconCircleButton label="Moj profil" onClick={() => router.push("/profile")}>
          <AccountCircleRoundedIcon />
        </IconCircleButton>
      </Box>

      {/* the table to play tonight; the rest of the week, the team's next night */}
      {openTable || openTableLoading ? (
        <StartCard table={openTable} starting={starting} onStart={start} errorId={error ? "start-error" : undefined} />
      ) : next ? (
        <NextNightCard league={next.league} night={next.night} today={schedule!.today} />
      ) : schedule || scheduleError ? (
        <NoRoundCard />
      ) : (
        <NextNightPlaceholder />
      )}
      {error && (
        <Box id="start-error">
          <ErrorNote>{error}</ErrorNote>
        </Box>
      )}

      <BurzaHomeCard posts={posts} />

      <Box component="nav" aria-label="Izbornik" sx={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "8px"}}>
        <HomeTile href={next ? `/raspored?league=${next.league.league_id}` : "/raspored"} icon={<EventRoundedIcon />} label="Raspored" />
        <HomeTile href={currentLeagueHref("daily-standings", leagueId)} icon={<CalendarMonthRoundedIcon />} label="Dnevni poredak" />
        <HomeTile href={currentLeagueHref("standings", leagueId)} icon={<EmojiEventsRoundedIcon />} label="Ukupni poredak" />
        <HomeTile href="/ratings" icon={<LeaderboardRoundedIcon />} label="Rejting" />
      </Box>

      {isAdmin && (
        <Box component="section" aria-labelledby="admin-controls" sx={{display: "flex", flexDirection: "column", gap: "8px", mt: "6px"}}>
          <SectionLabel id="admin-controls">Admin Controls</SectionLabel>
          <Card component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", overflow: "hidden"}}>
            <AdminRow href="/createRound" icon={<AddCircleRoundedIcon />} label="Create Round" divider />
            <AdminRow href={currentLeagueHref("manage", leagueId)} icon={<TuneRoundedIcon />} label="Manage League" divider />
            <AdminRow href="/league/new" icon={<LibraryAddRoundedIcon />} label="Create League" divider />
            <AdminRow href="/teams" icon={<GroupAddRoundedIcon />} label="Manage Team" />
          </Card>
        </Box>
      )}

      <TextButton onClick={() => logout()} disabled={loggingOut} sx={{mt: "auto", alignSelf: "center"}}>
        <LogoutRoundedIcon />
        Log Out
      </TextButton>
      <InstallSheet />
    </Screen>
  );
}

// Start Game: the player's table of the open round (table number, both teams, and the score once a match is
// running, when it reads Continue Game). While the round is still loading it shows just the title.
function StartCard({table, starting, onStart, errorId}: {table: OpenTable | null; starting: boolean; onStart: () => void; errorId?: string}) {
  const live = table?.score != null;
  return (
    <Box
      component="button"
      type="button"
      onClick={onStart}
      disabled={starting}
      aria-busy={starting || undefined}
      aria-describedby={errorId}
      sx={{
        ...buttonBase,
        position: "relative",
        minHeight: 200,
        flex: "none",
        borderRadius: "24px",
        background: color.navy,
        color: color.white,
        p: "20px 20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "stretch",
        gap: "14px",
        textAlign: "left",
        boxShadow: shadow.hero,
        // grows into the scoreboard on Start Game (the board's root has the same name)
        viewTransitionName: "table",
        transition: "transform 120ms ease",
        "&:active:not(:disabled)": {transform: "scale(.98)"},
      }}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px"}}>
        {table ? (
          <Box sx={{display: "flex", flexDirection: "column", gap: "8px", minWidth: 0}}>
            <Box sx={{display: "flex", alignItems: "center", gap: "8px"}}>
              <Box component="span" sx={{height: 28, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: color.cream, color: color.navy, fontSize: 13, fontWeight: 800, letterSpacing: ".08em"}}>
                STOL {table.table ?? "–"}
              </Box>
              {table.smoking && <SmokingMark variant="onNavy" />}
              {live && (
                <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.cream, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums"}}>
                  {table.score![0]} : {table.score![1]}
                </Box>
              )}
            </Box>
            <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.2}}>
              {[table.myTeam, table.opponent].map((name, k) => (
                <TeamName key={k} name={name} side={k} conferences={table.conferences} />
              ))}
            </Box>
          </Box>
        ) : (
          <span />
        )}
        <Box
          component="span"
          aria-hidden
          sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center"}}
        >
          {starting ? <Spinner size={22} /> : <PlayArrowRoundedIcon sx={{fontSize: 32}} />}
        </Box>
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, whiteSpace: "nowrap"}}>
        {live ? "Continue Game" : "Start Game"}
      </Box>
    </Box>
  );
}

// side 0 is the player's own team. In a league with conferences the dot is the team's conference (with a white ring,
// as those colors are dark), otherwise the side's color.
function TeamName({name, side, conferences}: {name: string; side: number; conferences: OpenTable["conferences"]}) {
  const conference = conferences?.[side];
  return (
    <Box component="span" sx={{display: "flex", alignItems: "center", gap: "8px", minWidth: 0}}>
      {conferences ? (
        <TeamDot color={conference?.color ?? null} ring onNavy label={conference?.name} />
      ) : (
        <TeamDot color={teamOnNavy[side]} />
      )}
      <Box component="span" sx={ellipsis}>
        {name}
      </Box>
    </Box>
  );
}

// No open round for the player: the game can't start until an admin creates the round
function NoRoundCard() {
  return (
    <Box
      aria-disabled="true"
      sx={{
        height: 200,
        flex: "none",
        boxSizing: "border-box",
        borderRadius: "24px",
        background: color.lineFill,
        border: `1.5px dashed ${tint.navy[22]}`,
        color: color.faint,
        p: "20px 20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}>Nema otvorene runde</Box>
          <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.muted}}>Igra se otvara kad admin pokrene rundu.</Box>
        </Box>
        <Box
          component="span"
          aria-hidden
          sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: tint.navy[10], color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 28}}}
        >
          <LockRoundedIcon />
        </Box>
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1}}>
        Start Game
      </Box>
    </Box>
  );
}

function AdminRow({href, icon, label, divider = false}: {href: string; icon: React.ReactNode; label: string; divider?: boolean}) {
  return (
    <Box component="li">
      <Box
        component={TransitionLink}
        href={href}
        sx={{
          ...buttonBase,
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: "14px",
          px: "16px",
          fontSize: 16,
          fontWeight: 500,
          color: color.ink,
          textDecoration: "none",
          textAlign: "left",
          borderBottom: divider ? `1px solid ${color.line}` : "none",
          "&:active": {background: color.lineFill},
          "& > svg:first-of-type": {fontSize: 24, color: color.navy},
        }}
      >
        {icon}
        <Box component="span" sx={{flex: 1}}>
          {label}
        </Box>
        <ChevronRightRoundedIcon sx={{fontSize: 22, color: color.muted}} />
      </Box>
    </Box>
  );
}
