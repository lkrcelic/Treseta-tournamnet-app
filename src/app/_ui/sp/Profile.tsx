"use client";

import {changeTone, nightResult} from "@/app/_lib/ui/ratings";
import {matchesQuery} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, ease, font, shadow, tint} from "@/app/_styles/tokens";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {Box, keyframes, SxProps, Theme} from "@mui/material";
import React, {useEffect, useId, useRef, useState} from "react";
import {buttonBase, ellipsis, mergeSx, tabular} from "./base";
import {IconCircleButton} from "./Buttons";

// Pieces of the Team and Player pages (handoff §6, komponente/Profiles.dc.html, abbreviated P below), shared with Moj
// profil and Rejting

// ---------- header card ----------

// One number on the cream header card (P:198): "NAJBOLJE MJESTO / #3 / Piatnik Bela Liga 2025". compact is the phone
// size: three tiles share the width, so a long label wraps and the numbers stay level at the bottom. inline is the
// short desktop window's (under 800 px high): the sub line follows the number on its line ("#3 Piatnik Bela…"), so
// the tile is two lines high.
export function StatTile({
  label,
  value,
  sub,
  compact = false,
  inline = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  compact?: boolean;
  inline?: boolean;
}) {
  if (inline) {
    const text = typeof sub === "string" && sub ? sub : undefined;
    return (
      <Box sx={{flex: 1, minWidth: 0, borderRadius: "14px", background: tint.white[62], p: "8px 12px", display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 11, fontWeight: 700, letterSpacing: ".08em", lineHeight: 1.2, textTransform: "uppercase", color: color.ink2, ...ellipsis}}>
          {label}
        </Box>
        <Box component="span" title={text} sx={{display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0}}>
          <Box component="span" sx={{flex: "none", fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1.05, color: color.ink, whiteSpace: "nowrap", ...tabular}}>
            {value}
          </Box>
          <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.3, color: color.ink2, ...ellipsis}}>
            {sub}
          </Box>
        </Box>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: "16px",
        background: tint.white[62],
        p: compact ? "10px 12px" : "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        // a 320 px phone: "NAJBOLJE" still fits on one line
        "@media (max-width: 359.98px)": compact ? {px: "8px"} : undefined,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          letterSpacing: compact ? ".06em" : ".08em",
          lineHeight: 1.2,
          textTransform: "uppercase",
          color: color.ink2,
          // a word breaks only when it is wider than the whole tile
          overflowWrap: "break-word",
          "@media (max-width: 359.98px)": compact ? {letterSpacing: ".02em"} : undefined,
        }}
      >
        {label}
      </Box>
      <Box
        component="span"
        sx={{mt: compact ? "auto" : 0, fontFamily: font.display, fontSize: compact ? 22 : 26, fontWeight: 800, lineHeight: 1.05, color: color.ink, whiteSpace: "nowrap", ...tabular}}
      >
        {value}
      </Box>
      <Box component="span" sx={{minHeight: "1.3em", fontSize: compact ? 12 : 12.5, lineHeight: 1.3, color: color.ink2, ...ellipsis}}>
        {sub}
      </Box>
    </Box>
  );
}

const TAG = {
  // the viewer is in the team (P:181)
  mine: {label: "Tvoja ekipa", background: color.navy, color: color.white},
  // a deactivated player (P:186)
  inactive: {label: "Neaktivan", background: color.white, color: color.red},
} as const;

// A small label on a header card: "Tvoja ekipa" (navy) or "Neaktivan" (red on white, with a block icon). sm is the
// phone size; row is the one in a white list row (a Team page's player), where "Neaktivan" sits on a red tint.
export function Tag({variant, size = "md", sx}: {variant: keyof typeof TAG; size?: "sm" | "md" | "row"; sx?: SxProps<Theme>}) {
  const t = TAG[variant];
  const sm = size === "sm";
  const row = size === "row";
  return (
    <Box
      component="span"
      sx={mergeSx(
        {
          height: row ? 20 : sm ? 24 : 26,
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: row ? "3px" : "4px",
          px: row ? "6px" : sm ? "9px" : variant === "mine" ? "10px" : "9px",
          borderRadius: row ? "6px" : sm ? "8px" : "9px",
          background: row && variant === "inactive" ? tint.red[8] : t.background,
          color: t.color,
          fontSize: row ? 11 : sm ? 12 : 12.5,
          fontWeight: 700,
          whiteSpace: "nowrap",
          "& svg": {fontSize: row ? 13 : 16, ml: "-2px"},
        },
        sx
      )}
    >
      {variant === "inactive" && <BlockRoundedIcon aria-hidden />}
      {t.label}
    </Box>
  );
}

