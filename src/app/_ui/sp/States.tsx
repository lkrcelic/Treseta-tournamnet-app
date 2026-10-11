import {color} from "@/app/_styles/tokens";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import {Box, Skeleton, SxProps, Theme} from "@mui/material";
import React from "react";
import {buttonBase, mergeSx} from "./base";

export function Spinner({size = 22, color: ink = color.navy, label}: {size?: number; color?: string; label?: string}) {
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
        border: `3px solid ${ink}40`,
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

export function EmptyState({children, sx}: {children: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box sx={mergeSx({py: "40px", px: "20px", textAlign: "center", fontSize: 15, color: color.muted}, sx)}>{children}</Box>
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
          alignItems: "center",
          gap: "10px",
          p: "12px 14px",
          borderRadius: "16px",
          background: "rgba(188,71,73,.1)",
          color: "#8E2F31",
          fontSize: 15,
          fontWeight: 600,
          "& > svg": {fontSize: 20, flex: "none"},
        },
        sx
      )}
    >
      <ErrorRoundedIcon />
      <Box sx={{flex: 1}}>{children}</Box>
      {onRetry && (
        <Box
          component="button"
          type="button"
          onClick={onRetry}
          sx={{...buttonBase, fontWeight: 700, color: color.navy, px: "8px", minHeight: 36, borderRadius: "8px"}}
        >
          Pokušaj ponovo
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
        {p: "12px 14px", borderRadius: "16px", background: "rgba(56,102,65,.12)", color: "#2B5233", fontSize: 15, fontWeight: 600},
        sx
      )}
    >
      {children}
    </Box>
  );
}
