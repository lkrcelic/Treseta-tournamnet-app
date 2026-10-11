"use client";

import {buttonBase} from "@/app/_ui/sp";
import {color} from "@/app/_styles/tokens";
import {Box} from "@mui/material";
import {signIn} from "next-auth/react";
import {useState} from "react";

// Google's four-color "G" (brand guidelines ask for the original mark)
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function GoogleLoginButton({pill = false}: {pill?: boolean}) {
  const [redirecting, setRedirecting] = useState(false);

  const handleGoogleLogin = () => {
    setRedirecting(true);
    // NextAuth redirects to Google and back to the home page
    signIn("google", {callbackUrl: "/"}).catch(() => setRedirecting(false));
  };

  return (
    <Box
      component="button"
      type="button"
      onClick={handleGoogleLogin}
      disabled={redirecting}
      sx={{
        ...buttonBase,
        width: "100%",
        height: pill ? 48 : 56,
        borderRadius: pill ? "24px" : "16px",
        border: pill ? "1px solid #747775" : `1.5px solid rgba(60,74,103,.2)`,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        fontSize: pill ? 15 : 17,
        fontWeight: pill ? 500 : 600,
        color: pill ? "#1F1F1F" : color.ink,
        transition: "background 150ms ease, box-shadow 150ms ease",
        "&:hover": {background: "#F8F9FA", boxShadow: "0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)"},
        "&:disabled": {opacity: 0.6},
      }}
    >
      <GoogleMark />
      Prijava s Googleom
    </Box>
  );
}
