"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {BRAND} from "@/app/_lib/brand";
import {color, font, tint} from "@/app/_styles/tokens";
import {Box} from "@mui/material";
import React from "react";

// Brand block: the eyebrow (if any) over the big wordmark
export function Brand({size = 56, light = false}: {size?: number; light?: boolean}) {
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: size > 60 ? "6px" : "4px"}}>
      {BRAND.eyebrow && (
        <Box
          sx={{fontSize: size > 60 ? 14 : 13, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: light ? color.cream : color.muted}}
        >
          {BRAND.eyebrow}
        </Box>
      )}
      <Box sx={{fontFamily: font.display, fontSize: size, fontWeight: 800, lineHeight: 0.92, letterSpacing: "-.03em"}}>{BRAND.name}</Box>
    </Box>
  );
}

// Login / signup frame. Phone: brand on top, content below. Desktop: navy brand half on the left, form on the right.
export function AuthFrame({children, phoneBrand = true}: {children: React.ReactNode; phoneBrand?: boolean}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Box sx={{minHeight: "100dvh", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)"}}>
        <Box sx={{background: color.navy, color: color.white, p: "64px", display: "flex", flexDirection: "column"}}>
          <Brand size={96} light />
        </Box>
        <Box component="main" sx={{display: "flex", alignItems: "center", justifyContent: "center", p: "48px"}}>
          {children}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        maxWidth: 560,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        px: "20px",
        pt: "calc(20px + env(safe-area-inset-top))",
        pb: "calc(24px + env(safe-area-inset-bottom))",
        boxSizing: "border-box",
      }}
    >
      {phoneBrand && (
        <Box sx={{p: "40px 4px 28px"}}>
          <Brand />
        </Box>
      )}
      {children}
    </Box>
  );
}

// "ili" divider between Google and the password form
export function OrDivider() {
  return (
    <Box role="separator" aria-label="ili" sx={{display: "flex", alignItems: "center", gap: "12px", color: color.muted, fontSize: 14}}>
      <Box sx={{flex: 1, height: "1px", background: tint.navy[12]}} />
      ili
      <Box sx={{flex: 1, height: "1px", background: tint.navy[12]}} />
    </Box>
  );
}
