"use client";

import {exceptionLabel, isSafeUrl, NightLocation} from "@/app/_lib/nights";
import {color, tint} from "@/app/_styles/tokens";
import {buttonBase, mergeSx, tabular} from "@/app/_ui/sp";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";

// Where and when a league night gathers (Okupljanje): the parts the admin's Datumi and the players' Raspored share

// The mark of a night with its own time or place: a small gold circle with "!"; nothing for a night that follows the
// league. Its full meaning is its title and what a screen reader says.
export function ExceptionMark({label, size = 20}: {label: string | null; size?: number}) {
  if (!label) return null;
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      title={label}
      sx={{width: size, height: size, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "inline-flex", alignItems: "center", justifyContent: "center"}}
    >
      <PriorityHighRoundedIcon aria-hidden sx={{fontSize: Math.round(size * 0.7)}} />
    </Box>
  );
}

// "19:30 · Caffe bar Kartaš" under a night's date (its Početak and place), with "!" when the night has its own time
// (Početak or Okupljanje: ownGathering) or place. A night's own Početak or place is bold and darker and the league's
// is muted (Datumi); `plain` keeps both muted and marks the night
// with `mark` (Raspored, which knows only that the night differs). It stays on one line, cut with "…", unless `wrap`
// (Raspored, where the player needs the whole place). Nothing when the night has neither.
export function GatheringLine({
  time,
  place,
  ownTime = false,
  ownGathering = false,
  ownPlace = false,
  plain = false,
  mark,
  wrap = false,
  size = 13,
  sx,
}: {
  time: string | null | undefined;
  place: NightLocation | null | undefined;
  ownTime?: boolean;
  ownGathering?: boolean;
  ownPlace?: boolean;
  plain?: boolean;
  mark?: string | null;
  wrap?: boolean;
  size?: number;
  sx?: SxProps<Theme>;
}) {
  if (!time && !place) return null;
  const part = (own: boolean) => (own && !plain ? {fontWeight: 700, color: color.ink} : {fontWeight: 400, color: color.muted});
  return (
    <Box component="span" sx={mergeSx({display: "flex", alignItems: "center", gap: "6px", minWidth: 0, fontSize: size, lineHeight: 1.3}, sx)}>
      <Box
        component="span"
        sx={{minWidth: 0, color: color.muted, ...(wrap ? {overflowWrap: "anywhere"} : {overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"})}}
      >
        {time && (
          <Box component="span" sx={{...part(ownTime), ...tabular}}>
            {time}
          </Box>
        )}
        {time && place && " · "}
        {place && (
          <Box component="span" sx={part(ownPlace)}>
            {place.name}
          </Box>
        )}
      </Box>
      <ExceptionMark label={plain ? (mark ?? null) : exceptionLabel(ownTime || ownGathering, ownPlace)} size={size < 13 ? 18 : 20} />
    </Box>
  );
}

// A place's link to Google Maps, opened in a new tab (or the Maps app); only an http(s) link is a link
export const mapLinkProps = (url: string) => ({href: url.trim(), target: "_blank", rel: "noopener noreferrer"}) as const;

// The 44 × 44 map button of a night in Raspored; nothing without a safe link
export function MapButton({place, label}: {place: NightLocation | null | undefined; label: string}) {
  if (!place?.url || !isSafeUrl(place.url)) return null;
  return (
    <Box
      component="a"
      {...mapLinkProps(place.url)}
      aria-label={label}
      title="Otvori kartu"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        ...buttonBase,
        width: 44,
        height: 44,
        flex: "none",
        textDecoration: "none",
        borderRadius: "12px",
        background: color.paper,
        color: color.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": {fontSize: 22},
        "&:hover": {background: tint.navy[8]},
      }}
    >
      <MapRoundedIcon aria-hidden />
    </Box>
  );
}
