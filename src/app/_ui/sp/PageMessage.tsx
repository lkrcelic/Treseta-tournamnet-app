"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {BRAND} from "@/app/_lib/brand";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import {Box} from "@mui/material";
import React from "react";
import {OutlineButton, PrimaryButton} from "./Buttons";
import {Screen} from "./Screen";
import {MessageState} from "./States";

// A whole page with nothing to show: an address the app doesn't have (app/not-found) or a page that broke
// (app/error, app/global-error). The brand on top, the message in the middle (with Pokušaj ponovno when the page can
// be tried again, as ErrorState) and Početni zaslon: at the bottom on the phone, as on the other phone screens, and
// under the message on the desktop (an outline button under Pokušaj ponovno). The tab's title says it too: React puts a rendered <title> first in <head>, ahead
// of the root layout's app name (a `metadata` title would come after it and lose), and takes it out again
// when the page goes. Imported by its path, not from the kit's index, since app/not-found is a server component.
export function PageMessage({
  icon,
  title,
  text,
  onRetry,
  onHome,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  onRetry?: () => void;
  onHome: () => void;
}) {
  const isDesktop = useIsDesktop();
  const message = (
    <MessageState
      role={onRetry ? "alert" : "status"}
      icon={icon}
      // the page's heading
      title={
        <Box component="h1" sx={{m: 0, font: "inherit"}}>
          {title}
        </Box>
      }
      text={text}
      action={onRetry && {label: "Pokušaj ponovno", icon: <RefreshRoundedIcon />, onClick: onRetry}}
      // on the desktop Početni zaslon follows Pokušaj ponovno closely
      sx={{p: isDesktop && onRetry ? "24px 8px 2px" : "24px 8px"}}
    />
  );
  const pageTitle = <title>{`${title} · ${BRAND.name}`}</title>;

  if (isDesktop) {
    // the brand where the desktop pages have their header; under Pokušaj ponovno the way home is the quieter button
    return (
      <Box component="main" sx={{minHeight: "100dvh", boxSizing: "border-box", p: "24px 36px 28px", display: "flex", flexDirection: "column"}}>
        {pageTitle}
        <Brand variant="home" />
        <Box sx={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", pb: "64px"}}>
          {message}
          {onRetry ? (
            <OutlineButton height={48} onClick={onHome} sx={{px: "22px", fontSize: 16, "& svg": {fontSize: 20}}}>
              <HomeRoundedIcon aria-hidden />
              Početni zaslon
            </OutlineButton>
          ) : (
            <PrimaryButton icon={<HomeRoundedIcon />} onClick={onHome} sx={{width: 320}}>
              Početni zaslon
            </PrimaryButton>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Screen>
      {pageTitle}
      <Box sx={{px: "4px", pb: "4px"}}>
        <Brand variant="home" />
      </Box>
      <Box sx={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "center"}}>{message}</Box>
      <PrimaryButton icon={<HomeRoundedIcon />} onClick={onHome}>
        Početni zaslon
      </PrimaryButton>
    </Screen>
  );
}

// An address that doesn't exist, also a page's own notFound() (/league/current/<page> for a page the app doesn't have)
export function NotFoundMessage() {
  const router = useTransitionRouter();
  return (
    <PageMessage
      icon={<SearchOffRoundedIcon />}
      title="Stranica ne postoji"
      text="Možda je poveznica pogrešna."
      onHome={() => router.push("/", "back")}
    />
  );
}

// What a page that broke says (app/error and app/global-error)
export const PAGE_ERROR = {title: "Nešto je pošlo po zlu", text: "Pokušaj ponovno ili se vrati na početni zaslon."} as const;
