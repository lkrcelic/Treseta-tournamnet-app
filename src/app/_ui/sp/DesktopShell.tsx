"use client";

import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useLogout from "@/app/_hooks/useLogout";
import useStartGame from "@/app/_hooks/useStartGame";
import {getRoundsAPI} from "@/app/_fetchers/round/getRounds";
import {BRAND} from "@/app/_lib/brand";
import {leagueDateString} from "@/app/_lib/dates";
import {currentLeagueHref, LeaguePage} from "@/app/_lib/league";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useAuthStore from "@/app/_store/authStore";
import {color, ease, font, shadow, tint} from "@/app/_styles/tokens";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LibraryAddRoundedIcon from "@mui/icons-material/LibraryAddRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {Box, Drawer, SxProps, Theme} from "@mui/material";
import Link from "next/link";
import {startNavStack} from "@/app/_lib/navStack";
import {pathOfHref, plainClick, TransitionLink} from "@/app/_lib/viewTransitions";
import React, {useEffect, useRef, useState} from "react";
import {buttonBase, ellipsis, mergeSx} from "./base";
import {GhostIconButton, IconCircleButton} from "./Buttons";
import {LiveDot} from "./Live";
import {useScrollArrows} from "./ScrollArrows";
import {Spinner} from "./States";
import {InitialsAvatar} from "./Surface";
import {Eyebrow} from "./Text";

export type NavKey =
  | "home"
  | "game"
  | "daily"
  | "league"
  | "ratings"
  | "raspored"
  | "burza"
  | "manageLeague"
  | "createLeague"
  | "teams"
  | "players"
  | "sponsors"
  | "profile";

