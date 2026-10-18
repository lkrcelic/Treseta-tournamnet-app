"use client";

import {sendSponsorEvent} from "@/app/_fetchers/sponsors";
import useReducedMotion from "@/app/_hooks/useReducedMotion";
import {SponsorPublic} from "@/app/_interfaces/sponsor";
import {isSafeUrl} from "@/app/_lib/nights";
import {bandRounds, bandSeconds, logoTile} from "@/app/_lib/ui/sponsors";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, IconCircleButton} from "@/app/_ui/sp";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {Box, Dialog, SxProps, Theme} from "@mui/material";
import React, {useEffect, useId, useLayoutEffect, useRef, useState} from "react";

// A logo to draw: a saved sponsor's, or the one the admin just picked (its preview)
export type LogoSource = {name: string; logo: string; logo_width: number; logo_height: number; dark: boolean};

// A sponsor's logo in its tile (logoTile): the same rounded rectangle for every logo, white with a hairline (so it
// shows on a white card too), or dark for a light logo without a background
export function SponsorLogo({sponsor, height, sx}: {sponsor: LogoSource; height: number; sx?: SxProps<Theme>}) {
  const t = logoTile(height);
  return (
    <Box
      component="span"
      sx={[
        {
          flex: "none",
          width: t.width,
          height: t.height,
          boxSizing: "border-box",
          p: `${t.padY}px ${t.padX}px`,
          borderRadius: `${t.radius}px`,
          background: sponsor.dark ? color.logoPlate : color.white,
          border: `1px solid ${sponsor.dark ? color.logoPlate : color.line}`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a logo from the API, already small; next/image adds nothing */}
      <Box component="img" src={sponsor.logo} alt="" draggable={false} sx={{width: "100%", height: "100%", objectFit: "contain", display: "block"}} />
    </Box>
  );
}

// The sponsors' band: their logos slide slowly from right to left without end (about 12 px a second). It stops while
// a finger or the mouse is on it, so a logo is easy to hit; each logo is a button that opens its sponsor's card. The
// logos repeat until one round fills the band, and the round goes twice, so the band slides by one round and starts
// again without a gap; the copies are hidden from screen readers and skipped by the keyboard. With "reduce motion" it
// stands still and scrolls by hand.
export function SponsorBand({
  sponsors,
  height,
  gap,
  onOpen,
  fade = 28,
  sx,
}: {
  sponsors: SponsorPublic[];
  height: number;
  // the space between two logos
  gap: number;
  onOpen: (s: SponsorPublic) => void;
  // how far in from each end the logos fade out
  fade?: number;
  sx?: SxProps<Theme>;
}) {
  const reduce = useReducedMotion();
  const bandRef = useRef<HTMLDivElement>(null);
  const [bandWidth, setBandWidth] = useState(0);
  const [held, setHeld] = useState(false);
  const roundWidth = sponsors.length * (logoTile(height).width + gap);
  const rounds = reduce ? 1 : bandRounds(bandWidth, roundWidth);

  useLayoutEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const measure = () => setBandWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a finger lifted lets the band go on a moment later, after its tap has opened the card
  const release = () => window.setTimeout(() => setHeld(false), 300);
  const items = Array.from({length: reduce ? 1 : rounds * 2}, (_, r) => sponsors.map((s) => ({s, copy: r > 0, key: `${r}-${s.id}`}))).flat();
  const edge = `linear-gradient(90deg, transparent, black ${fade}px, black calc(100% - ${fade}px), transparent)`;

  return (
    <Box
      ref={bandRef}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      onPointerDown={(e) => e.pointerType !== "mouse" && setHeld(true)}
      onPointerUp={(e) => e.pointerType !== "mouse" && release()}
      onPointerCancel={release}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      sx={[
        {
          minWidth: 0,
          overflowX: reduce ? "auto" : "hidden",
          overflowY: "hidden",
          WebkitMaskImage: reduce ? "none" : edge,
          maskImage: reduce ? "none" : edge,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        component="ul"
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          display: "flex",
          alignItems: "center",
          width: "max-content",
          animation: reduce || bandWidth === 0 ? "none" : `spBand ${bandSeconds(roundWidth * rounds)}s linear infinite`,
          animationPlayState: held ? "paused" : "running",
        }}
      >
        {items.map(({s, copy, key}) => (
          <Box component="li" key={key} aria-hidden={copy || undefined} sx={{flex: "none", display: "flex", px: `${gap / 2}px`}}>
            <Box
              component="button"
              type="button"
              tabIndex={copy ? -1 : undefined}
              aria-label={copy ? undefined : `Sponzor ${s.name}`}
              onClick={() => onOpen(s)}
              sx={{...buttonBase, display: "flex", borderRadius: "12px", transition: "transform 120ms ease", "&:active": {transform: "scale(.96)"}}}
            >
              <SponsorLogo sponsor={s} height={height} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// One view for each sponsor of the band, once per opening of the page that shows it (the sponsors' counts)
export function useSponsorViews(leagueId: number | null | undefined, sponsors: SponsorPublic[] | null) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (leagueId == null || !sponsors?.length) return;
    const key = `${leagueId}:${sponsors.map((s) => s.id).join(",")}`;
    if (sent.current === key) return;
    sent.current = key;
    sendSponsorEvent(leagueId, "view", sponsors.map((s) => s.id));
  }, [leagueId, sponsors]);
}

// What a sponsor's card holds, on the phone and the computer: the big logo, the message for the players and, when
// the sponsor has a link, "Otvori stranicu" (a new tab, counted for the sponsor)
function CardBody({sponsor, leagueId}: {sponsor: SponsorPublic; leagueId: number | null | undefined}) {
  const link = isSafeUrl(sponsor.url) ? sponsor.url!.trim() : null;
  return (
    <>
      <Box sx={{flex: "none", display: "flex", justifyContent: "center", p: "6px 0 4px"}}>
        <SponsorLogo sponsor={sponsor} height={96} />
      </Box>
      {sponsor.message && (
        <Box sx={{flex: "none", p: "14px 16px", borderRadius: "16px", background: color.paper2, fontSize: 16, lineHeight: 1.45, color: color.ink, textAlign: "center", textWrap: "pretty"}}>
          {sponsor.message}
        </Box>
      )}
      {link && (
        <Box
          component="a"
          href={link}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={() => leagueId != null && sendSponsorEvent(leagueId, "click", [sponsor.id])}
          sx={{
            ...buttonBase,
            flex: "none",
            height: 56,
            borderRadius: "16px",
            background: color.navy,
            color: color.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: 16,
            fontWeight: 600,
            textDecoration: "none",
            "& svg": {fontSize: 20},
          }}
        >
          <OpenInNewRoundedIcon />
          Otvori stranicu
        </Box>
      )}
    </>
  );
}

// The sponsor's card from below (Početna on the phone)
export function SponsorSheet({sponsor, leagueId, onClose}: {sponsor: SponsorPublic | null; leagueId: number | null | undefined; onClose: () => void}) {
  // the sponsor stays on the sheet while it slides away
  const [shown, setShown] = useState(sponsor);
  useEffect(() => {
    if (sponsor) setShown(sponsor);
  }, [sponsor]);
  return (
    <BottomSheet open={sponsor != null} onClose={onClose} title={shown?.name ?? ""} closable>
      {shown && <CardBody sponsor={shown} leagueId={leagueId} />}
    </BottomSheet>
  );
}

// The sponsor's card in the middle of the screen (the live round on the computer)
export function SponsorDialog({sponsor, leagueId, onClose}: {sponsor: SponsorPublic | null; leagueId: number | null | undefined; onClose: () => void}) {
  const titleId = useId();
  return (
    <Dialog
      open={sponsor != null}
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[42]}}}}
      PaperProps={{sx: {width: 440, maxWidth: "calc(100% - 32px)", borderRadius: "28px", p: "22px 24px 24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      {sponsor && (
        <>
          <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
            <Box component="h2" id={titleId} sx={{m: 0, minWidth: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em"}}>
              {sponsor.name}
            </Box>
            <IconCircleButton label="Zatvori" size={44} onClick={onClose} sx={{boxShadow: "none", background: color.paper, "& svg": {fontSize: 22}}}>
              <CloseRoundedIcon />
            </IconCircleButton>
          </Box>
          <CardBody sponsor={sponsor} leagueId={leagueId} />
        </>
      )}
    </Dialog>
  );
}
