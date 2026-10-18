"use client";

import {formatChange} from "@/app/_lib/ui/ratings";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, Card, changeInk, ellipsis, InitialsAvatar, ProvisionalTag, tabular} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {Box, Skeleton} from "@mui/material";
import React, {useId} from "react";

// The rating on a profile's cream box, as Rejting has it. rating null = not known yet ("—"); rank null = not on Rejting
// (no place shown); a change shows only once the player has rated rounds.
export type HeroRating = {
  rating: number | null;
  change: number | null;
  rounds: number;
  rank: number | null;
  total: number;
  provisional: boolean;
};

// The cream name box of Moj profil (13e, 12f) and of a phone Player page (13c): the initials, the name (and on Moj
// profil the full name under the username), and the rating strip — "REJTING" with Privremeno, the last change, the
// place and the big number — opening the rating's detail. ratingHref null: the strip is not a link (a player who
// isn't on Rejting has no detail), so it has no chevron. name null / sub null: still loading.
// On a narrow strip (the 360 px desktop column, a phone under 390 px) Privremeno drops under REJTING instead of running
// under the number. avatar replaces the initials circle (Moj profil's photo with its camera badge); avatarSrc is the
// photo in the plain circle; belowName goes under the name ("Dodaj sliku").
export function ProfileHero({
  name,
  sub,
  avatarName,
  avatarSrc,
  avatar,
  belowName,
  rating,
  ratingHref,
  tag,
  desktop = false,
}: {
  name: string | null;
  // the line under the name; undefined = none (the Player page), and the name may then wrap
  sub?: string | null;
  avatarName: string;
  avatarSrc?: string | null;
  avatar?: React.ReactNode;
  belowName?: React.ReactNode;
  rating: HeroRating | null;
  ratingHref: string | null;
  // a label under the name (a deactivated player's "Neaktivan" on the phone Player page)
  tag?: React.ReactNode;
  desktop?: boolean;
}) {
  const nameId = useId();
  const wraps = sub === undefined;
  const strip = (
    <>
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "8px", rowGap: "4px", fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.ink2}}>
          Rejting
          {rating?.provisional && <ProvisionalTag size="row" />}
        </Box>
        {rating && (rating.rounds > 0 || rating.rank != null) && (
          <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "8px", fontSize: 14, whiteSpace: "nowrap", ...tabular}}>
            {rating.rounds > 0 && (
              <Box component="span" sx={{fontWeight: 700, color: changeInk(rating.change)}}>
                {formatChange(rating.change)}
              </Box>
            )}
            {rating.rank != null && (
              <Box component="span" sx={{color: color.ink2}}>
                #{rating.rank} od {rating.total}
              </Box>
            )}
          </Box>
        )}
      </Box>
      <Box sx={{flex: "none", fontFamily: font.display, fontSize: desktop ? 56 : 44, fontWeight: 800, lineHeight: 0.85, color: color.navy, ...tabular}}>
        {rating?.rating ?? "—"}
      </Box>
      {ratingHref && <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 24, color: color.navy}} />}
    </>
  );
  const stripSx = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    borderTop: `1px solid ${color.border}`,
    pt: desktop ? "16px" : "14px",
    textDecoration: "none",
    color: color.ink,
    textAlign: "left",
  } as const;

  return (
    <Card
      component="section"
      aria-labelledby={nameId}
      sx={{
        background: color.cream,
        boxShadow: "none",
        borderRadius: desktop ? "28px" : "24px",
        p: desktop ? "28px" : "20px",
        display: "flex",
        flexDirection: "column",
        gap: desktop ? "22px" : "18px",
        flex: "none",
      }}
    >
      <Box sx={{display: "flex", flexDirection: desktop ? "column" : "row", alignItems: desktop ? "flex-start" : "center", gap: desktop ? "22px" : "14px"}}>
        {avatar ?? <InitialsAvatar name={avatarName} src={avatarSrc} size={desktop ? 96 : 64} variant="navy" />}
        <Box sx={{display: "flex", flexDirection: "column", gap: desktop ? "4px" : "2px", minWidth: 0}}>
          <Box
            component="h1"
            id={nameId}
            sx={{
              m: 0,
              fontFamily: font.display,
              fontSize: desktop ? 34 : 28,
              fontWeight: 800,
              letterSpacing: "-.02em",
              ...(wraps ? {lineHeight: 1.05, textWrap: "pretty", overflowWrap: "anywhere"} : {lineHeight: 1, ...ellipsis}),
            }}
          >
            {name ?? <Skeleton width={160} />}
          </Box>
          {sub !== undefined && <Box sx={{fontSize: desktop ? 17 : 16, color: color.ink2}}>{sub ?? <Skeleton width={120} />}</Box>}
          {tag && <Box sx={{display: "flex", mt: "6px"}}>{tag}</Box>}
          {belowName && <Box sx={{display: "flex", mt: desktop ? "8px" : "6px"}}>{belowName}</Box>}
        </Box>
      </Box>
      {ratingHref ? (
        <Box component={TransitionLink} href={ratingHref} sx={{...buttonBase, ...stripSx}}>
          {strip}
        </Box>
      ) : (
        <Box sx={stripSx}>{strip}</Box>
      )}
    </Card>
  );
}
