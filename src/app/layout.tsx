"use client";

import BirthDatePrompt from "@/app/_bootstrap/BirthDatePrompt";
import SmokerPrompt from "@/app/_bootstrap/SmokerPrompt";
import UserBootstrapper from "@/app/_bootstrap/UserBootstrapper";
// catches Chrome's install offer as early as possible, for the install sheet
import "@/app/_lib/installPrompt";
import {RouteTransitions} from "@/app/_lib/viewTransitions";
import theme from "@/app/_styles/theme";
import {BRAND} from "@/app/_lib/brand";
import {color} from "@/app/_styles/tokens";
import {CssBaseline, ThemeProvider} from "@mui/material";
import React, {useEffect, useState} from "react";

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  // Pages pick the phone or desktop layout from the window width, which the server cannot know.
  // Rendering after mount avoids hydration mismatches and a flash of the wrong layout.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <html lang="hr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content={color.paper} />
        {/* installable from the browser ("Add to Home Screen" / "Install app"); no service worker, nothing offline */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content={BRAND.name} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app router root layout, loaded once for every page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        />
        <title>{BRAND.name}</title>
      </head>
      <body style={{margin: 0, padding: 0, backgroundColor: color.paper, overflowX: "hidden"}}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <UserBootstrapper />
          <RouteTransitions />
          {mounted ? children : null}
          {mounted && <BirthDatePrompt />}
          {/* "Pušiš li?" for players who haven't answered it, after the birth date */}
          {mounted && <SmokerPrompt />}
        </ThemeProvider>
      </body>
    </html>
  );
}
