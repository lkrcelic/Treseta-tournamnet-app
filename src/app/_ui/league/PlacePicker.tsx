"use client";

import {Slot} from "@/app/_lib/locations";
import {nightLabel} from "@/app/_lib/nights";
import {color, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ellipsis} from "@/app/_ui/sp";
import CallSplitRoundedIcon from "@mui/icons-material/CallSplitRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {Box, Popover} from "@mui/material";
import React, {useRef, useState} from "react";

// Which place of a two-place night Novo kolo and Skica are about (Claude Design 06 A, 07 A): on the computer a picker
// next to the league's in the header, on the phone a switch under the title. Shown only on a two-place night.

// A place in the picker: its name, how it is doing ("8 ekipa · skica čeka") and whether a Kolo is being played there
export type PlaceOption = {slot: Slot; name: string; sub: string; live: boolean};

const LiveDot = () => <Box component="span" aria-hidden sx={{width: 8, height: 8, flex: "none", borderRadius: "50%", background: color.red}} />;

// The header's place picker: "Kartaš ▾", its menu "Lokacija · čet 19. 11." with both places and Podjela ekipa
export function PlaceMenuButton({date, options, value, onChange, onSplit}: {date: string; options: PlaceOption[]; value: Slot; onChange: (slot: Slot) => void; onSplit?: () => void}) {
  const anchor = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.slot === value) ?? options[0];
  return (
    <>
      <Box
        component="button"
        type="button"
        ref={anchor}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Lokacija: ${current?.name}`}
        sx={{
          ...buttonBase,
          height: 48,
          maxWidth: 260,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          pl: "8px",
          pr: "12px",
          borderRadius: "24px",
          background: color.white,
          color: color.ink,
          fontSize: 15,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: open ? `${shadow.raised}, 0 0 0 2px ${color.navy}` : shadow.raised,
        }}
      >
        <Box component="span" aria-hidden sx={{width: 34, height: 34, flex: "none", borderRadius: "50%", background: color.navy, color: color.white, display: "flex", alignItems: "center", justifyContent: "center"}}>
          <PlaceRoundedIcon sx={{fontSize: 20}} />
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
        slotProps={{paper: {sx: {mt: "8px", width: 330, p: "6px", borderRadius: "18px", boxShadow: shadow.popover}}}}
      >
        <Box sx={{p: "8px 12px 4px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}>Lokacija · {nightLabel(date)}</Box>
        <Box role="listbox" aria-label="Lokacija" sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
          {options.map((o) => {
            const on = o.slot === value;
            return (
              <Box
                key={o.slot}
                component="button"
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(o.slot);
                  setOpen(false);
                }}
                sx={{
                  ...buttonBase,
                  minHeight: 56,
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  px: "12px",
                  textAlign: "left",
                  background: on ? tint.navy[8] : "transparent",
                  "&:hover": {background: on ? tint.navy[8] : color.paper2},
                }}
              >
                <Box component="span" sx={{width: 20, flex: "none", color: color.navy, display: "flex", "& svg": {fontSize: 20}}}>
                  {on && <CheckRoundedIcon aria-hidden />}
                </Box>
                <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                  <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink, ...ellipsis}}>
                    {o.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                    {o.sub}
                  </Box>
                </Box>
                {o.live && <LiveDot />}
              </Box>
            );
          })}
        </Box>
        {onSplit && (
          <>
            <Box sx={{height: "1px", background: tint.navy[8], m: "4px 0"}} />
            <Box
              component="button"
              type="button"
              onClick={() => {
                setOpen(false);
                onSplit();
              }}
              sx={{...buttonBase, width: "100%", minHeight: 44, borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px", px: "12px", fontSize: 14.5, fontWeight: 700, color: color.navy, "& svg": {fontSize: 20}, "&:hover": {background: color.paper2}}}
            >
              <CallSplitRoundedIcon aria-hidden />
              Podjela ekipa
            </Box>
          </>
        )}
      </Popover>
    </>
  );
}

// The phone's switch between the two places: "Kartaš · 8 | Lanterna · 5 •" (label: what follows the name)
export function PlaceSegment({options, value, onChange, label}: {options: PlaceOption[]; value: Slot; onChange: (slot: Slot) => void; label: (o: PlaceOption) => string}) {
  return (
    <Box role="tablist" aria-label="Lokacija" sx={{flex: "none", display: "flex", gap: "2px", p: "4px", borderRadius: "14px", background: color.lineFill}}>
      {options.map((o) => {
        const on = o.slot === value;
        return (
          <Box
            key={o.slot}
            component="button"
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.slot)}
            sx={{
              ...buttonBase,
              flex: 1,
              minWidth: 0,
              height: 40,
              borderRadius: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              px: "8px",
              fontSize: 14.5,
              fontWeight: 700,
              background: on ? color.white : "transparent",
              color: on ? color.ink : color.ink2,
              boxShadow: on ? shadow.segment : "none",
            }}
          >
            <Box component="span" sx={{minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
              {o.name}
            </Box>
            <Box component="span" sx={{flex: "none"}}>
              · {label(o)}
            </Box>
            {o.live && <LiveDot />}
          </Box>
        );
      })}
    </Box>
  );
}
