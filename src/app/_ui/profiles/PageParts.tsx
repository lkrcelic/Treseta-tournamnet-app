"use client";

import type {Overview} from "@/app/_hooks/useOverview";
import {BRAND} from "@/app/_lib/brand";
import type {NavStackControls} from "@/app/_lib/navStack";
import type {HeroTile} from "@/app/_lib/ui/profiles";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, tint} from "@/app/_styles/tokens";
import {
  BackPill,
  buttonBase,
  DesktopShell,
  ellipsis,
  ErrorState,
  InitialsAvatar,
  mergeSx,
  MessageState,
  type NavKey,
  PageSkeleton,
  ProvisionalTag,
  rowFocus,
  Screen,
  ScrollArea,
  StackTopBar,
  StatTile,
  stretchedArea,
  tabular,
} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import {Box, SxProps, Theme, useMediaQuery} from "@mui/material";
import React, {useContext, useId} from "react";
import {createPortal} from "react-dom";

// The frame, the cream header and the states shared by the Team and Player pages (handoff §6,
// komponente/Profiles.dc.html, abbreviated P below)

// The desktop columns: Igrači is the wide one on a Team page (13f); a Player page has three equal ones (13g)
export const TEAM_GRID = "minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr)";
export const PLAYER_GRID = "repeat(3, minmax(0,1fr))";

// Below this window height the desktop header card gets smaller, so the columns under it keep room for their rows
// (a 1024×640 laptop window)
const SHORT = "(max-height: 799.98px)";

// true in a short desktop window (see SHORT)
export function useShortWindow(): boolean {
  return useMediaQuery(SHORT, {noSsr: true});
}

// ---------- frames ----------

// The phone page (P:28-34): the stacked top bar (Back, "EKIPA", Home) stays, the rest scrolls under it
export function PhoneFrame({eyebrow, nav, children}: {eyebrow: string; nav: NavStackControls; children: React.ReactNode}) {
  return (
    <Screen fill gap={8}>
      <StackTopBar eyebrow={eyebrow} nav={nav} />
      <ScrollArea bleed sx={{pt: "6px", pb: "16px"}}>
        {children}
      </ScrollArea>
    </Screen>
  );
}

// The admin's Ekipe and Igrači directories (13h, 13j) hold the Team and Player pages next to their list. stacked: the
// page column is too narrow for three columns (a window under 1360 px), so the second and third card share a column;
// leadSlot: the place in the frame's header row for a back pill in a short window; lastPage: the last team's or
// player's page shown in the frame (/teams/29), where Nova ekipa goes back to.
export type DirectoryFrame = {stacked: boolean; leadSlot: HTMLElement | null; lastPage: string | null};

export const DirectoryFrameContext = React.createContext<DirectoryFrame | null>(null);

// the directory frame around this page, or null for a page on its own
export function useDirectoryFrame(): DirectoryFrame | null {
  return useContext(DirectoryFrameContext);
}

// The desktop page (P:145-171): the back pill naming the page it returns to, then the page. Alone it sits in the
// desktop frame under the eyebrow with the app's name (13f, 13g); embedded, the admin directory's frame holds it.
// short (a short window, see useShortWindow): the back pill moves up into the frame's header row next to the menu
// button, so the columns get its height. active: the nav drawer's item (a league's table opened from a team).
export function DesktopFrame({
  embedded,
  short = false,
  nav,
  active,
  children,
}: {
  embedded: boolean;
  short?: boolean;
  nav: NavStackControls;
  active?: NavKey;
  children: React.ReactNode;
}) {
  const frame = useDirectoryFrame();
  const slot = embedded ? frame?.leadSlot ?? null : null;
  const inHeader = short && (!embedded || slot != null);
  const headerPill = <BackPill nav={nav} sx={{alignSelf: "center", maxWidth: 320}} />;
  const page = (
    <Box sx={{flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: short ? "12px" : "16px", position: "relative"}}>
      {!inHeader && <BackPill nav={nav} />}
      {children}
      {inHeader && slot && createPortal(headerPill, slot)}
    </Box>
  );
  if (embedded) return page;
  return (
    <DesktopShell active={active} eyebrow={BRAND.name} lead={inHeader ? headerPill : undefined}>
      {page}
    </DesktopShell>
  );
}

