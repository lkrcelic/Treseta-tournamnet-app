import {color, font, shadow, tint} from "@/app/_styles/tokens";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {Box, Skeleton, SxProps, Theme} from "@mui/material";
import React from "react";
import {buttonBase, mergeSx} from "./base";

// navy on light surfaces, white on navy and on the team colours; the track is the same colour at 25%
const SPINNER_TONE = {
  navy: {ink: color.navy, track: tint.navy[25]},
  white: {ink: color.white, track: tint.white[25]},
} as const;

export function Spinner({size = 22, tone = "navy", label}: {size?: number; tone?: keyof typeof SPINNER_TONE; label?: string}) {
  const {ink, track} = SPINNER_TONE[tone];
  return (
    <Box
      component="span"
      role={label ? "status" : undefined}
      aria-label={label}
      sx={{
        display: "inline-block",
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        border: `3px solid ${track}`,
        borderTopColor: ink,
        animation: "spSpin 700ms linear infinite",
      }}
    />
  );
}

export function CenteredSpinner({label = "Učitavanje"}: {label?: string}) {
  return (
    <Box sx={{flex: 1, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center"}}>
      <Spinner size={32} label={label} />
    </Box>
  );
}

// Placeholder rows while a list loads, sized like the real rows so nothing jumps
export function LoadingRows({rows = 6, height = 62, sx}: {rows?: number; height?: number; sx?: SxProps<Theme>}) {
  return (
    <Box role="status" aria-label="Učitavanje" sx={mergeSx({display: "flex", flexDirection: "column"}, sx)}>
      {Array.from({length: rows}).map((_, i) => (
        <Box
          key={i}
          sx={{height, display: "flex", alignItems: "center", gap: "12px", px: "16px", borderBottom: `1px solid ${color.line}`}}
        >
          <Skeleton variant="circular" width={28} height={28} />
          <Box sx={{flex: 1}}>
            <Skeleton variant="text" width={`${60 - (i % 3) * 12}%`} height={20} />
          </Box>
          <Skeleton variant="text" width={36} height={28} />
        </Box>
      ))}
    </Box>
  );
}

// An empty list's message. With icon (an inbox unless another is given), the smaller empty card of the Team and
// Player pages (13m, 13o): the icon in rule above 14 px text.
export function EmptyState({children, icon, sx}: {children: React.ReactNode; icon?: boolean | React.ReactNode; sx?: SxProps<Theme>}) {
  if (!icon) {
    return (
      <Box sx={mergeSx({py: "40px", px: "20px", textAlign: "center", fontSize: 15, color: color.muted}, sx)}>{children}</Box>
    );
  }
  return (
    <Box
      sx={mergeSx(
        {
          p: "28px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 1.45,
          color: color.muted,
          "& > svg": {fontSize: 28, color: color.rule},
        },
        sx
      )}
    >
      {icon === true ? <InboxRoundedIcon aria-hidden /> : icon}
      <span>{children}</span>
    </Box>
  );
}

// A whole page or list that has nothing to show (failed to load, not found, empty, no search match): a round icon,
// a title, a line of text and an optional action (Rejting 8g/8h, Team and Player pages 13l). onCard: on a white card
// the circle is paper, on the paper background it is white.
export function MessageState({
  icon,
  title,
  text,
  action,
  onCard = false,
  role = "status",
  sx,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  action?: {label: string; icon?: React.ReactNode; onClick: () => void};
  onCard?: boolean;
  role?: "status" | "alert";
  sx?: SxProps<Theme>;
}) {
  return (
    <Box role={role} sx={mergeSx({p: "56px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center"}, sx)}>
      <Box
        aria-hidden
        sx={{width: 64, height: 64, flex: "none", borderRadius: "50%", background: onCard ? color.paper : color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 32}}}
      >
        {icon}
      </Box>
      <Box sx={{fontFamily: font.display, fontSize: 22, fontWeight: 800, textWrap: "balance"}}>{title}</Box>
      {text && <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>{text}</Box>}
      {action && (
        <Box
          component="button"
          type="button"
          onClick={action.onClick}
          sx={{
            ...buttonBase,
            mt: "6px",
            height: 48,
            px: "22px",
            borderRadius: "16px",
            background: color.navy,
            color: color.white,
            fontSize: 16,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            "& svg": {fontSize: 20},
          }}
        >
          {action.icon}
          {action.label}
        </Box>
      )}
    </Box>
  );
}

// A page or list that didn't load (13l): "Ekipa se nije učitala" / "Igrač se nije učitao", "Provjeri vezu i pokušaj
// ponovno." and Pokušaj ponovno
export function ErrorState({title, onRetry, onCard, sx}: {title: React.ReactNode; onRetry?: () => void; onCard?: boolean; sx?: SxProps<Theme>}) {
  return (
    <MessageState
      role="alert"
      icon={<CloudOffRoundedIcon />}
      title={title}
      text="Provjeri vezu i pokušaj ponovno."
      action={onRetry && {label: "Pokušaj ponovno", icon: <RefreshRoundedIcon />, onClick: onRetry}}
      onCard={onCard}
      sx={sx}
    />
  );
}

// opacities of the placeholder cards, top to bottom (left to right on the desktop)
const SKELETON_FADE = [1, 0.82, 0.64, 0.46];

// A page while it loads (13k phone, 13n desktop): a cream header placeholder, then white cards — a list of four on
// the phone, a row of columns filling the height on the desktop (template: the page's grid-template-columns, equal
// columns by default)
export function PageSkeleton({
  desktop = false,
  columns = 3,
  template,
  sx,
}: {
  desktop?: boolean;
  columns?: number;
  template?: string;
  sx?: SxProps<Theme>;
}) {
  const block = (i: number) => ({borderRadius: "20px", background: color.white, boxShadow: shadow.card, opacity: SKELETON_FADE[i]});
  if (!desktop) {
    return (
      <Box role="status" aria-label="Učitavanje" sx={mergeSx({display: "flex", flexDirection: "column", gap: "14px"}, sx)}>
        <Box sx={{height: 150, borderRadius: "24px", background: color.cream, opacity: 0.6}} />
        {SKELETON_FADE.map((_, i) => (
          <Box key={i} sx={{height: 72, ...block(i)}} />
        ))}
      </Box>
    );
  }
  return (
    <Box role="status" aria-label="Učitavanje" sx={mergeSx({flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "18px"}, sx)}>
      <Box sx={{height: 200, flex: "none", borderRadius: "28px", background: color.cream, opacity: 0.6}} />
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: template ?? `repeat(${columns}, minmax(0,1fr))`, gap: "18px"}}>
        {Array.from({length: columns}, (_, i) => (
          <Box key={i} sx={{minHeight: 0, ...block(Math.min(i, SKELETON_FADE.length - 1))}} />
        ))}
      </Box>
    </Box>
  );
}

