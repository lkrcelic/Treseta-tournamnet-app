import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {statsParts, StandingsRow} from "@/app/_lib/ui/standings";
import {count, NOUN, plural} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {ellipsis, mergeSx, rowFocus, stretchedArea, tabular, visuallyHidden} from "./base";
import {RankBadge} from "./Live";
import {TeamLabel} from "./TeamDot";

// Where a row (or podium card) leads: its team's page; null or no function = the row is not a link (the public
// season table for a visitor who isn't logged in)
export type RowHref = (row: StandingsRow) => string | null | undefined;

// A linked row: the team's name is the link and covers the whole row (or card), so the row stays a table row for
// screen readers and the name is what they announce. The row needs `position: relative` (linkedRow).
// keepClear: in a list that scrolls under a pinned block (column labels, the pinned podium), how far the browser keeps
// the link from the list's top and bottom edges when keyboard focus scrolls it into view, so the focused row and its
// ring are never hidden under the pinned block: the block's height plus half a row (the name sits mid-row).
type KeepClear = {top: number; bottom: number};

function TeamName({row, href, keepClear}: {row: StandingsRow; href: string | null | undefined; keepClear?: KeepClear}) {
  if (!href) return <>{row.name}</>;
  return (
    <Box
      component={TransitionLink}
      href={href}
      sx={{
        ...stretchedArea,
        color: "inherit",
        textDecoration: "none",
        WebkitTapHighlightColor: "transparent",
        outline: "none",
        ...(keepClear ? {scrollMarginTop: `${keepClear.top}px`, scrollMarginBottom: `${keepClear.bottom}px`} : {}),
      }}
    >
      {row.name}
    </Box>
  );
}

// The row of a linked name: its focus ring, and a little feedback under the pointer or finger (a tinted row darkens a
// touch, a white one turns paper-2). A podium card's ring goes round its outside, so it doesn't read as the highlight.
function linkedRow(tinted: boolean, card = false) {
  return {
    position: "relative",
    "&:has(a:focus-visible)": card ? {...rowFocus, outlineOffset: "3px"} : rowFocus,
    "@media (hover: hover)": {"&:hover": tinted ? {filter: "brightness(.98)"} : {background: color.paper2}},
    "&:active": tinted ? {filter: "brightness(.96)"} : {background: color.lineFill},
  } as const;
}

