"use client";

import useReducedMotion from "@/app/_hooks/useReducedMotion";
import {BRAND} from "@/app/_lib/brand";
import {chromeIntentUrl} from "@/app/_lib/installPlatform";
import {useInstallPrompt} from "@/app/_lib/installPrompt";
import {color, ease, font, shadow} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";
import AddToHomeScreenRoundedIcon from "@mui/icons-material/AddToHomeScreenRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import InstallMobileRoundedIcon from "@mui/icons-material/InstallMobileRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";
import OpenInBrowserRoundedIcon from "@mui/icons-material/OpenInBrowserRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import ToggleOnRoundedIcon from "@mui/icons-material/ToggleOnRounded";
import {Box, Drawer, keyframes} from "@mui/material";
import React, {useEffect, useId, useState} from "react";

// Mobile · install prompt flow (Claude Design). On the phone login page and every time Home opens in the browser, a
// skippable sheet offers to install the app. Chrome on Android gets an install button (its own dialog follows, then
// a success screen); Safari, and Chrome when it doesn't offer installing, get the menu steps with an arrow pointing
// at the menu. Samsung Internet instead gets a link that opens the page in Chrome, as Play Protect blocks what
// Samsung's own install builds (ChromeHandoff). Opened from the home screen, nothing shows.

const IOS_BLUE = "#0A84FF";
const ANDROID_BLUE = "#0B57D0";
// a moment after the page appears, so Chrome has announced whether it can install before the sheet picks a variant
const OPEN_DELAY_MS = 600;