const PROVISIONAL = {
  sm: {height: 18, fontSize: 10.5, radius: 6, px: 6}, // Rejting rows
  row: {height: 20, fontSize: 11, radius: 6, px: 6}, // Team page player rows, the rating strip of a profile
  md: {height: 22, fontSize: 11.5, radius: 7, px: 7}, // the desktop Rejting list
  lg: {height: 24, fontSize: 12, radius: 8, px: 8}, // the cream cards (Rejting detail, the Player page's rating)
} as const;

// A rating that is still settling (fewer than 8 rated rounds)
export function ProvisionalTag({size = "sm"}: {size?: keyof typeof PROVISIONAL}) {
  const p = PROVISIONAL[size];
  return (
    <Box
      component="span"
      sx={{
        height: p.height,
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        px: `${p.px}px`,
        borderRadius: `${p.radius}px`,
        border: `1px solid ${tint.navy[40]}`,
        fontSize: p.fontSize,
        fontWeight: 700,
        letterSpacing: 0,
        textTransform: "none",
        color: color.navy,
        whiteSpace: "nowrap",
      }}
    >
      Privremeno
    </Box>
  );
}

const CHANGE_INK = {up: color.green, down: color.red, flat: color.muted} as const;

// The colour of a rating change ("+15" green, "−8" red, none muted), as Rejting, the profiles and the Team page show it
export const changeInk = (change: number | null) => CHANGE_INK[changeTone(change)];

const RESULT = {
  up: {background: tint.green[12], color: color.green},
  down: {background: tint.red[10], color: color.red},
  flat: {background: color.lineFill, color: color.ink2},
} as const;

// A night's matches won:lost on a tinted pill ("3:1" green, "1:3" red, "2:2" grey), in Rejting's last nights and on
// the desktop Player page (sm, a narrower column)
export function ResultPill({won, lost, size = "md", sx}: {won: number; lost: number; size?: "sm" | "md"; sx?: SxProps<Theme>}) {
  const res = nightResult(won, lost);
  return (
    <Box
      component="span"
      aria-label={`mečevi ${res.label}`}
      sx={mergeSx(
        {
          height: 26,
          display: "flex",
          alignItems: "center",
          px: size === "sm" ? "7px" : "8px",
          borderRadius: "8px",
          ...RESULT[res.tone],
          fontSize: size === "sm" ? 13.5 : 14,
          fontWeight: 700,
          whiteSpace: "nowrap",
          ...tabular,
        },
        sx
      )}
    >
      {res.label}
    </Box>
  );
}

const CHIP = {
  // "Stranica ekipe ›" on team cards (P:107)
  36: {pl: "12px", pr: "6px", radius: "18px", fontSize: 13.5, icon: 20},
  // "Profil igrača ›" on the desktop rating card
  32: {pl: "12px", pr: "6px", radius: "16px", fontSize: 13.5, icon: 20},
  // "Profil ›" on the phone rating card
  30: {pl: "10px", pr: "4px", radius: "15px", fontSize: 13, icon: 18},
} as const;