// Three medal cards. "compact" is the phone version (three narrow columns), otherwise the desktop one. showLive
// turns a medal red and pulsing, and its points red, while that team is playing (as in the rows below the podium).
export function Podium({
  rows,
  compact = false,
  showLive = false,
  rowHref,
  sx,
}: {
  rows: StandingsRow[];
  compact?: boolean;
  showLive?: boolean;
  rowHref?: RowHref;
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
        const href = rowHref?.(r);
        return (
          <Box
            component="li"
            key={r.key}
            aria-current={r.highlight ? "true" : undefined}
            data-highlight={r.highlight ? "" : undefined}
            sx={{
              background: color.medalBg[i],
              color: color.ink,
              borderRadius: compact ? "20px" : "24px",
              p: compact ? "12px 12px 14px" : "20px 22px",
              display: "flex",
              minWidth: 0,
              boxShadow: [compact ? shadow.card : null, r.highlight ? shadow.mineRing : null].filter(Boolean).join(", ") || "none",
              ...(compact
                ? {flexDirection: "column", gap: "10px"}
                : {alignItems: "flex-end", justifyContent: "space-between", gap: "12px"}),
              ...(href ? linkedRow(true, true) : {}),
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
                      <VisuallyHidden> {plural(r.points, ...NOUN.bod)}</VisuallyHidden>
                    </Box>
                    <Box component="span" sx={{fontSize: 14, fontWeight: 700, color: color.navy, ...tabular}}>
                      {r.diff}
                    </Box>
                  </Box>
                  <TeamLabel name={<TeamName row={r} href={href} />} conference={r.conference} sx={{fontSize: 14, fontWeight: 600}} />
                </Box>
              </>
            ) : (
              <>
                <Box sx={{display: "flex", flexDirection: "column", gap: "14px", minWidth: 0}}>
                  <Medal rank={r.rank} index={i} size={34} live={live} />
                  <TeamLabel name={<TeamName row={r} href={href} />} conference={r.conference} dotSize={10} sx={{gap: "10px", fontFamily: font.display, fontSize: 26, fontWeight: 700}} />
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
                    <VisuallyHidden> {plural(r.points, ...NOUN.bod)}</VisuallyHidden>
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
      sx={visuallyHidden}
    >
      {children}
    </Box>
  );
}

// Phone standings: two-line rows (name + stats), RAZ and BOD on the right, so nothing scrolls sideways. With
// podium, the top three come first as medal rows that stay pinned while the rest scrolls under them (the parent
// card is the scroller). The highlighted team (the player's own, or the one the page was opened for) has a cream row
// with a navy bar, also on the podium. head: a labels row on top ("#  EKIPA … RAZ  BOD", 13d), pinned with the podium.
// The pinned block (as the desktop grid's column labels) is marked data-pinned, rows data-highlight.
export function StandingsRows({
  rows,
  podium,
  withPlayed = false,
  head = false,
  rowHref,
}: {
  rows: StandingsRow[];
  podium?: StandingsRow[];
  withPlayed?: boolean;
  head?: boolean;
  rowHref?: RowHref;
}) {
  const top = podium && podium.length >= 3 ? podium.slice(0, 3) : null;
  // the pinned block (labels row and podium) hides the rows that scroll under it
  const pinned = (head ? HEAD_HEIGHT : 0) + (top ? 3 * LINE_HEIGHT.podium : 0);
  const keepClear = {top: pinned + LINE_HEIGHT.row / 2, bottom: LINE_HEIGHT.row / 2};
  return (
    <>
      {(top || head) && (
        <Box data-pinned="" sx={{position: "sticky", top: 0, zIndex: 2, background: color.white, boxShadow: top ? shadow.sticky : "none"}}>
          {head && <RowsHead />}
          {top && (
            <Box component="ol" aria-label="Prva tri mjesta" sx={{listStyle: "none", m: 0, p: 0}}>
              {top.map((r, i) => (
                <StandingsLine key={r.key} r={r} withPlayed={withPlayed} medal={i} href={rowHref?.(r)} />
              ))}
            </Box>
          )}
        </Box>
      )}
      <Box component="ol" start={top ? 4 : undefined} sx={{listStyle: "none", m: 0, p: 0}}>
        {rows.map((r) => (
          <StandingsLine key={r.key} r={r} withPlayed={withPlayed} href={rowHref?.(r)} keepClear={keepClear} />
        ))}
      </Box>
    </>
  );
}

// the phone rows' heights (border included): the labels row, a podium row, any other row
const HEAD_HEIGHT = 34;
const LINE_HEIGHT = {podium: 58, row: 62} as const;

// Phones narrower than the designed 390 px: the stats line ("21 OK · 11 POB · 9 NER · 1 IZG") gets smaller type and
// the columns sit a little closer, under 375 px the line leaves out the OK count (still read to screen readers), and
// under 340 px RAZ is a little smaller, so even a six-digit RAZ leaves the line its room. The rows keep their height:
// the line never wraps, and is cut with an ellipsis rather than run under RAZ.
const SMALL_PHONE = "@media (max-width: 389.98px)";
const NARROW_PHONE = "@media (max-width: 374.98px)";
const TINY_PHONE = "@media (max-width: 339.98px)";
// the right-hand block (RAZ and BOD) and the row's end, shared by the labels row so the labels stay over their numbers
const numbersSx = {display: "flex", gap: "12px", [SMALL_PHONE]: {gap: "8px"}} as const;
const rowEndSx = {pr: "16px", [SMALL_PHONE]: {pr: "14px"}} as const;

// "#  EKIPA" on the left, "RAZ" and "BOD" over their columns (Profiles P:119); the rows say the same to screen readers
function RowsHead() {
  return (
    <Box
      aria-hidden
      sx={{
        height: HEAD_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pl: "14px",
        ...rowEndSx,
        borderBottom: `1px solid ${tint.navy[10]}`,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: color.muted,
        whiteSpace: "nowrap",
      }}
    >
      <span>#&nbsp;&nbsp;&nbsp;Ekipa</span>
      <Box component="span" sx={numbersSx}>
        <Box component="span" sx={{minWidth: 48, textAlign: "right"}}>
          Raz
        </Box>
        <Box component="span" sx={{minWidth: 34, textAlign: "right"}}>
          Bod
        </Box>
      </Box>
    </Box>
  );
}

function StandingsLine({
  r,
  withPlayed,
  medal,
  href,
  keepClear,
}: {
  r: StandingsRow;
  withPlayed: boolean;
  medal?: number;
  href?: string | null;
  keepClear?: KeepClear;
}) {
  const onPodium = medal != null;
  const stats = statsParts(r, withPlayed);
  return (
    <Box
      component="li"
      aria-current={r.highlight ? "true" : undefined}
      data-highlight={r.highlight ? "" : undefined}
      sx={mergeSx(rowEndSx, {
        height: onPodium ? LINE_HEIGHT.podium : LINE_HEIGHT.row,
        display: "grid",
        gridTemplateColumns: "30px minmax(0,1fr) auto",
        alignItems: "center",
        gap: "10px",
        [SMALL_PHONE]: {gap: "8px"},
        pl: "12px",
        borderBottom: `1px solid ${color.line}`,
        background: r.highlight ? color.cream2 : onPodium ? color.medalBg[medal] : "transparent",
        boxShadow: r.highlight ? shadow.mineBar : "none",
        ...(href ? linkedRow(r.highlight || onPodium) : {}),
      })}
    >
      {onPodium ? <Medal rank={r.rank} index={medal} size={28} /> : <RankBadge rank={r.rank} live={r.live} />}
      <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
        <TeamLabel name={<TeamName row={r} href={href} keepClear={keepClear} />} conference={r.conference} sx={{fontSize: 16, fontWeight: onPodium || r.highlight ? 700 : 600}} />
        <Box sx={{fontSize: 12.5, [SMALL_PHONE]: {fontSize: 11.5}, color: onPodium ? color.ink2 : color.muted, ...ellipsis, ...tabular}}>
          {stats.played && (
            <Box component="span" sx={{[NARROW_PHONE]: visuallyHidden}}>
              {stats.played}
            </Box>
          )}
          {stats.results}
        </Box>
      </Box>
      <Box sx={{...numbersSx, alignItems: "baseline"}}>
        <Box
          aria-label={`razlika ${r.diff}`}
          sx={{minWidth: 48, textAlign: "right", fontSize: 17, [TINY_PHONE]: {fontSize: 15}, fontWeight: 700, color: color.navy, ...tabular}}
        >
          {r.diff}
        </Box>
        <Box
          aria-label={count(r.points, NOUN.bod)}
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

// Desktop standings table with real columns; RAZ and BOD larger than the counts. head={false}: no column labels row
// on screen (Početna's Ukupni poredak card, 3a: the rows follow the podium straight away); screen readers still get
// the column names.
export function StandingsGrid({
  rows,
  columns = ["wins", "draws", "losses"],
  dense = false,
  head = true,
  caption,
  sx,
  showLive = true,
  rowHref,
}: {
  rows: StandingsRow[];
  columns?: GridColumn[];
  dense?: boolean;
  head?: boolean;
  caption: string;
  sx?: SxProps<Theme>;
  showLive?: boolean;
  rowHref?: RowHref;
}) {
  const short: Record<GridColumn, string> = {played: "OK", wins: "POB", draws: "NER", losses: "IZG"};
  const full: Record<GridColumn, string> = {played: "Odigrano kola", wins: "Pobjede", draws: "Neriješeno", losses: "Izgubljeno"};
  const countW = dense ? 40 : columns.length > 3 ? 64 : 56;
  const template = `${dense ? 36 : 44}px minmax(0,1fr) ${columns.map(() => `${countW}px`).join(" ")} ${dense ? 64 : columns.length > 3 ? 96 : 80}px ${dense ? 48 : columns.length > 3 ? 72 : 64}px`;
  const px = dense ? "20px" : columns.length > 3 ? "24px" : "20px";
  const cell = {display: "grid", gridTemplateColumns: template, gap: "8px", alignItems: "center", px};
  const headHeight = dense ? 34 : 44;
  const rowHeight = dense ? 46 : 56;
  // the column labels stay on top while the rows scroll under them (the parent card is the scroller)
  const keepClear = {top: (head ? headHeight : 0) + rowHeight / 2, bottom: rowHeight / 2};
  return (
    <Box component="table" role="table" sx={mergeSx({width: "100%", borderCollapse: "collapse", display: "block"}, sx)}>
      <Box component="caption" sx={visuallyHidden}>
        {caption}
      </Box>
      <Box
        component="thead"
        role="rowgroup"
        data-pinned={head ? "" : undefined}
        sx={head ? {display: "block", position: "sticky", top: 0, zIndex: 1} : visuallyHidden}
      >
        <Box
          component="tr"
          role="row"
          sx={{
            ...cell,
            height: headHeight,
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
                {short[c]}
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
          const href = rowHref?.(r);
          return (
            <Box
              component="tr"
              role="row"
              key={r.key}
              aria-current={r.highlight ? "true" : undefined}
              data-highlight={r.highlight ? "" : undefined}
              sx={{
                ...cell,
                height: rowHeight,
                borderBottom: `1px solid ${color.divider}`,
                background: r.highlight ? color.cream2 : "transparent",
                boxShadow: r.highlight ? shadow.mineBar : "none",
                ...tabular,
                "& td": {p: 0},
                ...(href ? linkedRow(r.highlight) : {}),
              }}
            >
              <Box component="td" role="cell">
                <RankBadge rank={r.rank} live={live} size={dense ? 26 : 30} />
              </Box>
              <Box component="td" role="cell" sx={{fontSize: dense ? 16 : 17, fontWeight: r.highlight ? 700 : 600, minWidth: 0}}>
                <TeamLabel name={<TeamName row={r} href={href} keepClear={keepClear} />} conference={r.conference} />
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