const bob = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}`;

type Step = {text: string; icon: React.ReactNode};

const IOS_STEPS: Step[] = [
  {text: "Dodirni ••• desno od adrese", icon: <MoreHorizRoundedIcon />},
  {text: "Dodirni Podijeli", icon: <IosShareRoundedIcon />},
  {text: "Dodirni Više, pa Dodaj na početni zaslon", icon: <AddBoxRoundedIcon />},
  {text: "Ostavi uključeno Otvori kao web-aplikaciju i dodirni Dodaj", icon: <ToggleOnRoundedIcon />},
];

const ANDROID_STEPS: Step[] = [
  {text: "Dodirni ⋮ gore desno", icon: <MoreVertRoundedIcon />},
  {text: "Dodirni Dodaj na početni zaslon", icon: <AddToHomeScreenRoundedIcon />},
  {text: "Odaberi Instaliraj", icon: <InstallMobileRoundedIcon />},
];

export default function InstallSheet() {
  const {platform, standalone, canPrompt, installed, prompt} = useInstallPrompt();
  const reduce = useReducedMotion();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const offered = (platform === "android" || platform === "samsung" || platform === "ios") && !standalone;
  useEffect(() => {
    if (!offered) return;
    const t = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [offered]);

  if (!offered) return null;
  // Chrome only: on Samsung an accepted install can still end in Play Protect's block
  if (installed && platform === "android") return <Installed />;

  const ios = platform === "ios";
  const samsung = platform === "samsung";
  // never Samsung's own install, neither its prompt() nor its menu: both build the package Play Protect blocks
  const steps = ios ? IOS_STEPS : samsung || canPrompt ? null : ANDROID_STEPS;
  const install = async () => {
    setBusy(true);
    const accepted = await prompt();
    setBusy(false);
    if (accepted) setOpen(false);
  };
  const arrowSx = {position: "fixed", zIndex: 1301, pointerEvents: "none", "& svg": {fontSize: 34}, animation: reduce ? "none" : `${bob} 1.2s ease-in-out infinite`} as const;

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        transitionDuration={{enter: 260, exit: 200}}
        SlideProps={{easing: {enter: ease, exit: "cubic-bezier(.4,0,.6,1)"}}}
        slotProps={{backdrop: {sx: {background: "rgba(21,24,31,.42)"}}}}
        PaperProps={{
          role: "dialog",
          "aria-labelledby": titleId,
          sx: {
            maxWidth: 560,
            mx: "auto",
            borderRadius: "28px 28px 0 0",
            background: color.card,
            boxShadow: shadow.sheet,
            p: "10px 22px calc(24px + env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          },
        }}
      >
        <Box aria-hidden sx={{alignSelf: "center", width: 40, height: 5, borderRadius: "3px", background: color.switchOff}} />
        <Box sx={{display: "flex", alignItems: "center", gap: "14px", pt: "4px"}}>
          <AppIcon size={60} radius="16px" />
          <Box component="h2" id={titleId} sx={{m: 0, minWidth: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.05}}>
            {BRAND.name} radi bolje kao aplikacija
          </Box>
        </Box>
        <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.inkSoft, textWrap: "pretty"}}>
          Otvara se preko cijelog zaslona, bez trake preglednika, i pokreće se ravno s početnog zaslona.
        </Box>
        {samsung ? (
          <ChromeHandoff />
        ) : steps ? (
          <Box component="ol" aria-label="Kako instalirati" sx={{listStyle: "none", m: 0, p: "4px 14px", borderRadius: "18px", background: color.paper}}>
            {steps.map((s, i) => (
              <Box
                component="li"
                key={s.text}
                sx={{minHeight: 50, py: "6px", display: "flex", alignItems: "center", gap: "12px", borderBottom: i < steps.length - 1 ? "1px solid rgba(60,74,103,.1)" : "none"}}
              >
                <Box component="span" aria-hidden sx={{width: 26, height: 26, flex: "none", borderRadius: "50%", background: color.navy, color: "#FFFFFF", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}>
                  {i + 1}
                </Box>
                <Box component="span" sx={{flex: 1, fontSize: 15, fontWeight: 600, lineHeight: 1.3}}>
                  {s.text}
                </Box>
                <Box component="span" aria-hidden sx={{width: 34, height: 34, flex: "none", borderRadius: "10px", background: color.card, color: ios ? IOS_BLUE : ANDROID_BLUE, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
                  {s.icon}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Box
            component="button"
            type="button"
            onClick={install}
            disabled={busy}
            sx={{...buttonBase, height: 60, borderRadius: "18px", background: color.navy, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: 18, fontWeight: 600, boxShadow: shadow.action, "& svg": {fontSize: 24}, "&:disabled": {opacity: 0.7}}}
          >
            <InstallMobileRoundedIcon />
            Instaliraj aplikaciju
          </Box>
        )}
        <Box component="button" type="button" onClick={() => setOpen(false)} sx={{...buttonBase, height: 48, borderRadius: "14px", background: "transparent", color: color.inkSoft, fontSize: 16, fontWeight: 600}}>
          Nastavi u pregledniku
        </Box>
      </Drawer>
      {/* where the steps start: Safari's ••• under the page, Chrome's ⋮ above it */}
      {open && ios && (
        <Box aria-hidden sx={{...arrowSx, right: "29px", bottom: "calc(4px + env(safe-area-inset-bottom))", color: IOS_BLUE}}>
          <SouthRoundedIcon />
        </Box>
      )}
      {open && steps && !ios && (
        <Box aria-hidden sx={{...arrowSx, right: "8px", top: "8px", color: ANDROID_BLUE}}>
          <NorthRoundedIcon />
        </Box>
      )}
    </>
  );
}

// The app icon as drawn in the design: the cream BL monogram on navy
function AppIcon({size, radius, inverted = false}: {size: number; radius: string; inverted?: boolean}) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: radius,
        background: inverted ? color.cream : color.navy,
        color: inverted ? color.navy : color.cream,
        fontFamily: font.display,
        fontSize: Math.round(size * 0.38),
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {BRAND.initials}
    </Box>
  );
}

// Samsung Internet on a Galaxy installs the app as a package built on Samsung's server for an old Android, and Play
// Protect blocks it. Chrome's install isn't blocked, so Samsung users open the page there. Chrome has its own cookies:
// it opens on the login page, which shows this sheet again with Chrome's install.
function ChromeHandoff() {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const url = `${window.location.origin}/login`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      setCopy("failed"); // no clipboard access: the address is shown to copy by hand
    }
  };

  return (
    <>
      <Box sx={{p: "12px 14px", borderRadius: "18px", background: color.paper, fontSize: 15, lineHeight: 1.45, textWrap: "pretty"}}>
        Iz Samsung Interneta Android može blokirati instalaciju („Nesigurna aplikacija blokirana“). Instaliraj je iz
        Chromea i tamo se ponovno prijavi. Ako te pita čime otvoriti, odaberi Chrome.
      </Box>
      {/* a real link: Android follows an intent only from a tap */}
      <Box
        component="a"
        href={chromeIntentUrl(url)}
        sx={{...buttonBase, height: 60, borderRadius: "18px", background: color.navy, color: "#FFFFFF", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: 18, fontWeight: 600, boxShadow: shadow.action, "& svg": {fontSize: 24}}}
      >
        <OpenInBrowserRoundedIcon />
        Otvori u Chromeu
      </Box>
      {/* whether Samsung opens Chrome, asks first or does nothing varies; the link can always be pasted into Chrome */}
      <Box component="button" type="button" onClick={copyLink} sx={{...buttonBase, minHeight: 40, background: "transparent", color: color.inkSoft, fontSize: 14, fontWeight: 600, textDecoration: "underline"}}>
        Ne otvara se? Kopiraj poveznicu
      </Box>
      {/* the result is read out where the button stays focused */}
      <Box role="status" sx={{mt: "-8px", textAlign: "center", fontSize: 14, lineHeight: 1.4, color: color.inkSoft, "&:empty": {display: "none"}}}>
        {copy === "copied" && "Poveznica je kopirana, zalijepi je u Chrome."}
        {copy === "failed" && (
          <>
            Upiši u Chrome:{" "}
            <Box component="span" sx={{userSelect: "all", fontWeight: 700, color: color.ink, overflowWrap: "anywhere"}}>
              {url}
            </Box>
          </>
        )}
      </Box>
    </>
  );
}

// After Chrome installed the app: the browser tab has done its job, the app is on the home screen
function Installed() {
  return (
    <Box
      role="status"
      sx={{position: "fixed", inset: 0, zIndex: 1400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", px: "28px", textAlign: "center", background: color.navy, color: "#FFFFFF"}}
    >
      <Box aria-hidden sx={{width: 88, height: 88, borderRadius: "50%", background: color.cream, color: color.green, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 52}}}>
        <CheckRoundedIcon />
      </Box>
      <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1.05}}>
        Aplikacija je instalirana
      </Box>
      <Box sx={{fontSize: 16, lineHeight: 1.45, color: color.cream, maxWidth: 300}}>Zatvori preglednik i otvori {BRAND.nameAccusative} s početnog zaslona.</Box>
      <Box
        aria-hidden
        sx={{width: "100%", maxWidth: 300, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "14px 10px", p: "18px 16px", borderRadius: "24px", background: "rgba(255,255,255,.08)", mt: "6px"}}
      >
        {Array.from({length: 8}, (_, i) =>
          i === 5 ? (
            <Box key={i} sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
              <Box sx={{borderRadius: "50%", boxShadow: "0 0 0 3px rgba(237,224,191,.45), 0 0 0 7px rgba(237,224,191,.18)"}}>
                <AppIcon size={52} radius="50%" inverted />
              </Box>
              <Box component="span" sx={{fontSize: 11, fontWeight: 700, whiteSpace: "nowrap"}}>
                {BRAND.name}
              </Box>
            </Box>
          ) : (
            <Box key={i} sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
              <Box sx={{width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,.14)"}} />
              <Box component="span" sx={{height: 14}} />
            </Box>
          )
        )}
      </Box>
    </Box>
  );
}
