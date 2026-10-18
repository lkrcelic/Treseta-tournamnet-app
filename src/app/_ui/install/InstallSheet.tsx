"use client";

import useReducedMotion from "@/app/_hooks/useReducedMotion";
import {BRAND} from "@/app/_lib/brand";
import {chromeIntentUrl, installEnvLabel, type InstallEnv} from "@/app/_lib/installPlatform";
import {useInstallPrompt} from "@/app/_lib/installPrompt";
// osBlue: the system blue of each OS, as in its own menus
import {color, ease, font, platform as osBlue, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";
import AddToHomeScreenRoundedIcon from "@mui/icons-material/AddToHomeScreenRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import InstallMobileRoundedIcon from "@mui/icons-material/InstallMobileRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import NorthRoundedIcon from "@mui/icons-material/NorthRounded";
import OpenInBrowserRoundedIcon from "@mui/icons-material/OpenInBrowserRounded";
import SouthRoundedIcon from "@mui/icons-material/SouthRounded";
import ToggleOnRoundedIcon from "@mui/icons-material/ToggleOnRounded";
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded";
import {Box, Drawer, keyframes} from "@mui/material";
import React, {useEffect, useId, useState} from "react";

// Mobile · install prompt flow (Claude Design, "PWA po preglednicima": I1–I6 on the iPhone, A1–A7 on Android). On the
// phone login page and every time Home opens in the browser, a skippable sheet offers to install the app, in the way
// the browser it opened in allows. Chrome on Android (and Edge, Opera or Brave when they offer it) gets an install
// button, its own dialog follows, then a success screen; every other browser gets the steps for its own menu with an
// arrow pointing at where they start. Samsung Internet gets a link that opens the page in Chrome, as Play Protect
// blocks what Samsung's own install builds (ChromeHandoff), and a browser inside an app (Instagram, Facebook…), which
// can't install at all, is sent to Chrome or Safari. Opened from the home screen, nothing shows.

// a moment after the page appears, so Chrome has announced whether it can install before the sheet picks a variant
const OPEN_DELAY_MS = 600;

const bob = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}`;

type Step = {text: string; icon: React.ReactNode};

const SHARE_ADD: Step = {text: "Dodirni Dodaj na početni zaslon", icon: <AddBoxRoundedIcon />};
const ADD: Step = {text: "Dodirni Dodaj", icon: <CheckRoundedIcon />};

const IOS_STEPS: Step[] = [
  {text: "Dodirni ••• desno od adrese", icon: <MoreHorizRoundedIcon />},
  {text: "Dodirni Podijeli", icon: <IosShareRoundedIcon />},
  {text: "Dodirni Više, pa Dodaj na početni zaslon", icon: <AddBoxRoundedIcon />},
  {text: "Ostavi uključeno Otvori kao web-aplikaciju i dodirni Dodaj", icon: <ToggleOnRoundedIcon />},
];
const IOS_CHROME_STEPS: Step[] = [
  {text: "Dodirni Podijeli desno u traci adrese", icon: <IosShareRoundedIcon />},
  {text: "Pomakni dolje i dodirni Dodaj na početni zaslon", icon: <AddBoxRoundedIcon />},
  ADD,
];
const IOS_EDGE_STEPS: Step[] = [{text: "Dodirni Podijeli desno u traci adrese", icon: <IosShareRoundedIcon />}, SHARE_ADD, ADD];
const IOS_FIREFOX_STEPS: Step[] = [{text: "Dodirni Podijeli u traci adrese", icon: <IosShareRoundedIcon />}, SHARE_ADD, ADD];
const IOS_INAPP_STEPS: Step[] = [
  {text: "Dodirni ••• gore desno", icon: <MoreHorizRoundedIcon />},
  {text: "Odaberi Otvori u Safariju (ili u pregledniku)", icon: <OpenInBrowserRoundedIcon />},
  {text: "U Safariju će te ovaj prozor dočekati s uputama", icon: <ArrowForwardRoundedIcon />},
];
const IOS_UNKNOWN_STEPS: Step[] = [
  {text: "Dodirni Podijeli u svom pregledniku", icon: <IosShareRoundedIcon />},
  {text: "Potraži Dodaj na početni zaslon", icon: <AddBoxRoundedIcon />},
  {text: "Nema? Kopiraj poveznicu i otvori je u Safariju", icon: <ContentCopyRoundedIcon />},
];

const ANDROID_STEPS: Step[] = [
  {text: "Dodirni ⋮ gore desno (dolje desno ako ti je traka adrese dolje)", icon: <MoreVertRoundedIcon />},
  {text: "Dodirni Dodaj na početni zaslon", icon: <AddToHomeScreenRoundedIcon />},
  {text: "Odaberi Instaliraj", icon: <InstallMobileRoundedIcon />},
];
const ANDROID_FIREFOX_STEPS: Step[] = [
  {text: "Dodirni ⋮ (dolje ili gore desno)", icon: <MoreVertRoundedIcon />},
  {text: "Dodirni Instaliraj (ili Više → Dodaj aplikaciju na početni zaslon)", icon: <InstallMobileRoundedIcon />},
  {text: "Potvrdi Dodaj", icon: <CheckRoundedIcon />},
];
const ANDROID_EDGE_STEPS: Step[] = [
  {text: "Dodirni ☰ dolje desno", icon: <MenuRoundedIcon />},
  {text: "Dodirni Dodaj na telefon (ili Instaliraj aplikaciju)", icon: <AddToHomeScreenRoundedIcon />},
  {text: "Dodirni Instaliraj", icon: <InstallMobileRoundedIcon />},
];
const ANDROID_OTHER_STEPS: Step[] = [
  {text: "Dodirni izbornik preglednika (⋮ ili ☰)", icon: <MoreVertRoundedIcon />},
  {text: "Potraži Instaliraj ili Dodaj na početni zaslon", icon: <AddToHomeScreenRoundedIcon />},
  {text: "Ne vidiš ga? Otvori u Chromeu", icon: <OpenInBrowserRoundedIcon />},
];
const ANDROID_INAPP_STEPS: Step[] = [
  {text: "Dodirni ⋮ gore desno", icon: <MoreVertRoundedIcon />},
  {text: "Odaberi Otvori u Chromeu (ili u pregledniku)", icon: <OpenInBrowserRoundedIcon />},
  {text: "U Chromeu dobiješ gumb Instaliraj", icon: <InstallMobileRoundedIcon />},
];

const TITLE = `${BRAND.name} radi bolje kao aplikacija`;
const BODY = "Otvara se preko cijelog zaslona, bez trake preglednika, i pokreće se ravno s početnog zaslona.";

// What the sheet offers in each browser (the frames of the design). `main` is what comes after the text: the install
// button, Samsung's detour to Chrome, or the steps (with Chrome's link before them inside an app on Android); `extra`
// is the fallback under the steps. `arrow` points at where the steps start, in the browser's own bar.
type Variant = {
  title: string;
  body: string;
  main: "install" | "handoff" | "steps";
  steps?: Step[];
  lead?: "chrome"; // the Open in Chrome button above the steps
  extra?: "copySafari" | "chrome" | "copyChromeLink";
  arrow: "top" | "bottom" | null;
};

function variantFor({os, browser}: InstallEnv, canPrompt: boolean): Variant {
  const base = {title: TITLE, body: BODY, main: "steps"} as const;
  if (os === "ios") {
    switch (browser) {
      case "safari":
        return {...base, steps: IOS_STEPS, arrow: "bottom"}; // I1
      case "chrome":
        return {...base, steps: IOS_CHROME_STEPS, arrow: "top"}; // I2
      case "edge":
        return {...base, steps: IOS_EDGE_STEPS, arrow: "top"}; // I3
      case "firefox":
        return {...base, steps: IOS_FIREFOX_STEPS, arrow: "top"}; // I4
      case "inapp": // I5
        return {
          ...base,
          title: "Otvori u pravom pregledniku",
          body: `Ovaj preglednik unutar aplikacije ne može dodati ${BRAND.nameAccusative} na početni zaslon. Otvori je u Safariju.`,
          steps: IOS_INAPP_STEPS,
          extra: "copySafari",
          arrow: "top",
        };
      default: // I6
        return {
          ...base,
          title: `Dodaj ${BRAND.nameAccusative} na početni zaslon`,
          body: "U ovom pregledniku ne znamo točan put. Pokušaj ovako, a ako nema opcije, otvori stranicu u Safariju.",
          steps: IOS_UNKNOWN_STEPS,
          extra: "copySafari",
          arrow: null,
        };
    }
  }
  switch (browser) {
    // never Samsung's own install, neither its prompt() nor its menu: both build the package Play Protect blocks
    case "samsung":
      return {...base, main: "handoff", arrow: null}; // A3
    case "firefox":
      return {...base, steps: ANDROID_FIREFOX_STEPS, arrow: "bottom"}; // A4
    case "inapp": // A7
      return {
        ...base,
        title: "Otvori u pravom pregledniku",
        body: `Ovaj preglednik unutar aplikacije ne može instalirati ${BRAND.nameAccusative}. Otvori je u Chromeu.`,
        lead: "chrome",
        steps: ANDROID_INAPP_STEPS,
        extra: "copyChromeLink",
        arrow: "top",
      };
  }
  if (canPrompt) return {...base, main: "install", arrow: null}; // A1, and A5/A6 when they offer it
  if (browser === "chrome") return {...base, steps: ANDROID_STEPS, arrow: "top"}; // A2
  if (browser === "edge") return {...base, steps: ANDROID_EDGE_STEPS, arrow: "bottom"}; // A5
  return {...base, steps: ANDROID_OTHER_STEPS, extra: "chrome", arrow: "top"}; // A6
}

export default function InstallSheet() {
  const {env, standalone, canPrompt, installed, prompt} = useInstallPrompt();
  const reduce = useReducedMotion();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const offered = env != null && env.os !== "other" && !standalone;
  useEffect(() => {
    if (!offered) return;
    const t = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [offered]);

  if (!offered) return null;
  // after the browser's own install; not Samsung, where an accepted install can still end in Play Protect's block
  if (installed && env.os === "android" && env.browser !== "samsung" && env.browser !== "inapp") return <Installed />;

  const ios = env.os === "ios";
  const v = variantFor(env, canPrompt);
  const blue = ios ? osBlue.ios : osBlue.android;
  const install = async () => {
    setBusy(true);
    const accepted = await prompt();
    setBusy(false);
    if (accepted) setOpen(false);
  };
  const arrowSx = {position: "fixed", zIndex: 1301, pointerEvents: "none", color: blue, "& svg": {fontSize: 34}, animation: reduce ? "none" : `${bob} 1.2s ease-in-out infinite`} as const;
  // an arrow under the sheet gets its own gap between the sheet and the browser's bar, not a place on the sheet
  const below = v.arrow === "bottom";

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        transitionDuration={{enter: 260, exit: 200}}
        SlideProps={{easing: {enter: ease, exit: "cubic-bezier(.4,0,.6,1)"}}}
        slotProps={{backdrop: {sx: {background: tint.scrim[42]}}}}
        PaperProps={{
          role: "dialog",
          "aria-labelledby": titleId,
          sx: {
            maxWidth: 560,
            mx: "auto",
            mb: below ? "52px" : 0,
            // room for an arrow at the top too; a sheet taller than the screen (an iPhone SE) scrolls
            maxHeight: below ? "calc(100% - 52px - 16px)" : "calc(100% - 52px)",
            overflowY: "auto",
            borderRadius: below ? "28px" : "28px 28px 0 0",
            background: color.white,
            boxShadow: shadow.sheet,
            p: below ? "10px 22px 20px" : "10px 22px calc(24px + env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            "& > *": {flexShrink: 0},
          },
        }}
      >
        <Box aria-hidden sx={{alignSelf: "center", width: 40, height: 5, borderRadius: "3px", background: color.hairline}} />
        <Box sx={{display: "flex", alignItems: "center", gap: "14px", pt: "4px"}}>
          <AppIcon size={60} radius="16px" />
          <Box component="h2" id={titleId} sx={{m: 0, minWidth: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.05}}>
            {v.title}
          </Box>
        </Box>
        <Box
          component="span"
          sx={{alignSelf: "flex-start", height: 28, display: "flex", alignItems: "center", gap: "6px", px: "10px", borderRadius: "14px", background: color.paper, color: color.navy, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", "& svg": {fontSize: 16}}}
        >
          <TravelExploreRoundedIcon aria-hidden />
          {installEnvLabel(env, navigator.userAgent)}
        </Box>
        <Box sx={{mt: "-4px", fontSize: 15, lineHeight: 1.45, color: color.ink2, textWrap: "pretty"}}>{v.body}</Box>
        {v.main === "handoff" ? (
          <ChromeHandoff />
        ) : v.main === "install" ? (
          <Box
            component="button"
            type="button"
            onClick={install}
            disabled={busy}
            sx={{...primarySx, "&:disabled": {opacity: 0.7}}}
          >
            <InstallMobileRoundedIcon />
            Instaliraj aplikaciju
          </Box>
        ) : (
          <>
            {v.lead === "chrome" && <ChromeLink primary />}
            <Steps steps={v.steps ?? []} blue={blue} />
            {v.extra === "chrome" && <ChromeLink />}
            {v.extra === "copySafari" && <CopyLink target="Safari" />}
            {v.extra === "copyChromeLink" && <CopyLink target="Chrome" quiet />}
          </>
        )}
        <Box component="button" type="button" onClick={() => setOpen(false)} sx={{...buttonBase, height: 48, borderRadius: "14px", background: "transparent", color: color.ink2, fontSize: 16, fontWeight: 600}}>
          Nastavi u pregledniku
        </Box>
      </Drawer>
      {/* where the steps start: Safari's ••• and the Android menus at the bottom under the sheet, Share or ⋮ above it */}
      {open && v.arrow === "bottom" && (
        <Box aria-hidden sx={{...arrowSx, right: "29px", bottom: "calc(4px + env(safe-area-inset-bottom))"}}>
          <SouthRoundedIcon />
        </Box>
      )}
      {open && v.arrow === "top" && (
        <Box aria-hidden sx={{...arrowSx, right: "8px", top: "8px"}}>
          <NorthRoundedIcon />
        </Box>
      )}
    </>
  );
}

const primarySx = {
  ...buttonBase,
  height: 60,
  borderRadius: "18px",
  background: color.navy,
  color: color.white,
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  fontSize: 18,
  fontWeight: 600,
  boxShadow: shadow.action,
  "& svg": {fontSize: 24},
} as const;

// the same button with an outline, for a fallback under the steps
const outlinedSx = {...primarySx, height: 56, background: color.white, color: color.navy, border: `1.5px solid ${tint.navy[25]}`, boxShadow: "none"} as const;

function Steps({steps, blue}: {steps: Step[]; blue: string}) {
  return (
    <Box component="ol" aria-label="Kako instalirati" sx={{listStyle: "none", m: 0, p: "4px 14px", borderRadius: "18px", background: color.paper}}>
      {steps.map((s, i) => (
        <Box
          component="li"
          key={s.text}
          sx={{minHeight: 50, py: "6px", display: "flex", alignItems: "center", gap: "12px", borderBottom: i < steps.length - 1 ? `1px solid ${tint.navy[10]}` : "none"}}
        >
          <Box component="span" aria-hidden sx={{width: 26, height: 26, flex: "none", borderRadius: "50%", background: color.navy, color: color.white, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}>
            {i + 1}
          </Box>
          <Box component="span" sx={{flex: 1, fontSize: 15, fontWeight: 600, lineHeight: 1.3}}>
            {s.text}
          </Box>
          <Box component="span" aria-hidden sx={{width: 34, height: 34, flex: "none", borderRadius: "10px", background: color.white, color: blue, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
            {s.icon}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// the address handed to another browser: it has its own cookies, so it opens on the login page, which shows this sheet
// again with that browser's install
const loginUrl = () => `${window.location.origin}/login`;

// Opens the page in Chrome: a real link, as Android follows an intent only from a tap
function ChromeLink({primary}: {primary?: boolean}) {
  return (
    <Box component="a" href={chromeIntentUrl(loginUrl())} sx={primary ? primarySx : outlinedSx}>
      <OpenInBrowserRoundedIcon />
      Otvori u Chromeu
    </Box>
  );
}

// Copies the address to paste into Safari or Chrome, where nothing opens it directly; without the clipboard the
// address is shown to copy by hand. `quiet` is the underlined text under an Open in Chrome button.
function CopyLink({target, quiet}: {target: "Safari" | "Chrome"; quiet?: boolean}) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const url = loginUrl();
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <>
      {quiet ? (
        <Box component="button" type="button" onClick={copyLink} sx={{...buttonBase, minHeight: 40, background: "transparent", color: color.ink2, fontSize: 14, fontWeight: 600, textDecoration: "underline"}}>
          Ne otvara se? Kopiraj poveznicu
        </Box>
      ) : (
        <Box component="button" type="button" onClick={copyLink} sx={outlinedSx}>
          <ContentCopyRoundedIcon />
          Kopiraj poveznicu
        </Box>
      )}
      {/* the result is read out where the button stays focused */}
      <Box role="status" sx={{mt: "-8px", textAlign: "center", fontSize: 14, lineHeight: 1.4, color: color.ink2, "&:empty": {display: "none"}}}>
        {copy === "copied" && `Poveznica je kopirana, zalijepi je u ${target}.`}
        {copy === "failed" && (
          <>
            Upiši u {target}:{" "}
            <Box component="span" sx={{userSelect: "all", fontWeight: 700, color: color.ink, overflowWrap: "anywhere"}}>
              {url}
            </Box>
          </>
        )}
      </Box>
    </>
  );
}

// The app icon as the home screen shows it
function AppIcon({size, radius}: {size: number; radius: string}) {
  return (
    <Box
      component="img"
      src={BRAND.icon}
      alt=""
      aria-hidden
      sx={{width: size, height: size, flex: "none", display: "block", borderRadius: radius, background: color.cream}}
    />
  );
}

// Samsung Internet on a Galaxy installs the app as a package built on Samsung's server for an old Android, and Play
// Protect blocks it. Chrome's install isn't blocked, so Samsung users open the page there and sign in again.
function ChromeHandoff() {
  return (
    <>
      <Box sx={{p: "12px 14px", borderRadius: "18px", background: color.paper, fontSize: 15, lineHeight: 1.45, textWrap: "pretty"}}>
        Iz Samsung Interneta Android može blokirati instalaciju („Nesigurna aplikacija blokirana“). Instaliraj je iz
        Chromea i tamo se ponovno prijavi. Ako te pita čime otvoriti, odaberi Chrome.
      </Box>
      <ChromeLink primary />
      {/* whether Samsung opens Chrome, asks first or does nothing varies; the link can always be pasted into Chrome */}
      <CopyLink target="Chrome" quiet />
    </>
  );
}

// After Chrome installed the app: the browser tab has done its job, the app is on the home screen
function Installed() {
  return (
    <Box
      role="status"
      sx={{position: "fixed", inset: 0, zIndex: 1400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", px: "28px", textAlign: "center", background: color.navy, color: color.white}}
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
        sx={{width: "100%", maxWidth: 300, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "14px 10px", p: "18px 16px", borderRadius: "24px", background: tint.white[8], mt: "6px"}}
      >
        {Array.from({length: 8}, (_, i) =>
          i === 5 ? (
            <Box key={i} sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
              <Box sx={{borderRadius: "50%", boxShadow: `0 0 0 3px ${tint.creamOnNavy[45]}, 0 0 0 7px ${tint.creamOnNavy[16]}`}}>
                <AppIcon size={52} radius="50%" />
              </Box>
              <Box component="span" sx={{fontSize: 11, fontWeight: 700, whiteSpace: "nowrap"}}>
                {BRAND.name}
              </Box>
            </Box>
          ) : (
            <Box key={i} sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
              <Box sx={{width: 52, height: 52, borderRadius: "50%", background: tint.white[14]}} />
              <Box component="span" sx={{height: 14}} />
            </Box>
          )
        )}
      </Box>
    </Box>
  );
}