// The "Stranica ekipe ›" pill: a link to another page. Without href it is only the pill, inside a card that is the
// link itself (the cream rating card). tone white = on the cream cards.
export function ChipLink({
  href,
  children,
  height = 36,
  tone = "paper",
  "aria-label": ariaLabel,
  title,
  sx,
}: {
  href?: string;
  children: React.ReactNode;
  height?: keyof typeof CHIP;
  tone?: "paper" | "white";
  // a fuller name for screen readers when several pills read the same ("Stranica ekipe Puleni")
  "aria-label"?: string;
  // the pointer's tooltip ("Otvori profil igrača")
  title?: string;
  sx?: SxProps<Theme>;
}) {
  const c = CHIP[height];
  const look = mergeSx(
    buttonBase,
    {
      height,
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "2px",
      pl: c.pl,
      pr: c.pr,
      borderRadius: c.radius,
      background: tone === "white" ? tint.white[70] : color.paper,
      color: color.navy,
      fontSize: c.fontSize,
      fontWeight: 600,
      whiteSpace: "nowrap",
      textDecoration: "none",
      "& svg": {fontSize: c.icon},
    },
    // only under a pointer: a phone keeps :hover after a tap, which would leave the pill lit on the next page
    href ? {"@media (hover: hover)": {"&:hover": {background: tone === "white" ? color.white : color.lineFill}}} : undefined,
    sx
  );
  const content = (
    <>
      {children}
      <ChevronRightRoundedIcon aria-hidden />
    </>
  );
  if (!href) {
    return (
      <Box component="span" sx={look}>
        {content}
      </Box>
    );
  }
  return (
    <Box component={TransitionLink} href={href} aria-label={ariaLabel} title={title} sx={look}>
      {content}
    </Box>
  );
}

// ---------- desktop columns ----------

// The labels row above a column's list (P:216): "IGRAČ · REJTING", on the same grid as the rows below. In a column too
// short for an open add field's hits it gives way first (with the list under it).
export function ColumnHead({grid, children, sx}: {grid: string; children: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box
      aria-hidden
      sx={mergeSx(
        {
          flex: "0 1000 auto",
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: grid,
          gap: "12px",
          alignItems: "center",
          height: 40,
          px: "20px",
          borderTop: `1px solid ${color.line}`,
          borderBottom: `1px solid ${tint.navy[12]}`,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: color.muted,
          whiteSpace: "nowrap",
          // the same scrollbar gutter as the list below, so the labels stay over their values with classic scrollbars
          overflow: "hidden",
          scrollbarGutter: "stable",
        },
        sx
      )}
    >
      {children}
    </Box>
  );
}

