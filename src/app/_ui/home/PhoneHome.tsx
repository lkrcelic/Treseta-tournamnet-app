"use client";

import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import {useMyRating} from "@/app/_hooks/useRatings";
import useLogout from "@/app/_hooks/useLogout";
import {OpenTable} from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {currentLeagueHref} from "@/app/_lib/league";
import {color, font, shadow} from "@/app/_styles/tokens";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {buttonBase, Card, ellipsis, ErrorNote, IconCircleButton, Screen, SectionLabel, Spinner, TextButton} from "@/app/_ui/sp";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
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

      {openTable || openTableLoading ? (
        <StartCard table={openTable} starting={starting} onStart={start} errorId={error ? "start-error" : undefined} />
      ) : (
        <NoRoundCard />
      )}
      {error && (
        <Box id="start-error">
          <ErrorNote>{error}</ErrorNote>
        </Box>
      )}

      <Box component="nav" aria-label="Poredak" sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
        <Tile href={currentLeagueHref("daily-standings", leagueId)} icon={<CalendarMonthRoundedIcon />} label="Daily Standings" />
        <Tile href={currentLeagueHref("standings", leagueId)} icon={<EmojiEventsRoundedIcon />} label="League Standings" />
      </Box>
      <RatingTile />

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

function Tile({href, icon, label}: {href: string; icon: React.ReactNode; label: string}) {
  return (
    <Box
      component={TransitionLink}
      href={href}
      sx={{
        ...buttonBase,
        height: 112,
        borderRadius: "22px",
        background: color.card,
        color: color.ink,
        p: "16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-start",
        textDecoration: "none",
        textAlign: "left",
        boxShadow: shadow.card,
        transition: "transform 120ms ease",
        "&:active": {transform: "scale(.98)"},
        "& svg": {fontSize: 28, color: color.navy},
      }}
    >
      {icon}
      <Box component="span" sx={{fontSize: 17, fontWeight: 600, lineHeight: 1.15}}>
        {label}
      </Box>
    </Box>
  );
}

// Rejting: the player's own rating and place, opening the ratings list
function RatingTile() {
  const {me, total} = useMyRating();
  return (
    <Box
      component={TransitionLink}
      href="/ratings"
      sx={{
        ...buttonBase,
        height: 76,
        flex: "none",
        borderRadius: "22px",
        background: color.card,
        color: color.ink,
        px: "16px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        textDecoration: "none",
        boxShadow: shadow.card,
        transition: "transform 120ms ease",
        "&:active": {transform: "scale(.98)"},
        "& > svg:first-of-type": {fontSize: 28, color: color.navy},
      }}
    >
      <LeaderboardRoundedIcon />
      <Box component="span" sx={{flex: 1, fontSize: 17, fontWeight: 600}}>
        Rejting
      </Box>
      {me && (
        <Box component="span" sx={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px"}}>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums"}}>
            {me.rating}
          </Box>
          <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
            #{me.rank} od {total}
          </Box>
        </Box>
      )}
      <ChevronRightRoundedIcon sx={{fontSize: 22, color: color.navy}} />
    </Box>
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
        color: "#FFFFFF",
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
              {live && (
                <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.cream, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums"}}>
                  {table.score![0]} : {table.score![1]}
                </Box>
              )}
            </Box>
            <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.2}}>
              <TeamName name={table.myTeam} dot={TEAM_DOT[0]} />
              <TeamName name={table.opponent} dot={TEAM_DOT[1]} />
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

// the team dots on the navy card: the board's green and red, lightened to stand out on navy
const TEAM_DOT = ["#6FA67A", "#E07A7C"] as const;

function TeamName({name, dot}: {name: string; dot: string}) {
  return (
    <Box component="span" sx={{display: "flex", alignItems: "center", gap: "8px", minWidth: 0}}>
      <Box component="span" aria-hidden sx={{width: 8, height: 8, flex: "none", borderRadius: "50%", background: dot}} />
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
        background: "#E9E5DB",
        border: "1.5px dashed rgba(60,74,103,.22)",
        color: color.placeholder,
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
          sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: "rgba(60,74,103,.1)", color: color.placeholder, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 28}}}
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
          "&:active": {background: color.pressed},
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
