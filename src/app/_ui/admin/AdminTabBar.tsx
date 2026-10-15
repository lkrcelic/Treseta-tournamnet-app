"use client";

import {startNavStack} from "@/app/_lib/navStack";
import {pathOfHref, plainClick, TransitionLink} from "@/app/_lib/viewTransitions";
import {color, tint} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {Box} from "@mui/material";
import React from "react";

export type AdminTab = "vecer" | "rejting" | "ekipe" | "igraci";

const TABS: {key: AdminTab; label: string; href: string; icon: React.ReactNode; iconOn: React.ReactNode}[] = [
  {key: "vecer", label: "Večer", href: "/", icon: <EventOutlinedIcon />, iconOn: <EventRoundedIcon />},
  {key: "rejting", label: "Rejting", href: "/ratings", icon: <LeaderboardOutlinedIcon />, iconOn: <LeaderboardRoundedIcon />},
  {key: "ekipe", label: "Ekipe", href: "/teams", icon: <GroupsOutlinedIcon />, iconOn: <GroupsRoundedIcon />},
  {key: "igraci", label: "Igrači", href: "/players", icon: <PersonOutlineRoundedIcon />, iconOn: <PersonRoundedIcon />},
];

// The bar's height above the safe area (the home indicator)
const BAR = 58;

// The admin's bottom bar on the phone (admin-mobile design): Večer, Rejting, Ekipe and Igrači. It is on the four
// screens it opens; the screens under them have Back instead. Each tab starts the page stack afresh, like the desktop
// menu. A spacer of the bar's height keeps the end of the page clear of it (put it last in the screen).
export function AdminTabBar({active}: {active: AdminTab}) {
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
          {TABS.map((t) => {
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
                      width: 56,
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
