"use client";

import {BRAND} from "@/app/_lib/brand";
import theme from "@/app/_styles/theme";
import {color} from "@/app/_styles/tokens";
import {PAGE_ERROR, PageMessage} from "@/app/_ui/sp/PageMessage";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import {CssBaseline, ThemeProvider} from "@mui/material";
import {useEffect, useState} from "react";

// The root layout itself broke: this page replaces it, so it brings its own <html>, theme and fonts. Početni zaslon
// loads the app afresh.
export default function GlobalError({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  // the phone or desktop layout follows the window width, as in the root layout
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <html lang="hr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content={color.paper} />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- replaces the root layout, which loads the same fonts */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        />
        <title>{BRAND.name}</title>
      </head>
      <body style={{margin: 0, padding: 0, backgroundColor: color.paper, overflowX: "hidden"}}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {mounted && (
            <PageMessage
              icon={<ErrorOutlineRoundedIcon />}
              title={PAGE_ERROR.title}
              text={PAGE_ERROR.text}
              onRetry={reset}
              onHome={() => window.location.assign("/")}
            />
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
