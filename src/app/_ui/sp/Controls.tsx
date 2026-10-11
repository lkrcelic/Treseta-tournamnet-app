import {color, ease, font, shadow} from "@/app/_styles/tokens";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useRef} from "react";
import {buttonBase, mergeSx, tabular} from "./base";
import {LiveDot} from "./Live";

// Visual 52×32 switch track. Use inside an element that has role="switch" + aria-checked.
export function SwitchTrack({on, onColor = color.navy}: {on: boolean; onColor?: string}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: "relative",
        flex: "none",
        width: 52,
        height: 32,
        borderRadius: "16px",
        background: on ? onColor : color.switchOff,
        transition: "background 180ms ease",
      }}
    >
      <Box
        component="span"
        sx={{
          position: "absolute",
          top: "3px",
          left: "3px",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          transform: on ? "translateX(20px)" : "none",
          transition: `transform 180ms ${ease}`,
        }}
      />
    </Box>
  );
}

// A full-width row that toggles: label on the left, switch on the right (Create Round team list)
export function SwitchRow({
  checked,
  onChange,
  children,
  disabled,
  sx,
  onColor,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
  sx?: SxProps<Theme>;
  onColor?: string;
}) {
  return (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      sx={mergeSx(
        buttonBase,
        {
          width: "100%",
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          pl: "16px",
          pr: "14px",
          borderBottom: `1px solid ${color.line}`,
          fontSize: 16,
          fontWeight: 500,
          color: checked ? color.ink : color.faint,
          textAlign: "left",
        },
        sx
      )}
    >
      <Box component="span" sx={{display: "flex", alignItems: "center", gap: "8px", minWidth: 0}}>
        {children}
      </Box>
      <SwitchTrack on={checked} onColor={onColor} />
    </Box>
  );
}

// Label + big number + stacked +/- buttons (Rounds, Window)
export function Stepper({
  label,
  value,
  onInc,
  onDec,
  canInc = true,
  canDec = true,
  sx,
}: {
  label: string;
  value: number;
  onInc: () => void;
  onDec: () => void;
  canInc?: boolean;
  canDec?: boolean;
  sx?: SxProps<Theme>;
}) {
  const stepBtn = {
    ...buttonBase,
    width: 44,
    height: 26,
    borderRadius: "9px",
    background: color.paper,
    color: color.navy,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "&:disabled": {opacity: 0.35},
    "& svg": {fontSize: 20},
  } as const;
  return (
    <Box
      role="group"
      aria-label={label}
      sx={mergeSx(
        {
          background: color.card,
          borderRadius: "20px",
          p: "10px 8px 10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          boxShadow: shadow.card,
        },
        sx
      )}
    >
      <Box sx={{display: "flex", flexDirection: "column"}}>
        <Box component="span" sx={{fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: color.muted}}>
          {label}
        </Box>
        <Box
          component="output"
          aria-live="polite"
          sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.1, ...tabular}}
        >
          {value}
        </Box>
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box component="button" type="button" aria-label={`Povećaj: ${label}`} onClick={onInc} disabled={!canInc} sx={stepBtn}>
          <AddRoundedIcon />
        </Box>
        <Box component="button" type="button" aria-label={`Smanji: ${label}`} onClick={onDec} disabled={!canDec} sx={stepBtn}>
          <RemoveRoundedIcon />
        </Box>
      </Box>
    </Box>
  );
}

export type TabItem<K extends string | number> = {key: K; label: React.ReactNode; live?: boolean; count?: number; alert?: boolean};

// Arrow-key navigation shared by the tab strips (WAI-ARIA tabs pattern, automatic activation)
function useRovingKeys<K extends string | number>(items: TabItem<K>[], value: K, onChange: (k: K) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = items.findIndex((t) => t.key === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].key);
    refs.current[next]?.focus();
  };
  return {refs, onKeyDown};
}

