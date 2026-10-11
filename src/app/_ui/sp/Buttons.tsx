import {color, font, shadow} from "@/app/_styles/tokens";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {buttonBase, mergeSx} from "./base";
import {Spinner} from "./States";

type NativeButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">;

type PrimaryButtonProps = NativeButtonProps & {
  icon?: React.ReactNode;
  loading?: boolean;
  // background / text color, e.g. the winning team's color on "Završi meč"
  bg?: string;
  ink?: string;
  height?: number;
  sx?: SxProps<Theme>;
};

// The 60 px navy action at the bottom of a phone screen
export const PrimaryButton = React.forwardRef<HTMLButtonElement, PrimaryButtonProps>(function PrimaryButton(
  {icon, loading = false, bg = color.navy, ink = "#FFFFFF", height = 60, disabled, children, sx, type = "button", ...rest},
  ref
) {
  const off = disabled || loading;
  return (
    <Box
      component="button"
      ref={ref}
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      sx={mergeSx(
        buttonBase,
        {
          width: "100%",
          height,
          flex: "none",
          borderRadius: "18px",
          background: bg,
          color: ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          fontSize: 18,
          fontWeight: 600,
          boxShadow: shadow.action,
          opacity: disabled && !loading ? 0.4 : 1,
          transition: "background 300ms ease, transform 120ms ease, opacity 200ms ease",
          "&:active:not(:disabled)": {transform: "scale(.98)"},
          "& svg": {fontSize: 24},
        },
        sx
      )}
      {...rest}
    >
      {loading ? <Spinner size={22} color={ink} /> : icon}
      <span>{children}</span>
    </Box>
  );
});

type OutlineButtonProps = NativeButtonProps & {sx?: SxProps<Theme>; tone?: string; height?: number};

// "Nazad" style: transparent with a navy outline
export function OutlineButton({children, sx, tone = color.navy, height = 56, type = "button", ...rest}: OutlineButtonProps) {
  return (
    <Box
      component="button"
      type={type}
      sx={mergeSx(
        buttonBase,
        {
          height,
          borderRadius: "16px",
          border: `2px solid ${tone}`,
          color: tone,
          fontSize: 17,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          "&:active:not(:disabled)": {transform: "scale(.98)"},
          "&:disabled": {opacity: 0.4},
        },
        sx
      )}
      {...rest}
    >
      {children}
    </Box>
  );
}

type SolidButtonProps = NativeButtonProps & {sx?: SxProps<Theme>; height?: number; loading?: boolean};

// Navy filled button without the large shadow (wizard "Dalje", desktop "Submit")
export function SolidButton({children, sx, height = 56, disabled, loading, type = "button", ...rest}: SolidButtonProps) {
  return (
    <Box
      component="button"
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      sx={mergeSx(
        buttonBase,
        {
          height,
          borderRadius: "16px",
          background: color.navy,
          color: "#FFFFFF",
          fontSize: 17,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          opacity: disabled && !loading ? 0.4 : 1,
          transition: "opacity 200ms ease, transform 120ms ease",
          "&:active:not(:disabled)": {transform: "scale(.98)"},
        },
        sx
      )}
      {...rest}
    >
      {loading && <Spinner size={18} color="#FFFFFF" />}
      {children}
    </Box>
  );
}

// Nazad / Dalje pair at the bottom of the hand wizard
export function ActionPair({
  onBack,
  backLabel = "Nazad",
  nextLabel,
  onNext,
  nextDisabled,
  nextLoading,
}: {
  onBack: () => void;
  backLabel?: string;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}) {
  return (
    <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", flex: "none"}}>
      <OutlineButton onClick={onBack}>{backLabel}</OutlineButton>
      <SolidButton onClick={onNext} disabled={nextDisabled} loading={nextLoading}>
        {nextLabel}
      </SolidButton>
    </Box>
  );
}

type IconCircleButtonProps = NativeButtonProps & {
  label: string;
  size?: number;
  sx?: SxProps<Theme>;
  children: React.ReactNode;
};

// 48 px white round button (back arrow, profile, date arrows, menu)
export function IconCircleButton({label, size = 48, children, sx, type = "button", ...rest}: IconCircleButtonProps) {
  return (
    <Box
      component="button"
      type={type}
      aria-label={label}
      title={label}
      sx={mergeSx(
        buttonBase,
        {
          width: size,
          height: size,
          flex: "none",
          borderRadius: "50%",
          background: color.card,
          color: color.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: shadow.raised,
          transition: "box-shadow 160ms ease, opacity 160ms ease",
          "&:hover:not(:disabled)": {boxShadow: "0 4px 12px rgba(31,36,51,.14)"},
          "&:disabled": {opacity: 0.35},
          "& svg": {fontSize: size >= 48 ? 28 : 24},
        },
        sx
      )}
      {...rest}
    >
      {children}
    </Box>
  );
}

// Small flat icon button (clear "×", close drawer, logout in the user card)
export function GhostIconButton({label, children, sx, size = 44, type = "button", ...rest}: IconCircleButtonProps) {
  return (
    <Box
      component="button"
      type={type}
      aria-label={label}
      title={label}
      sx={mergeSx(
        buttonBase,
        {
          width: size,
          height: size,
          flex: "none",
          borderRadius: "12px",
          color: color.muted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "&:hover": {background: color.hover},
          "& svg": {fontSize: 22},
        },
        sx
      )}
      {...rest}
    >
      {children}
    </Box>
  );
}

// "Otvori ›" chip on desktop home cards
export function ChipButton({children, sx, type = "button", ...rest}: NativeButtonProps & {sx?: SxProps<Theme>}) {
  return (
    <Box
      component="button"
      type={type}
      sx={mergeSx(
        buttonBase,
        {
          height: 36,
          px: "12px",
          pr: "8px",
          borderRadius: "10px",
          background: color.paper,
          color: color.navy,
          display: "flex",
          alignItems: "center",
          gap: "2px",
          fontSize: 14,
          fontWeight: 600,
          "&:hover": {background: "#EEE9DD"},
          "& svg": {fontSize: 20},
        },
        sx
      )}
      {...rest}
    >
      {children}
    </Box>
  );
}

// Low-emphasis text action ("Nemaš profil? Registriraj se", "Log Out")
export function TextButton({children, sx, type = "button", ...rest}: NativeButtonProps & {sx?: SxProps<Theme>}) {
  return (
    <Box
      component="button"
      type={type}
      sx={mergeSx(
        buttonBase,
        {
          minHeight: 48,
          px: "16px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontSize: 16,
          fontWeight: 600,
          color: color.navy,
          "&:hover": {background: color.hover},
          "& svg": {fontSize: 22},
        },
        sx
      )}
      {...rest}
    >
      {children}
    </Box>
  );
}

// "Load more · 7 teams left" under a list that shows its results a page at a time
export function LoadMoreButton({left, noun, onClick, sx}: {left: number; noun: [string, string]; onClick: () => void; sx?: SxProps<Theme>}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={mergeSx(
        buttonBase,
        {
          width: "100%",
          height: 48,
          flex: "none",
          background: color.tableHead,
          color: color.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          fontSize: 14,
          fontWeight: 600,
          "&:hover": {background: color.paper},
          "& svg": {fontSize: 20},
        },
        sx
      )}
    >
      <ExpandMoreRoundedIcon aria-hidden />
      Load more · {left} {left === 1 ? noun[0] : noun[1]} left
    </Box>
  );
}

export const displayFont = font.display;
