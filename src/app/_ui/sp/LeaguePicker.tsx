"use client";

import {chooseLeague, LeagueOption} from "@/app/_hooks/useLeagues";
import {color, shadow} from "@/app/_styles/tokens";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {Box, Popover} from "@mui/material";
import React, {useRef, useState} from "react";
import {buttonBase, ellipsis} from "./base";
import {BottomSheet} from "./Sheet";
import {IconTile} from "./Surface";

// Phone: the league name as a small uppercase button above the title, opening a bottom sheet
export function LeagueEyebrowButton({
  leagues,
  value,
  onChange,
}: {
  leagues: LeagueOption[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = leagues.find((l) => l.id === value) ?? leagues[0];
  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Liga: ${current?.name ?? ""}. Promijeni ligu`}
        sx={{
          ...buttonBase,
          alignSelf: "flex-start",
          maxWidth: "100%",
          height: 32,
          m: "-6px 0 -4px -8px",
          p: "0 4px 0 8px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          gap: "2px",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: color.navy,
          "&:active": {background: color.hover},
          "& svg": {fontSize: 20, flex: "none"},
        }}
      >
        <Box component="span" sx={ellipsis}>
          {current?.name}
        </Box>
        <ExpandMoreRoundedIcon />
      </Box>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Odaberi ligu">
        <Box role="listbox" aria-label="Lige" sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
          {leagues.map((l) => {
            const on = l.id === value;
            return (
              <Box
                key={l.id}
                component="button"
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  chooseLeague(l.id);
                  onChange(l.id);
                  setOpen(false);
                }}
                sx={{
                  ...buttonBase,
                  minHeight: 64,
                  borderRadius: "16px",
                  background: on ? color.paper : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  px: "12px",
                  textAlign: "left",
                }}
              >
                <IconTile size={40} radius={12}>
                  <EmojiEventsRoundedIcon />
                </IconTile>
                <Box component="span" sx={{flex: 1, display: "flex", flexDirection: "column", gap: "1px", minWidth: 0}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink}}>
                    {l.name}
                  </Box>
                  {l.meta && (
                    <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                      {l.meta}
                    </Box>
                  )}
                </Box>
                {on && <CheckCircleRoundedIcon sx={{fontSize: 24, color: color.navy}} />}
              </Box>
            );
          })}
        </Box>
      </BottomSheet>
    </>
  );
}

// Desktop: white pill with the trophy tile and a dropdown menu
export function LeagueMenuButton({
  leagues,
  value,
  onChange,
}: {
  leagues: LeagueOption[];
  value: number;
  onChange: (id: number) => void;
}) {
  const anchor = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const current = leagues.find((l) => l.id === value) ?? leagues[0];
  return (
    <>
      <Box
        component="button"
        type="button"
        ref={anchor}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        sx={{
          ...buttonBase,
          height: 48,
          maxWidth: 340,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          pl: "8px",
          pr: "12px",
          borderRadius: "24px",
          background: color.card,
          color: color.ink,
          fontSize: 15,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: shadow.raised,
        }}
      >
        <Box
          component="span"
          aria-hidden
          sx={{width: 34, height: 34, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center"}}
        >
          <EmojiEventsRoundedIcon sx={{fontSize: 20}} />
        </Box>
        <Box component="span" sx={ellipsis}>
          {current?.name}
        </Box>
        {open ? <ExpandLessRoundedIcon sx={{fontSize: 22, color: color.muted}} /> : <ExpandMoreRoundedIcon sx={{fontSize: 22, color: color.muted}} />}
      </Box>
      <Popover
        open={open}
        anchorEl={anchor.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{vertical: "bottom", horizontal: "right"}}
        transformOrigin={{vertical: "top", horizontal: "right"}}
        slotProps={{paper: {sx: {mt: "8px", width: 300, p: "6px", borderRadius: "18px", boxShadow: shadow.popover}}}}
      >
        <Box role="listbox" aria-label="Lige" sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
          {leagues.map((l) => {
            const on = l.id === value;
            return (
              <Box
                key={l.id}
                component="button"
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  chooseLeague(l.id);
                  onChange(l.id);
                  setOpen(false);
                }}
                sx={{
                  ...buttonBase,
                  minHeight: 56,
                  borderRadius: "12px",
                  background: on ? color.paper : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  px: "12px",
                  textAlign: "left",
                  "&:hover": {background: color.paper},
                }}
              >
                <Box component="span" sx={{flex: 1, display: "flex", flexDirection: "column"}}>
                  <Box component="span" sx={{fontSize: 15, fontWeight: 600, color: color.ink}}>
                    {l.name}
                  </Box>
                  {l.meta && (
                    <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                      {l.meta}
                    </Box>
                  )}
                </Box>
                {on && <CheckRoundedIcon sx={{fontSize: 22, color: color.navy}} />}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