// Scrollable pill tabs on phone (Tablica okupljanja / Round 1 / ...)
export function PillTabs<K extends string | number>({
  items,
  value,
  onChange,
  label,
  sx,
  idPrefix,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  sx?: SxProps<Theme>;
  // gives the tabs ids and points them at `${idPrefix}-panel` (see tabPanelProps)
  idPrefix?: string;
}) {
  const {refs, onKeyDown} = useRovingKeys(items, value, onChange);
  return (
    <Box
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      sx={mergeSx(
        {display: "flex", gap: "8px", overflowX: "auto", mx: "-20px", px: "20px", pb: "2px", flex: "none", scrollbarWidth: "none"},
        sx
      )}
    >
      {items.map((t, i) => {
        const on = t.key === value;
        return (
          <Box
            key={String(t.key)}
            component="button"
            type="button"
            role="tab"
            aria-selected={on}
            id={idPrefix ? `${idPrefix}-tab-${t.key}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
            tabIndex={on ? 0 : -1}
            ref={(el: HTMLButtonElement | null) => {
              refs.current[i] = el;
            }}
            onClick={() => onChange(t.key)}
            sx={{
              ...buttonBase,
              flex: "none",
              height: 44,
              px: "16px",
              borderRadius: "22px",
              background: on ? color.navy : color.card,
              color: on ? "#FFFFFF" : color.ink,
              fontSize: 15,
              fontWeight: 600,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: shadow.card,
              transition: "background 200ms ease, color 200ms ease",
            }}
          >
            {t.label}
            {t.live && <LiveDot pulse={false} label="uživo" />}
          </Box>
        );
      })}
    </Box>
  );
}

// Segmented control: white track with a navy (variant "solid") or white-raised (variant "soft") selected segment;
// "panel" is a compact white box with a navy selected segment (Daily's table filter). An item's `alert` count is red
// while it isn't selected.
export function Segmented<K extends string | number>({
  items,
  value,
  onChange,
  label,
  variant = "solid",
  size = 40,
  sx,
  asTabs = true,
  idPrefix,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  variant?: "solid" | "soft" | "panel";
  size?: number;
  sx?: SxProps<Theme>;
  asTabs?: boolean;
  idPrefix?: string;
}) {
  const {refs, onKeyDown} = useRovingKeys(items, value, onChange);
  const solid = variant === "solid";
  const panel = variant === "panel";
  const navyOn = solid || panel;
  return (
    <Box
      role={asTabs ? "tablist" : "radiogroup"}
      aria-label={label}
      onKeyDown={onKeyDown}
      sx={mergeSx(
        {
          display: "flex",
          flex: "none",
          gap: solid ? "6px" : "4px",
          p: solid ? "4px" : "3px",
          borderRadius: solid ? "24px" : "14px",
          background: navyOn ? color.card : color.paper,
          boxShadow: navyOn ? shadow.card : "none",
        },
        sx
      )}
    >
      {items.map((t, i) => {
        const on = t.key === value;
        return (
          <Box
            key={String(t.key)}
            component="button"
            type="button"
            role={asTabs ? "tab" : "radio"}
            aria-selected={asTabs ? on : undefined}
            aria-checked={asTabs ? undefined : on}
            id={idPrefix ? `${idPrefix}-tab-${t.key}` : undefined}
            aria-controls={idPrefix && asTabs ? `${idPrefix}-panel` : undefined}
            tabIndex={on ? 0 : -1}
            ref={(el: HTMLButtonElement | null) => {
              refs.current[i] = el;
            }}
            onClick={() => onChange(t.key)}
            sx={{
              ...buttonBase,
              flex: "none",
              whiteSpace: "nowrap",
              height: size,
              px: solid ? "16px" : panel ? "14px" : "12px",
              borderRadius: solid ? `${size / 2}px` : "11px",
              background: on ? (navyOn ? color.navy : color.card) : "transparent",
              color: on ? (navyOn ? "#FFFFFF" : color.ink) : solid ? color.ink : color.inkSoft,
              boxShadow: on && !navyOn ? "0 1px 3px rgba(31,36,51,.12)" : "none",
              fontSize: solid ? 15 : 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background 160ms ease, color 160ms ease",
            }}
          >
            {t.label}
            {t.live && <LiveDot pulse={false} label="uživo" />}
            {t.count != null && (
              <Box
                component="span"
                sx={{fontSize: 12, fontWeight: 700, ...tabular, color: on && navyOn ? color.cream : t.alert ? color.red : color.faint}}
              >
                {t.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// Props for the element a tab strip controls
export function tabPanelProps(idPrefix: string, value: string | number) {
  return {role: "tabpanel", id: `${idPrefix}-panel`, "aria-labelledby": `${idPrefix}-tab-${value}`} as const;
}
