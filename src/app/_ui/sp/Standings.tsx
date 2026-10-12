import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {statsLine, StandingsRow} from "@/app/_lib/ui/standings";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {mergeSx, tabular} from "./base";
import {RankBadge} from "./Live";
import {TeamLabel} from "./TeamDot";

// Three medal cards. "compact" is the phone version (three narrow columns), otherwise the desktop one. showLive
// turns a medal red and pulsing, and its points red, while that team is playing (as in the rows below the podium).
export function Podium({
  rows,
  compact = false,
  showLive = false,
  sx,
}: {
  rows: StandingsRow[];
  compact?: boolean;
  showLive?: boolean;
  sx?: SxProps<Theme>;
}) {
  if (rows.length < 3) return null;
  return (
    <Box
      component="ol"
      aria-label="Prva tri mjesta"
      sx={mergeSx(
        {listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: compact ? "10px" : "16px", flex: "none"},
        sx
      )}
    >
      {rows.slice(0, 3).map((r, i) => {
        const live = showLive && r.live;
        return (
          <Box
            component="li"
            key={r.key}
            aria-current={r.mine ? "true" : undefined}
            sx={{
              background: color.medalBg[i],
              color: color.ink,
              borderRadius: compact ? "20px" : "24px",
              p: compact ? "12px 12px 14px" : "20px 22px",
              display: "flex",
              minWidth: 0,
              boxShadow: [compact ? shadow.card : null, r.mine ? shadow.mineRing : null].filter(Boolean).join(", ") || "none",
              ...(compact
                ? {flexDirection: "column", gap: "10px"}
                : {alignItems: "flex-end", justifyContent: "space-between", gap: "12px"}),
            }}
          >
            {compact ? (
              <>
                <Medal rank={r.rank} index={i} size={28} live={live} />
                <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
                  <Box sx={{display: "flex", alignItems: "baseline", gap: "8px"}}>
                    <Box
                      component="span"
                      sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1, color: live ? color.red : undefined, ...tabular}}
                    >
                      {r.points}
                      <VisuallyHidden> bodova</VisuallyHidden>
                    </Box>
                    <Box component="span" sx={{fontSize: 14, fontWeight: 700, color: color.navy, ...tabular}}>
                      {r.diff}
                    </Box>
                  </Box>
                  <TeamLabel name={r.name} conference={r.conference} sx={{fontSize: 14, fontWeight: 600}} />
                </Box>
              </>
            ) : (
              <>
                <Box sx={{display: "flex", flexDirection: "column", gap: "14px", minWidth: 0}}>
                  <Medal rank={r.rank} index={i} size={34} live={live} />
                  <TeamLabel name={r.name} conference={r.conference} dotSize={10} sx={{gap: "10px", fontFamily: font.display, fontSize: 26, fontWeight: 700}} />
                </Box>
                <Box sx={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 700, color: color.navy, ...tabular}}>
                    {r.diff}
                  </Box>
                  <Box
                    component="span"
                    sx={{fontFamily: font.display, fontSize: 56, fontWeight: 800, lineHeight: 0.85, color: live ? color.red : undefined, ...tabular}}
                  >
                    {r.points}
                    <VisuallyHidden> bodova</VisuallyHidden>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// Medal circle; red and pulsing like RankBadge while the team is playing
function Medal({rank, index, size, live = false}: {rank: number; index: number; size: number; live?: boolean}) {
  return (
    <Box
      component="span"
      aria-label={live ? `${rank}. mjesto, igra uživo` : `${rank}. mjesto`}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: live ? color.red : color.medal[index],
        animation: live ? "spLive 1.5s infinite" : "none",
        color: color.white,
        fontSize: size >= 34 ? 16 : 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      {rank}
    </Box>
  );
}

export function VisuallyHidden({children}: {children: React.ReactNode}) {
  return (
    <Box
      component="span"
      sx={{position: "absolute", width: 1, height: 1, p: 0, m: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0}}
    >
      {children}
    </Box>
  );
}

// Phone standings: two-line rows (name + stats), RAZ and BOD on the right, so nothing scrolls sideways. With
// podium, the top three come first as medal rows that stay pinned while the rest scrolls under them (the parent
// card is the scroller). The player's own team has a cream row with a navy bar.
export function StandingsRows({rows, podium, withPlayed = false}: {rows: StandingsRow[]; podium?: StandingsRow[]; withPlayed?: boolean}) {
  const top = podium && podium.length >= 3 ? podium.slice(0, 3) : null;
  return (
    <>
      {top && (
        <Box sx={{position: "sticky", top: 0, zIndex: 2, background: color.white, boxShadow: shadow.sticky}}>
          <Box component="ol" aria-label="Prva tri mjesta" sx={{listStyle: "none", m: 0, p: 0}}>
            {top.map((r, i) => (
              <StandingsLine key={r.key} r={r} withPlayed={withPlayed} medal={i} />
            ))}
          </Box>
        </Box>
      )}
      <Box component="ol" start={top ? 4 : undefined} sx={{listStyle: "none", m: 0, p: 0}}>
        {rows.map((r) => (
          <StandingsLine key={r.key} r={r} withPlayed={withPlayed} />
        ))}
      </Box>
    </>
  );
}

function StandingsLine({r, withPlayed, medal}: {r: StandingsRow; withPlayed: boolean; medal?: number}) {
  const onPodium = medal != null;
  return (
    <Box
      component="li"
      aria-current={r.mine ? "true" : undefined}
      sx={{
        height: onPodium ? 58 : 62,
        display: "grid",
        gridTemplateColumns: "30px minmax(0,1fr) auto",
        alignItems: "center",
        gap: "10px",
        pl: "12px",
        pr: "16px",
        borderBottom: `1px solid ${color.line}`,
        background: r.mine ? color.cream2 : onPodium ? color.medalBg[medal] : "transparent",
        boxShadow: r.mine ? shadow.mineBar : "none",
      }}
    >
      {onPodium ? <Medal rank={r.rank} index={medal} size={28} /> : <RankBadge rank={r.rank} live={r.live} />}
      <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
        <TeamLabel name={r.name} conference={r.conference} sx={{fontSize: 16, fontWeight: onPodium || r.mine ? 700 : 600}} />
        <Box sx={{fontSize: 12.5, color: onPodium ? color.ink2 : color.muted, whiteSpace: "nowrap", ...tabular}}>{statsLine(r, withPlayed)}</Box>
      </Box>
      <Box sx={{display: "flex", alignItems: "baseline", gap: "12px"}}>
        <Box aria-label={`razlika ${r.diff}`} sx={{minWidth: 48, textAlign: "right", fontSize: 17, fontWeight: 700, color: color.navy, ...tabular}}>
          {r.diff}
        </Box>
        <Box
          aria-label={`${r.points} bodova`}
          sx={{
            minWidth: 34,
            textAlign: "right",
            fontFamily: font.display,
            fontSize: 26,
            fontWeight: 800,
            color: !onPodium && r.live ? color.red : color.ink,
            ...tabular,
          }}
        >
          {r.points}
        </Box>
      </Box>
    </Box>
  );
}

type GridColumn = "played" | "wins" | "draws" | "losses";

// Desktop standings table with real columns; RAZ and BOD larger than the counts
export function StandingsGrid({
  rows,
  columns = ["wins", "draws", "losses"],
  dense = false,
  caption,
  sx,
  showLive = true,
}: {
  rows: StandingsRow[];
  columns?: GridColumn[];
  dense?: boolean;
  caption: string;
  sx?: SxProps<Theme>;
  showLive?: boolean;
}) {
  const head: Record<GridColumn, string> = {played: "OK", wins: "POB", draws: "NER", losses: "IZG"};
  const full: Record<GridColumn, string> = {played: "Odigrano kola", wins: "Pobjede", draws: "Neriješeno", losses: "Izgubljeno"};
  const countW = dense ? 40 : columns.length > 3 ? 64 : 56;
  const template = `${dense ? 36 : 44}px minmax(0,1fr) ${columns.map(() => `${countW}px`).join(" ")} ${dense ? 64 : columns.length > 3 ? 96 : 80}px ${dense ? 48 : columns.length > 3 ? 72 : 64}px`;
  const px = dense ? "20px" : columns.length > 3 ? "24px" : "20px";
  const cell = {display: "grid", gridTemplateColumns: template, gap: "8px", alignItems: "center", px};
  return (
    <Box component="table" role="table" sx={mergeSx({width: "100%", borderCollapse: "collapse", display: "block"}, sx)}>
      <Box component="caption" sx={{position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)"}}>
        {caption}
      </Box>
      <Box component="thead" role="rowgroup" sx={{display: "block", position: "sticky", top: 0, zIndex: 1}}>
        <Box
          component="tr"
          role="row"
          sx={{
            ...cell,
            height: dense ? 34 : 44,
            background: color.paper2,
            borderBottom: `1px solid ${tint.navy[10]}`,
            fontSize: dense ? 11 : 12,
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: color.muted,
            "& th": {fontWeight: 600, p: 0},
          }}
        >
          <Box component="th" role="columnheader" scope="col" sx={{textAlign: "left"}}>
            <abbr title="Mjesto" style={{textDecoration: "none"}}>#</abbr>
          </Box>
          <Box component="th" role="columnheader" scope="col" sx={{textAlign: "left"}}>
            Ime ekipe
          </Box>
          {columns.map((c) => (
            <Box component="th" role="columnheader" scope="col" key={c} sx={{textAlign: "center"}}>
              <abbr title={full[c]} style={{textDecoration: "none"}}>
                {head[c]}
              </abbr>
            </Box>
          ))}
          <Box component="th" role="columnheader" scope="col" sx={{textAlign: "right"}}>
            <abbr title="Razlika" style={{textDecoration: "none"}}>RAZ</abbr>
          </Box>
          <Box component="th" role="columnheader" scope="col" sx={{textAlign: "right"}}>
            <abbr title="Bodovi" style={{textDecoration: "none"}}>BOD</abbr>
          </Box>
        </Box>
      </Box>
      <Box component="tbody" role="rowgroup" sx={{display: "block"}}>
        {rows.map((r) => {
          const live = showLive && r.live;
          return (
            <Box
              component="tr"
              role="row"
              key={r.key}
              aria-current={r.mine ? "true" : undefined}
              sx={{
                ...cell,
                height: dense ? 46 : 56,
                borderBottom: `1px solid ${color.divider}`,
                background: r.mine ? color.cream2 : "transparent",
                boxShadow: r.mine ? shadow.mineBar : "none",
                ...tabular,
                "& td": {p: 0},
              }}
            >
              <Box component="td" role="cell">
                <RankBadge rank={r.rank} live={live} size={dense ? 26 : 30} />
              </Box>
              <Box component="td" role="cell" sx={{fontSize: dense ? 16 : 17, fontWeight: r.mine ? 700 : 600, minWidth: 0}}>
                <TeamLabel name={r.name} conference={r.conference} />
              </Box>
              {columns.map((c) => (
                <Box component="td" role="cell" key={c} sx={{textAlign: "center", fontSize: dense ? 14 : 15, color: color.ink2}}>
                  {r[c]}
                </Box>
              ))}
              <Box component="td" role="cell" sx={{textAlign: "right", fontSize: dense ? 16 : 18, fontWeight: 700, color: color.navy}}>
                {r.diff}
              </Box>
              <Box
                component="td"
                role="cell"
                sx={{textAlign: "right", fontFamily: font.display, fontSize: dense ? 22 : 26, fontWeight: 800, color: live ? color.red : color.ink}}
              >
                {r.points}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