// The three columns of a desktop page under its header card, each scrolling on its own (P:204). Stacked (in a narrow
// directory frame, see DirectoryFrame) the first keeps a column of its own and the other two share the second column,
// each still scrolling on its own: the upper card takes the height it needs up to 60% of the column, the lower one the
// rest, so both titles are always in view. While the upper card's add field is in use, the lower one gives way down to
// its title row.
export function PageColumns({
  template,
  stackedTemplate,
  children,
}: {
  template: string;
  stackedTemplate: string;
  children: [React.ReactNode, React.ReactNode, React.ReactNode];
}) {
  const stacked = useDirectoryFrame()?.stacked ?? false;
  const [first, second, third] = children;
  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: stacked ? stackedTemplate : template, gridTemplateRows: "minmax(0,1fr)", gap: "18px"}}>
      {first}
      {/* the same element either way, so a column's state (an open add field) stays when the window crosses 1360 px */}
      <Box
        sx={
          stacked
            ? {
                minHeight: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                // (two cards: the upper one is the one that isn't last)
                "& > :not(:last-child)": {flex: "0 1 auto", minHeight: 0, maxHeight: "calc(60% - 9px)"},
                // the lower card's title row (66 px) and the gap stay
                "& > :not(:last-child):focus-within": {maxHeight: "calc(100% - 84px)"},
                "& > :last-child": {flex: "1 1 0", minHeight: 0},
              }
            : {display: "contents"}
        }
      >
        {second}
        {third}
      </Box>
    </Box>
  );
}

// the stacked columns: the Team page's Igrači stays the wider one
export const TEAM_STACKED_GRID = "minmax(0,1.25fr) minmax(0,1fr)";
export const PLAYER_STACKED_GRID = "minmax(0,1fr) minmax(0,1fr)";

// ---------- states ----------

const KIND = {
  team: {error: "Ekipa se nije učitala", missing: "Ekipa ne postoji", text: "Možda je obrisana ili je poveznica pogrešna.", icon: <SearchOffRoundedIcon />},
  player: {error: "Igrač se nije učitao", missing: "Igrač ne postoji", text: "Možda je obrisan ili je poveznica pogrešna.", icon: <PersonOffRoundedIcon />},
} as const;

// What a page shows before it has its data (13k–13n): placeholders while it loads, the error with Pokušaj ponovno,
// or, for an id that doesn't exist (or a deleted player), a message with Početna. A page whose data is in already stays
// on screen when a refresh fails.
export function PageStatus<T>({
  kind,
  overview,
  nav,
  desktop = false,
  template,
}: {
  kind: keyof typeof KIND;
  overview: Overview<T>;
  nav: NavStackControls;
  desktop?: boolean;
  template?: string;
}) {
  const k = KIND[kind];
  const sx: SxProps<Theme> = desktop ? {flex: 1, justifyContent: "center", p: "40px"} : {flex: 1, justifyContent: "center", p: "60px 10px"};
  if (overview.missing) {
    return <MessageState icon={k.icon} title={k.missing} text={k.text} action={{label: "Početna", icon: <HomeRoundedIcon />, onClick: nav.home}} sx={sx} />;
  }
  if (overview.error) return <ErrorState title={k.error} onRetry={overview.reload} sx={sx} />;
  return <PageSkeleton desktop={desktop} template={template} />;
}

// ---------- the cream header card ----------

// read by screen readers, not shown
const visuallyHidden = {position: "absolute", width: "1px", height: "1px", p: 0, m: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0} as const;

// The header card of a Team page (13a/13f) and of a desktop Player page (13g): the initials, the name (and "Neaktivan"
// after it), "Tvoja ekipa" in the top right corner, an optional block on the right (the player's rating) and the
// three tiles. On the phone the name wraps and the tiles are smaller, and the corner tag gets a line of its own above
// the name, so the name keeps the card's full width. In a short desktop window (useShortWindow) the card is about two
// thirds as high: a smaller avatar and name, and tiles of two lines (the sub line follows the number). titleEditor
// takes the name's place while an admin renames the team (the pencil and ✓ come in nameTag; the name stays as a
// heading for screen readers). The name is the page's h1, or an h2 under the "Ekipe"/"Igrači" h1 of the admin's
// directory.
export function HeroCard({
  desktop = false,
  short = false,
  avatarName,
  avatarLetters,
  title,
  titleEditor,
  nameTag,
  cornerTag,
  aside,
  tiles,
}: {
  desktop?: boolean;
  short?: boolean;
  avatarName: string;
  // a team's one letter (teamInitial); a player's initials otherwise
  avatarLetters?: string;
  title: string;
  titleEditor?: React.ReactNode;
  nameTag?: React.ReactNode;
  cornerTag?: React.ReactNode;
  aside?: React.ReactNode;
  tiles: HeroTile[];
}) {
  const titleId = useId();
  const heading = useDirectoryFrame() ? "h2" : "h1";
  const shortDesk = desktop && short;
  const avatar = desktop ? (short ? 48 : 76) : 64;
  // the phone's corner tag sits on a line above the name (4 px over it), so it never takes width from the name
  const phoneTag = !desktop && cornerTag != null;
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{
        flex: "none",
        minWidth: 0,
        borderRadius: desktop ? (short ? "24px" : "28px") : "24px",
        background: color.cream,
        p: desktop ? (short ? "14px 20px" : "22px 24px") : phoneTag ? "14px 20px 20px" : "20px",
        display: "flex",
        flexDirection: "column",
        gap: desktop ? (short ? "10px" : "18px") : "16px",
      }}
    >
      {phoneTag && <Box sx={{display: "flex", justifyContent: "flex-end", mr: "-6px", mb: "-12px"}}>{cornerTag}</Box>}
      <Box sx={{display: "flex", alignItems: "center", gap: desktop ? (short ? "14px" : "18px") : "14px", minWidth: 0}}>
        <InitialsAvatar name={avatarName} letters={avatarLetters} size={avatar} variant="navy" sx={desktop ? {fontSize: short ? 20 : 28} : undefined} />
        {/* the field (and a note under it) and its ✓ line up at the top; the ✓ centres itself on the field */}
        <Box sx={{flex: 1, minWidth: 0, display: "flex", alignItems: titleEditor ? "flex-start" : "center", gap: "10px"}}>
          {titleEditor ? (
            <>
              <Box component={heading} id={titleId} sx={visuallyHidden}>
                {title}
              </Box>
              {titleEditor}
            </>
          ) : (
            <Box
              component={heading}
              id={titleId}
              title={desktop ? title : undefined}
              sx={{
                m: 0,
                minWidth: 0,
                fontFamily: font.display,
                fontWeight: 800,
                ...(desktop
                  ? {fontSize: short ? 32 : 44, lineHeight: 1.05, letterSpacing: "-.025em", ...ellipsis}
                  : // only a word longer than the whole line breaks
                    {fontSize: 32, lineHeight: 1.02, letterSpacing: "-.02em", textWrap: "pretty", overflowWrap: "break-word"}),
              }}
            >
              {title}
            </Box>
          )}
          {nameTag}
        </Box>
        {aside}
        {desktop && cornerTag && <Box sx={{flex: "none", alignSelf: "flex-start", display: "flex", mt: "-4px", mr: "-4px"}}>{cornerTag}</Box>}
      </Box>
      <Box sx={{display: "flex", gap: desktop ? (short ? "8px" : "10px") : "8px"}}>
        {tiles.map((t) => (
          <StatTile key={t.label} compact={!desktop} inline={shortDesk} label={t.label} value={t.value} sub={t.sub} />
        ))}
      </Box>
    </Box>
  );
}

