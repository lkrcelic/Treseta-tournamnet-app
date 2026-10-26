import {conferenceDot, Conference} from "@/app/_lib/conferences";
import {color as tokens, tint} from "@/app/_styles/tokens";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {ellipsis, mergeSx} from "./base";

// The small dot before a team's name (Start Game card, standings, tables): the team's conference color, or on the
// Start Game card of a league without conferences, its side's color. null draws a hollow ring: no conference, in a
// league that has them. ring: a thin white ring that keeps a dark dot visible on navy. label: read out instead of
// hiding the dot (the conference's name).
export function TeamDot({
  color,
  ring = false,
  onNavy = false,
  size = 8,
  label,
  sx,
}: {
  color: string | null;
  ring?: boolean;
  // the hollow ring in white, for a navy background
  onNavy?: boolean;
  size?: number;
  label?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="span"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      sx={mergeSx(
        {
          display: "inline-block",
          flex: "none",
          width: size,
          height: size,
          boxSizing: "border-box",
          borderRadius: "50%",
          ...(color
            ? {background: color, boxShadow: ring ? `0 0 0 1.5px ${tokens.white}` : "none"}
            : {border: `1.5px solid ${onNavy ? tint.white[62] : tokens.borderStrong}`}),
        },
        sx
      )}
    />
  );
}

// A team's name with its conference's dot, cut with an ellipsis. The dot comes first, or last for a name aligned to
// the right (end). No dot when the league has no conferences (conference undefined).
export function TeamLabel({
  name,
  conference,
  end = false,
  dotSize,
  hidden,
  sx,
  nameSx,
}: {
  name: React.ReactNode;
  conference: Conference | null | undefined;
  end?: boolean;
  dotSize?: number;
  // aria-hidden, where the row has its own label
  hidden?: boolean;
  sx?: SxProps<Theme>;
  // the name's own style instead of one line cut with an ellipsis (a draft's two lines)
  nameSx?: SxProps<Theme>;
}) {
  const dot = conferenceDot(conference);
  const dotEl = dot !== undefined && <TeamDot color={dot} size={dotSize} label={conference?.name} />;
  return (
    <Box
      component="span"
      aria-hidden={hidden || undefined}
      sx={mergeSx({display: "flex", alignItems: "center", justifyContent: end ? "flex-end" : "flex-start", gap: "8px", minWidth: 0}, sx)}
    >
      {!end && dotEl}
      <Box component="span" sx={nameSx ?? ellipsis}>
        {name}
      </Box>
      {end && dotEl}
    </Box>
  );
}
