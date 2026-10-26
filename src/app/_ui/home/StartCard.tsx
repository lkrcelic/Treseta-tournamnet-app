"use client";

import {OpenTable} from "@/app/_hooks/useOpenTable";
import {color, font, shadow, teamOnNavy} from "@/app/_styles/tokens";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import {buttonBase, ellipsis, Spinner, TeamDot} from "@/app/_ui/sp";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {Box} from "@mui/material";

// Započni igru: the player's table of the open round (table number, the smoking mark, both teams, and the score once
// a match is running, when it reads Nastavi igru)
export function StartCard({table, starting, onStart, errorId}: {table: OpenTable; starting: boolean; onStart: () => void; errorId?: string}) {
  const live = table.score != null;
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
        // grows into the scoreboard on Započni igru (the board's root has the same name)
        viewTransitionName: "table",
        transition: "transform 120ms ease",
        "&:active:not(:disabled)": {transform: "scale(.98)"},
      }}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px"}}>
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
        <Box
          component="span"
          aria-hidden
          sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center"}}
        >
          {starting ? <Spinner size={22} /> : <PlayArrowRoundedIcon sx={{fontSize: 32}} />}
        </Box>
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, whiteSpace: "nowrap"}}>
        {live ? "Nastavi igru" : "Započni igru"}
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

