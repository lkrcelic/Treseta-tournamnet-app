"use client";

import {startNavStack} from "@/app/_lib/navStack";
import {pathOfHref, plainClick, TransitionLink} from "@/app/_lib/viewTransitions";
import {color, tint} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {Box} from "@mui/material";
import React from "react";
import type {Capability} from "@/app/_lib/auth/permissions";
import useAuthStore, {userCan} from "@/app/_store/authStore";
import MilitaryTechOutlinedIcon from "@mui/icons-material/MilitaryTechOutlined";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";

export type AdminTab = "vecer" | "turniri" | "rejting" | "ekipe" | "igraci" | "sponzori";

// cap: the tab is there only for whoever may use that screen, as the computer's menu does (DECISIONS #86)
const TABS: {key: AdminTab; label: string; href: string; cap: Capability; icon: React.ReactNode; iconOn: React.ReactNode}[] = [
  {key: "vecer", label: "Večer", href: "/", cap: "league.manage", icon: <EventOutlinedIcon />, iconOn: <EventRoundedIcon />},
  {key: "turniri", label: "Turniri", href: "/turniri/upravljanje", cap: "tournament.manage.own", icon: <MilitaryTechOutlinedIcon />, iconOn: <MilitaryTechRoundedIcon />},
  {key: "rejting", label: "Rejting", href: "/ratings", cap: "rating.manage", icon: <LeaderboardOutlinedIcon />, iconOn: <LeaderboardRoundedIcon />},
  {key: "ekipe", label: "Ekipe", href: "/teams", cap: "team.edit", icon: <GroupsOutlinedIcon />, iconOn: <GroupsRoundedIcon />},
  {key: "igraci", label: "Igrači", href: "/players", cap: "player.directory", icon: <PersonOutlineRoundedIcon />, iconOn: <PersonRoundedIcon />},
  {key: "sponzori", label: "Sponzori", href: "/sponzori", cap: "sponsor.manage", icon: <HandshakeOutlinedIcon />, iconOn: <HandshakeRoundedIcon />},
];

// The bar's height above the safe area (the home indicator)
const BAR = 58;

// The management bottom bar on the phone (admin-mobile design; Turniri from "Turniri admin" M1): Večer, Turniri,
// Rejting, Ekipe, Igrači and Sponzori, each shown only to whoever may use it. It is on the six screens it opens; the screens under them have Back instead. Each tab starts the page stack afresh, like the desktop
// menu. A spacer of the bar's height keeps the end of the page clear of it (put it last in the screen).
export function AdminTabBar({active}: {active: AdminTab}) {
  const user = useAuthStore((s) => s.user);
  const tabs = TABS.filter((t) => userCan(user, t.cap));
  return (
    <>
      <Box aria-hidden sx={{flex: "none", height: `calc(${BAR}px + max(10px, env(safe-area-inset-bottom)))`}} />
      <Box
        component="nav"
        aria-label="Admin"
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          background: color.white,
          borderTop: `1px solid ${tint.navy[10]}`,
          pt: "6px",
          pb: "max(10px, env(safe-area-inset-bottom))",
        }}
      >
        <Box component="ul" sx={{listStyle: "none", m: "0 auto", p: "0 8px", maxWidth: 560, display: "flex", boxSizing: "border-box"}}>
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <Box component="li" key={t.key} sx={{flex: 1, minWidth: 0, display: "flex"}}>
                <Box
                  component={TransitionLink}
                  href={t.href}
                  direction="morph"
                  aria-current={on ? "page" : undefined}
                  onClick={(e: React.MouseEvent) => {
                    // a tab starts the page stack: the page it opens has no Back (a new tab is left alone)
                    if (plainClick(e)) startNavStack(pathOfHref(t.href), window.location.pathname);
                  }}
                  sx={{
                    ...buttonBase,
                    flex: 1,
                    minWidth: 0,
                    height: BAR - 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "2px",
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: on ? 700 : 600,
                    color: on ? color.ink : color.muted,
                    borderRadius: "12px",
                  }}
                >
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      // six tabs on a 360 px phone leave each about 57 px: the pill fits inside its tab
                      width: "min(56px, 100%)",
                      height: 30,
                      borderRadius: "15px",
                      background: on ? color.cream : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 160ms ease",
                      "& svg": {fontSize: 24},
                    }}
                  >
                    {on ? t.iconOn : t.icon}
                  </Box>
                  {t.label}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </>
  );
}
