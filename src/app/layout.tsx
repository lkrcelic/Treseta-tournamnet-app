"use client";

import theme from "@/app/_styles/theme";
import {Box, CssBaseline, ThemeProvider} from "@mui/material";
import React from "react";

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content={theme.palette.primary.main} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: theme.palette.background.default,
          overflowX: "hidden",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
              maxWidth: "1100px",
              margin: "0 auto",
              paddingY: 2,
              paddingX: 2,
              position: "relative",
              width: "100%",
              overflowY: "hidden",
            }}
          >
            <Box
              component="main"
              sx={{
                display: "grid",
                gridTemplateRows: "auto 1fr auto",
                gridTemplateAreas: `
                        "top"
                        "body"
                        "actions"
                      `,
                flex: 1,
                paddingTop: 1,
                gap: {xs: 2, sm: 4},
                width: "100%",
                maxHeight: "calc(100vh - 110px)",
              }}
            >
              {children}
            </Box>
          </Box>
        </ThemeProvider>
      </body>
    </html>
  );
}