// One column of a desktop Team or Player page (P:205): a white card filling the grid row, with its title (and a count or
// a button on the right), an optional search-and-add field, an optional labels row (ColumnHead), and a list that scrolls
// on its own. empty replaces the list (the labels stay, 13o). The title row is 66 px high whatever is on its right (a
// count or a 38 px button), so the three columns' rows line up. While the add field lists its hits, the field takes the
// height it needs and the list below gives way.
export function ColumnCard({
  title,
  right,
  addField,
  header,
  children,
  empty,
  sx,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  addField?: React.ReactNode;
  header?: React.ReactNode;
  children?: React.ReactNode;
  empty?: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  const titleId = useId();
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={mergeSx(
        {
          minHeight: 0,
          minWidth: 0,
          background: color.white,
          borderRadius: "24px",
          boxShadow: shadow.card,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        sx
      )}
    >
      <Box sx={{flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", boxSizing: "border-box", minHeight: 66, p: "16px 20px 10px"}}>
        <Box component="h2" id={titleId} sx={{m: 0, minWidth: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1}}>
          {title}
        </Box>
        {right != null && (
          <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "8px", fontSize: 14, fontWeight: 600, color: color.muted, whiteSpace: "nowrap"}}>{right}</Box>
        )}
      </Box>
      {addField && <Box sx={{flex: "0 1 auto", minHeight: 0, display: "flex", flexDirection: "column", p: "0 20px 14px"}}>{addField}</Box>}
      {header}
      <Box
        sx={{flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable", overscrollBehavior: "contain", borderTop: header ? undefined : `1px solid ${color.line}`}}
      >
        {empty || children}
      </Box>
    </Box>
  );
}

// ---------- search and add (desktop admin) ----------

export type AddOption = {
  id: number | string;
  name: string;
  // the second line of a hit ("@iperic · Dalmatinci", "3 igrača · 2 lige")
  sub?: string;
  // what typing searches in, when more than the name (a player's username)
  search?: string;
};

// The dashed "Dodaj igrača · ime ili korisničko ime" field at the top of a column (P:207-215): on focus it lists every
// option, typing filters them, and each hit has a navy Dodaj that adds it at once (the field empties and closes).
// note is always shown under the field; noHit when the typed text matches nothing. In a short column the list of hits
// shrinks (and scrolls) to fit under the field instead of running out of the card. disabled: nothing can be added now
// (a deactivated player can't join a team); the field is greyed and the note says why.
export function SearchAddField({
  placeholder,
  icon,
  options,
  onAdd,
  note,
  noHit,
  disabled = false,
  sx,
}: {
  placeholder: string;
  icon: React.ReactNode;
  options: AddOption[];
  onAdd: (option: AddOption) => void;
  note?: React.ReactNode;
  noHit?: React.ReactNode;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const noteId = useId();
  const cancelClose = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => {
    const timer = closeTimer;
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  // the focus going back to the field after Dodaj or Escape leaves the list closed (typing opens it again)
  const quietFocus = useRef(false);
  const focusField = () => {
    const input = inputRef.current;
    if (!input || document.activeElement === input) return;
    quietFocus.current = true;
    input.focus();
  };

  const hits = open && !disabled ? options.filter((o) => matchesQuery(o.search ?? o.name, query)) : [];
  const typed = query.trim() !== "";

  const add = (o: AddOption) => {
    cancelClose();
    setQuery("");
    setOpen(false);
    onAdd(o);
    focusField();
  };

  return (
    <Box
      onFocus={() => {
        cancelClose();
        if (quietFocus.current) quietFocus.current = false;
        else setOpen(true);
      }}
      onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
        // focus moving to a Dodaj keeps the list; leaving the field closes it a moment later, so a click on Dodaj
        // (which in Safari doesn't take the focus) still lands
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        cancelClose();
        closeTimer.current = window.setTimeout(() => setOpen(false), 180);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          focusField();
        }
      }}
      sx={mergeSx({flex: "0 1 auto", minHeight: 0, display: "flex", flexDirection: "column", gap: "6px"}, sx)}
    >
      <Box
        component="label"
        sx={{
          height: 50,
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          px: "14px",
          borderRadius: "14px",
          border: `1.5px dashed ${tint.navy[35]}`,
          background: color.white,
          boxSizing: "border-box",
          cursor: disabled ? "default" : "text",
          opacity: disabled ? 0.55 : 1,
          transition: "border-color 150ms ease",
          "&:focus-within": {borderColor: color.navy},
          "& > svg": {fontSize: 22, color: color.navy, flex: "none"},
        }}
      >
        {icon}
        <Box
          component="input"
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={disabled}
          aria-controls={listId}
          aria-describedby={note || noHit ? noteId : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          // a click on the field that already has the focus (after Dodaj) opens the list again
          onClick={() => setOpen(true)}
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            p: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            font: "inherit",
            fontSize: 15,
            color: color.ink,
            "&::placeholder": {color: color.muted, opacity: 1},
            "&:disabled": {cursor: "default"},
          }}
        />
      </Box>
      <Box
        component="ul"
        id={listId}
        aria-label="Rezultati"
        hidden={hits.length === 0}
        sx={{
          flex: "0 1 auto",
          minHeight: 0,
          listStyle: "none",
          m: 0,
          p: 0,
          display: hits.length ? "flex" : "none",
          flexDirection: "column",
          gap: "6px",
          maxHeight: 236,
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {hits.map((o) => (
          <Box
            component="li"
            key={o.id}
            sx={{
              minHeight: 54,
              boxSizing: "border-box",
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              p: "7px 6px 7px 14px",
              borderRadius: "14px",
              background: color.paper2,
            }}
          >
            <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
              {/* names wrap instead of being cut: league names differ only at their end ("… Jesen 25/26") */}
              <Box component="span" sx={{fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: color.ink, overflowWrap: "anywhere"}}>
                {o.name}
              </Box>
              {o.sub && (
                <Box component="span" title={o.sub} sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                  {o.sub}
                </Box>
              )}
            </Box>
            <Box
              component="button"
              type="button"
              aria-label={`Dodaj: ${o.name}`}
              onClick={() => add(o)}
              sx={{
                ...buttonBase,
                height: 40,
                flex: "none",
                p: "0 14px 0 10px",
                borderRadius: "12px",
                background: color.navy,
                color: color.white,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: 14,
                fontWeight: 600,
                "& svg": {fontSize: 18},
              }}
            >
              <AddRoundedIcon aria-hidden />
              Dodaj
            </Box>
          </Box>
        ))}
      </Box>
      {/* in a short column the note gives way to the hits before the list shrinks */}
      <Box
        id={noteId}
        aria-live="polite"
        sx={{flex: "0 1000 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "6px", "&:empty": {display: "none"}}}
      >
        {typed && open && hits.length === 0 && noHit && <Box sx={{pl: "4px", fontSize: 12.5, lineHeight: 1.4, color: color.muted}}>{noHit}</Box>}
        {note && <Box sx={{pl: "4px", fontSize: 12.5, lineHeight: 1.4, color: color.muted}}>{note}</Box>}
      </Box>
    </Box>
  );
}

// ---------- side panel (desktop admin) ----------

const panelFade = keyframes`from{opacity:0}to{opacity:1}`;
const panelIn = keyframes`from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}`;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// a dialog opened over the panel (a confirmation) keeps its own keys
function inOtherDialog(el: Element | null, panel: HTMLElement): boolean {
  const dialog = el?.closest('[role="dialog"], [role="alertdialog"]');
  return dialog != null && dialog !== panel;
}

// Tab and Shift+Tab go round the panel's controls: the page behind the scrim is out of reach, as aria-modal says
function keepTabIn(e: KeyboardEvent, panel: HTMLElement) {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
  const active = document.activeElement;
  if (!items.length) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const inside = active != null && panel.contains(active);
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey ? !inside || active === first || active === panel : !inside || active === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}

// A panel over the page column, from the right (P:359-390, "Uredi osobne podatke"): a scrim over the page only (the
// directory next to it stays as it is), a 440 px white panel with its title, the name under it and Zatvori, a body
// that scrolls and a footer of equal buttons. The page column must be position: relative. Escape and the scrim close it
// (not an Escape a control inside already handled: preventDefault); the focus goes into the panel, Tab stays in it,
// and the focus goes back to where it was. busy: something the panel started is on its way (Spremi), and the panel
// stays until it answers (Zatvori is disabled, Escape and the scrim do nothing), so its outcome is always seen.
export function SidePanel({
  open,
  onClose,
  busy = false,
  title,
  sub,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  title: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const close = () => {
    if (!busyRef.current) closeRef.current();
  };

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || inOtherDialog(document.activeElement, panel)) return;
      // a control in the panel that takes Escape itself (a confirmation it cancels) says so with preventDefault
      if (e.key === "Escape") {
        if (!e.defaultPrevented && !busyRef.current) closeRef.current();
      }
      else if (e.key === "Tab") keepTabIn(e, panel);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before?.isConnected) before.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <Box
        aria-hidden
        onClick={close}
        sx={{
          position: "absolute",
          inset: "-4px",
          zIndex: 8,
          borderRadius: "24px",
          background: tint.scrim[32],
          animation: `${panelFade} 200ms ease`,
          "@media (prefers-reduced-motion: reduce)": {animation: "none"},
        }}
      />
      <Box
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 9,
          width: 440,
          maxWidth: "100%",
          background: color.white,
          borderRadius: "24px",
          boxShadow: shadow.panel,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
          animation: `${panelIn} 240ms ${ease}`,
          "@media (prefers-reduced-motion: reduce)": {animation: "none"},
        }}
      >
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: "18px 20px 14px", borderBottom: `1px solid ${color.line}`}}>
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
            <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1.15}}>
              {title}
            </Box>
            {sub && <Box sx={{fontSize: 13, color: color.muted, ...ellipsis}}>{sub}</Box>}
          </Box>
          <IconCircleButton
            label="Zatvori"
            size={40}
            onClick={close}
            disabled={busy}
            sx={{background: color.paper, boxShadow: "none", "&:hover:not(:disabled)": {background: color.lineFill, boxShadow: "none"}, "& svg": {fontSize: 22}}}
          >
            <CloseRoundedIcon />
          </IconCircleButton>
        </Box>
        {/* short, with a scrollbar of its own: the desktop's round scroll arrows would sit on its switches and buttons */}
        <Box
          data-no-scroll-arrows
          sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", p: "16px 20px", display: "flex", flexDirection: "column", gap: "14px"}}
        >
          {children}
        </Box>
        {footer && (
          <Box sx={{flex: "none", display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(0,1fr)", gap: "10px", p: "14px 20px 18px", borderTop: `1px solid ${color.line}`}}>
            {footer}
          </Box>
        )}
      </Box>
    </>
  );
}