// Inline error with an optional retry
export function ErrorNote({
  children,
  onRetry,
  sx,
}: {
  children: React.ReactNode;
  onRetry?: () => void;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      role="alert"
      sx={mergeSx(
        {
          display: "flex",
          // on a narrow phone the retry button drops under the message instead of squeezing it to a word per line
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: "10px",
          rowGap: "4px",
          p: "12px 14px",
          borderRadius: "16px",
          background: tint.red[10],
          // ink text: red text on the red tint would be under 4:1; the icon and the tint carry the red
          color: color.ink,
          fontSize: 15,
          fontWeight: 600,
          "& > svg": {fontSize: 20, flex: "none", color: color.red},
        },
        sx
      )}
    >
      <ErrorRoundedIcon />
      <Box sx={{flex: "1 1 140px", minWidth: 0}}>{children}</Box>
      {onRetry && (
        <Box
          component="button"
          type="button"
          onClick={onRetry}
          sx={{...buttonBase, fontWeight: 700, color: color.navy, px: "8px", minHeight: 36, borderRadius: "8px", ml: "auto"}}
        >
          Pokušaj ponovno
        </Box>
      )}
    </Box>
  );
}

export function SuccessNote({children, sx}: {children: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box
      role="status"
      sx={mergeSx(
        {p: "12px 14px", borderRadius: "16px", background: tint.green[12], color: color.green, fontSize: 15, fontWeight: 600},
        sx
      )}
    >
      {children}
    </Box>
  );
}
