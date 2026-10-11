import {color, font, shadow} from "@/app/_styles/tokens";
import {statsLine, StandingsRow} from "@/app/_lib/ui/standings";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {ellipsis, mergeSx, tabular} from "./base";
import {RankBadge} from "./Live";

// Three medal cards. "compact" is the phone version (three narrow columns), otherwise the desktop one.
export function Podium({rows, compact = false, sx}: {rows: StandingsRow[]; compact?: boolean; sx?: SxProps<Theme>}) {
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
      {rows.slice(0, 3).map((r, i) => (
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
              <Medal rank={r.rank} index={i} size={28} />
              <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
                <Box sx={{display: "flex", alignItems: "baseline", gap: "8px"}}>
                  <Box component="span" sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1, ...tabular}}>
                    {r.points}
                    <VisuallyHidden> bodova</VisuallyHidden>
                  </Box>
                  <Box component="span" sx={{fontSize: 14, fontWeight: 700, color: color.navy, ...tabular}}>
                    {r.diff}
                  </Box>
                </Box>
                <Box sx={{fontSize: 14, fontWeight: 600, ...ellipsis}}>{r.name}</Box>
              </Box>
            </>
          ) : (
            <>
              <Box sx={{display: "flex", flexDirection: "column", gap: "14px", minWidth: 0}}>
                <Medal rank={r.rank} index={i} size={34} />
                <Box component="span" sx={{fontFamily: font.display, fontSize: 26, fontWeight: 700, ...ellipsis}}>
                  {r.name}
                </Box>
              </Box>
              <Box sx={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px"}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 700, color: color.navy, ...tabular}}>
                  {r.diff}
                </Box>
                <Box component="span" sx={{fontFamily: font.display, fontSize: 56, fontWeight: 800, lineHeight: 0.85, ...tabular}}>
                  {r.points}
                  <VisuallyHidden> bodova</VisuallyHidden>
                </Box>
              </Box>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
}

function Medal({rank, index, size}: {rank: number; index: number; size: number}) {
  return (
    <Box
      component="span"
      aria-label={`${rank}. mjesto`}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color.medal[index],
        color: "#FFFFFF",
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
        <Box sx={{position: "sticky", top: 0, zIndex: 2, background: color.card, boxShadow: "0 6px 12px -8px rgba(31,36,51,.25)"}}>
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
        background: onPodium ? color.medalRow[medal] : r.mine ? color.mine : "transparent",
        boxShadow: r.mine ? shadow.mineBar : "none",
      }}
    >
      {onPodium ? <Medal rank={r.rank} index={medal} size={28} /> : <RankBadge rank={r.rank} live={r.live} />}
      <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
        <Box sx={{fontSize: 16, fontWeight: onPodium || r.mine ? 700 : 600, ...ellipsis}}>{r.name}</Box>
        <Box sx={{fontSize: 12.5, color: onPodium ? color.inkSoft : color.muted, whiteSpace: "nowrap", ...tabular}}>{statsLine(r, withPlayed)}</Box>
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
            color: !onPodium && r.live ? color.live : color.ink,
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
            background: color.tableHead,
            borderBottom: `1px solid rgba(60,74,103,.1)`,
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
                borderBottom: `1px solid rgba(60,74,103,.07)`,
                background: r.mine ? color.mine : "transparent",
                boxShadow: r.mine ? shadow.mineBar : "none",
                ...tabular,
                "& td": {p: 0},
              }}
            >
              <Box component="td" role="cell">
                <RankBadge rank={r.rank} live={live} size={dense ? 26 : 30} />
              </Box>
              <Box component="td" role="cell" sx={{fontSize: dense ? 16 : 17, fontWeight: r.mine ? 700 : 600, ...ellipsis}}>
                {r.name}
              </Box>
              {columns.map((c) => (
                <Box component="td" role="cell" key={c} sx={{textAlign: "center", fontSize: dense ? 14 : 15, color: color.inkSoft}}>
                  {r[c]}
                </Box>
              ))}
              <Box component="td" role="cell" sx={{textAlign: "right", fontSize: dense ? 16 : 18, fontWeight: 700, color: color.navy}}>
                {r.diff}
              </Box>
              <Box
                component="td"
                role="cell"
                sx={{textAlign: "right", fontFamily: font.display, fontSize: dense ? 22 : 26, fontWeight: 800, color: live ? color.live : color.ink}}
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
