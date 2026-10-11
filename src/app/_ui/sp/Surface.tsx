import {color, font, shadow} from "@/app/_styles/tokens";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {cardSx, mergeSx} from "./base";
import {initials} from "@/app/_lib/ui/text";

type CardProps = {
  children?: React.ReactNode;
  sx?: SxProps<Theme>;
  component?: React.ElementType;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

// White rounded surface
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card({children, sx, component = "div", ...rest}, ref) {
  return (
    <Box component={component} ref={ref} sx={mergeSx(cardSx, sx)} {...rest}>
      {children}
    </Box>
  );
});

// White card whose content scrolls inside it (lists that fill the rest of the screen)
export function ScrollCard({children, sx, ...rest}: CardProps) {
  return (
    <Card sx={mergeSx({flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain"}, sx)} {...rest}>
      {children}
    </Card>
  );
}

// Initials circle (cream on navy for the profile, navy on cream in lists)
export function InitialsAvatar({
  name,
  size = 36,
  variant = "cream",
  sx,
}: {
  name: string;
  size?: number;
  variant?: "cream" | "navy";
  sx?: SxProps<Theme>;
}) {
  const navy = variant === "navy";
  return (
    <Box
      component="span"
      aria-hidden
      sx={mergeSx(
        {
          width: size,
          height: size,
          flex: "none",
          borderRadius: "50%",
          background: navy ? color.navy : color.cream,
          color: navy ? color.cream : color.navy,
          fontFamily: size >= 56 ? font.display : undefined,
          fontSize: size >= 56 ? Math.round(size * 0.4) : size >= 36 ? 13 : 12,
          fontWeight: size >= 56 ? 800 : 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        sx
      )}
    >
      {initials(name)}
    </Box>
  );
}

// Player chip: small avatar + username (profile "My Teams", manage league)
export function PlayerChip({name, size = "md"}: {name: string; size?: "sm" | "md"}) {
  const sm = size === "sm";
  return (
    <Box
      component="span"
      sx={{
        height: sm ? 32 : 36,
        display: "inline-flex",
        alignItems: "center",
        gap: sm ? "6px" : "8px",
        pl: sm ? "3px" : "4px",
        pr: sm ? "10px" : "12px",
        borderRadius: sm ? "16px" : "18px",
        background: color.paper,
        fontSize: sm ? 14 : 15,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <InitialsAvatar name={name} size={sm ? 26 : 28} />
      {name}
    </Box>
  );
}

// Cream rounded square with an icon (league rows, team picker)
export function IconTile({children, size = 44, radius = 14}: {children: React.ReactNode; size?: number; radius?: number}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: `${radius}px`,
        background: color.cream,
        color: color.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": {fontSize: size >= 44 ? 24 : 20},
      }}
    >
      {children}
    </Box>
  );
}

// Cream callout with an icon ("Inactive teams stay in the league ...")
export function InfoNote({icon, children, sx}: {icon: React.ReactNode; children: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box
      sx={mergeSx(
        {
          borderRadius: "20px",
          background: color.cream,
          p: "16px 18px",
          display: "flex",
          gap: "12px",
          color: color.navy,
          "& > svg": {fontSize: 24, flex: "none"},
        },
        sx
      )}
    >
      {icon}
      <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.ink}}>
        {children}
      </Box>
    </Box>
  );
}

export const raisedShadow = shadow.raised;