// Desktop page frame: menu button + eyebrow/title header, right-hand controls, content filling the viewport. Without a
// title the header is the menu button and the eyebrow alone (the Team and Player pages: "PIATNIK BELA LIGA", 13f).
// compact: a smaller title and less space around it, for a page that needs the height of a short window (the admin's
// Ekipe and Igrači directories under 800 px).
export function DesktopShell({
  active,
  eyebrow,
  title,
  right,
  back,
  lead,
  compact = false,
  footer,
  children,
  sx,
}: {
  active?: NavKey;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  right?: React.ReactNode;
  // a "← label" pill next to the menu button (e.g. back to the round from a table's scorepad)
  back?: {label: string; href: string};
  // any other control next to the menu button (a stacked page's BackPill in a short window)
  lead?: React.ReactNode;
  compact?: boolean;
  // a strip along the bottom of the window, edge to edge under the content (the sponsors of a live round)
  footer?: React.ReactNode;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scroll = useScrollArrows(rootRef);
  return (
    <Box
      ref={rootRef}
      onMouseMove={scroll.onMouseMove}
      onMouseLeave={scroll.onMouseLeave}
      sx={{
        height: "100dvh",
        minHeight: 640,
        display: "flex",
        flexDirection: "column",
        gap: compact ? "14px" : "20px",
        p: compact ? "16px 36px 20px" : "24px 36px 28px",
        boxSizing: "border-box",
        maxWidth: 1920,
        mx: "auto",
      }}
    >
      <Box component="header" sx={{display: "flex", alignItems: "center", gap: "20px", flex: "none"}}>
        <IconCircleButton
          label="Izbornik"
          size={52}
          onClick={() => setNavOpen(true)}
          aria-expanded={navOpen}
          aria-controls="sp-nav"
        >
          <MenuRoundedIcon />
        </IconCircleButton>
        {back && (
          <Box
            component={TransitionLink}
            href={back.href}
            direction="back"
            sx={{
              ...buttonBase,
              height: 52,
              flex: "none",
              pl: "12px",
              pr: "18px",
              borderRadius: "26px",
              background: color.white,
              color: color.navy,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: 15,
              fontWeight: 700,
              whiteSpace: "nowrap",
              textDecoration: "none",
              boxShadow: shadow.pill,
              "& svg": {fontSize: 24},
            }}
          >
            <ArrowBackRoundedIcon />
            {back.label}
          </Box>
        )}
        {lead}
        {/* the title keeps its width (up to half the header); crowded right-hand controls shrink and scroll instead */}
        <Box sx={{display: "flex", flexDirection: "column", gap: compact ? "2px" : "6px", mr: "auto", minWidth: 0, flexShrink: 0, maxWidth: "50%"}}>
          {eyebrow && <Eyebrow sx={title == null ? {fontWeight: 700, letterSpacing: ".14em", ...ellipsis} : undefined}>{eyebrow}</Eyebrow>}
          {title != null && (
            <Box
              component="h1"
              sx={{m: 0, fontFamily: font.display, fontSize: compact ? 32 : 44, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em", ...ellipsis}}
            >
              {title}
            </Box>
          )}
        </Box>
        {right && <Box sx={{display: "flex", alignItems: "center", gap: "12px", flex: "0 1 auto", minWidth: 0}}>{right}</Box>}
      </Box>
      <Box component="main" sx={mergeSx({flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "20px"}, sx)}>
        {children}
      </Box>
      {footer && <Box sx={{flex: "none", mx: "-36px", mb: compact ? "-20px" : "-28px"}}>{footer}</Box>}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} active={active} />
      {scroll.arrows}
    </Box>
  );
}

// leaguePage: a page of the picked league, or of the one being played now (its href is filled in when it is known)
type NavItem = {key: NavKey; label: string; icon: React.ReactNode; href?: string; leaguePage?: LeaguePage; head?: string; adminOnly?: boolean};

const NAV: NavItem[] = [
  {key: "home", label: "Početna", icon: <HomeRoundedIcon />, href: "/"},
  {key: "game", label: "Započni igru", icon: <PlayArrowRoundedIcon />},
  {key: "daily", label: "Dnevni poredak", icon: <CalendarMonthRoundedIcon />, leaguePage: "daily-standings"},
  {key: "league", label: "Ukupni poredak", icon: <EmojiEventsRoundedIcon />, leaguePage: "standings"},
  {key: "ratings", label: "Rejting", icon: <LeaderboardRoundedIcon />, href: "/ratings"},
  {key: "raspored", label: "Raspored", icon: <EventRoundedIcon />, href: "/raspored"},
  {key: "burza", label: "Burza igrača", icon: <PersonSearchRoundedIcon />, href: "/burza"},
  {key: "manageLeague", label: "Upravljanje ligom", icon: <TuneRoundedIcon />, leaguePage: "manage", head: "Admin", adminOnly: true},
  {key: "createLeague", label: "Nova liga", icon: <LibraryAddRoundedIcon />, href: "/league/new", adminOnly: true},
  {key: "teams", label: "Ekipe", icon: <GroupsRoundedIcon />, href: "/teams", adminOnly: true},
  {key: "players", label: "Igrači", icon: <PersonRoundedIcon />, href: "/players", adminOnly: true},
  {key: "sponsors", label: "Sponzori", icon: <HandshakeRoundedIcon />, href: "/sponzori", adminOnly: true},
  {key: "profile", label: "Moj profil", icon: <AccountCircleRoundedIcon />, href: "/profile", head: "Račun"},
];

export function NavDrawer({open, onClose, active}: {open: boolean; onClose: () => void; active?: NavKey}) {
  const isAdmin = useIsAdmin();
  const user = useAuthStore((s) => s.user);
  const {logout, loggingOut} = useLogout();
  const {start, starting, error} = useStartGame();
  const [liveToday, setLiveToday] = useState(false);
  const leagueId = useSelectedLeagueId();
  const signedIn = user != null;

  // the red dot on Dnevni poredak: is any table of tonight being played right now
  useEffect(() => {
    if (!open || !signedIn || leagueId == null) return;
    let cancelled = false;
    getRoundsAPI({round_date: leagueDateString(), league_id: leagueId})
      .then((rounds) => {
        if (!cancelled) setLiveToday(rounds.some((r) => r.active));
      })
      .catch(() => {
        // no dot
      });
    return () => {
      cancelled = true;
    };
  }, [open, signedIn, leagueId]);

  // signed out, only the public season table and Burza igrača are available
  const items = NAV.filter((n) => (signedIn ? isAdmin || !n.adminOnly : n.key === "league" || n.key === "burza")).map((n) =>
    n.leaguePage ? {...n, href: currentLeagueHref(n.leaguePage, leagueId)} : n
  );
  const itemSx = (on: boolean) => ({
    ...buttonBase,
    width: "100%",
    height: 44,
    borderRadius: "12px",
    background: on ? color.navy : "transparent",
    color: on ? color.white : color.ink,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    px: "12px",
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "left" as const,
    "&:hover": {background: on ? color.navy : color.line},
    "& svg": {fontSize: 22},
  });

  return (
    <Drawer
      id="sp-nav"
      anchor="left"
      open={open}
      onClose={onClose}
      transitionDuration={{enter: 240, exit: 200}}
      SlideProps={{easing: {enter: ease, exit: ease}}}
      slotProps={{backdrop: {sx: {background: tint.scrim[28]}}}}
      PaperProps={{
        component: "nav",
        "aria-label": "Glavni izbornik",
        sx: {
          width: 264,
          background: color.lineFill,
          boxShadow: shadow.drawer,
          p: "24px 16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        },
      }}
    >
      <Box sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", pl: "12px", pb: "22px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
          {BRAND.eyebrow && (
            <Box sx={{fontSize: 12, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: color.muted}}>{BRAND.eyebrow}</Box>
          )}
          <Box sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 0.95, letterSpacing: "-.03em"}}>{BRAND.name}</Box>
        </Box>
        <GhostIconButton label="Zatvori izbornik" onClick={onClose} sx={{borderRadius: "50%"}}>
          <CloseRoundedIcon />
        </GhostIconButton>
      </Box>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column"}}>
        {items.map((n) => {
          const on = n.key === active;
          return (
            <Box component="li" key={n.key} sx={{display: "flex", flexDirection: "column"}}>
              {n.head && (
                <Box sx={{p: "18px 12px 6px", fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
                  {n.head}
                </Box>
              )}
              {n.href ? (
                <Box
                  component={Link}
                  href={n.href}
                  onClick={(e: React.MouseEvent) => {
                    // a page opened from the menu starts the page stack: it has no Back (a new tab is left alone)
                    if (plainClick(e)) startNavStack(pathOfHref(n.href!), window.location.pathname);
                    onClose();
                  }}
                  aria-current={on ? "page" : undefined}
                  sx={itemSx(on)}
                >
                  {n.icon}
                  <Box component="span" sx={{flex: 1}}>
                    {n.label}
                  </Box>
                  {n.key === "daily" && liveToday && <LiveDot label="uživo" />}
                </Box>
              ) : (
                <Box component="button" type="button" onClick={start} disabled={starting} aria-busy={starting || undefined} sx={itemSx(on)}>
                  {starting ? <Spinner size={20} /> : n.icon}
                  <Box component="span" sx={{flex: 1}}>
                    {n.label}
                  </Box>
                </Box>
              )}
              {!n.href && error && (
                <Box role="alert" sx={{px: "12px", py: "6px", fontSize: 13, fontWeight: 600, color: color.red}}>
                  {error}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {!signedIn ? (
        <Box component={Link} href="/login" sx={{...itemSx(true), mt: "auto", height: 48, justifyContent: "center"}}>
          <LoginRoundedIcon />
          Prijava
        </Box>
      ) : (
        <Box
          sx={{mt: "auto", display: "flex", alignItems: "center", gap: "10px", p: "10px", borderRadius: "14px", background: color.white, boxShadow: shadow.card}}
        >
          <InitialsAvatar name={user?.username ?? ""} src={user?.photo_url} size={40} variant="navy" />
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
            <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
              {user?.username ?? "—"}
            </Box>
            <Box component="span" sx={{fontSize: 13, color: color.muted}}>
              {isAdmin ? "Admin" : "Igrač"}
            </Box>
          </Box>
          <GhostIconButton label="Odjava" size={40} onClick={() => logout()} disabled={loggingOut} sx={{borderRadius: "10px"}}>
            <LogoutRoundedIcon />
          </GhostIconButton>
        </Box>
      )}
    </Drawer>
  );
}