// The player's rating on the right of a desktop Player page's header (P:188-196): "REJTING", Privremeno and the big
// number, with a chevron to the rating's detail (on the desktop Rejting with the player selected). href null: a
// player who isn't on Rejting has no detail, so the block is not a link.
export function HeaderRating({rating, provisional, href, short = false}: {rating: number; provisional: boolean; href: string | null; short?: boolean}) {
  const content = (
    <>
      <Box component="span" sx={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: short ? "3px" : "6px"}}>
        <Box component="span" sx={{fontSize: short ? 12 : 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
          Rejting
        </Box>
        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          {provisional && <ProvisionalTag size="lg" />}
          <Box component="span" sx={{fontFamily: font.display, fontSize: short ? 44 : 64, fontWeight: 800, lineHeight: 0.85, letterSpacing: "-.03em", color: color.ink, ...tabular}}>
            {rating}
          </Box>
        </Box>
      </Box>
      {href && <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 28, color: color.navy}} />}
    </>
  );
  // the link's hover area reaches into the card's padding; without a link the number keeps to the padding
  const sx = {flex: "none", display: "flex", alignItems: "center", gap: "10px", p: href ? "10px 8px 10px 16px" : "10px 0 10px 16px", m: href ? "-10px -8px -10px 0" : "-10px 0", borderRadius: "18px"} as const;
  if (!href) return <Box sx={sx}>{content}</Box>;
  return (
    <Box
      component={TransitionLink}
      href={href}
      title="Otvori rejting"
      sx={{
        ...buttonBase,
        ...sx,
        color: color.ink,
        textDecoration: "none",
        transition: "background 150ms ease",
        "&:hover": {background: tint.white[55]},
      }}
    >
      {content}
    </Box>
  );
}

// ---------- rows ----------

// A row that opens another page, with room for a control of its own (an admin's remove button): the link covers the
// whole row, and a control given `position: relative; z-index: 1` sits above it. The link's focus ring goes round
// the row.
export const stretchedRow = {
  position: "relative",
  "&:has(> a:focus-visible)": rowFocus,
} as const;

export const stretchedLink = {
  ...buttonBase,
  ...stretchedArea,
  textDecoration: "none",
  color: color.ink,
  textAlign: "left",
  "&:focus-visible": {outline: "none"},
} as const;

// The phone card's labels row above a list ("IGRAČ · REJTING"), as on the phone standings (P:119)
export function PhoneListHead({children, sx}: {children: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box
      aria-hidden
      sx={mergeSx(
        {
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          borderBottom: `1px solid ${tint.navy[10]}`,
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: color.muted,
          whiteSpace: "nowrap",
        },
        sx
      )}
    >
      {children}
    </Box>
  );
}

// the chevron at the end of a row that opens a page
export function RowChevron() {
  return <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.navy}} />;
}

// the small dot before a league's status: green while it runs, faint once it is over
export function StatusDot({live}: {live: boolean}) {
  return <Box component="span" aria-hidden sx={{width: 7, height: 7, flex: "none", borderRadius: "50%", background: live ? color.green : color.faint}} />;
}

