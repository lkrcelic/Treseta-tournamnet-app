import {color} from "@/app/_styles/tokens";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";
import {displaySx, eyebrowSx, mergeSx} from "./base";

type TextProps = {children: React.ReactNode; sx?: SxProps<Theme>; id?: string};

// Small uppercase label above titles and sections
export function Eyebrow({children, sx, id}: TextProps) {
  return (
    <Box id={id} sx={mergeSx(eyebrowSx, sx)}>
      {children}
    </Box>
  );
}

// Section heading inside a screen ("Details", "My Teams", "Admin Controls")
export function SectionLabel({children, sx, id}: TextProps) {
  return (
    <Box component="h2" id={id} sx={mergeSx(eyebrowSx, {m: 0, px: "6px"}, sx)}>
      {children}
    </Box>
  );
}

type DisplayProps = TextProps & {
  size?: number;
  as?: "h1" | "h2" | "h3" | "div" | "span";
};

// Bricolage Grotesque headline / number
export function Display({children, size = 36, as = "h1", sx, id}: DisplayProps) {
  return (
    <Box component={as} id={id} sx={mergeSx(displaySx, {fontSize: size}, sx)}>
      {children}
    </Box>
  );
}

// Eyebrow + title block used at the top of most phone screens
export function ScreenTitle({
  eyebrow,
  title,
  size = 36,
  sx,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  size?: number;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box sx={mergeSx({display: "flex", flexDirection: "column", gap: "6px", px: "4px"}, sx)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Display size={size}>{title}</Display>
    </Box>
  );
}

export function Muted({children, sx}: TextProps) {
  return <Box sx={mergeSx({fontSize: 15, color: color.inkSoft, lineHeight: 1.45}, sx)}>{children}</Box>;
}
