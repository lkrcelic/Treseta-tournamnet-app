"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {AuthFrame, OrDivider} from "@/app/_ui/auth/AuthFrame";
import {color} from "@/app/_styles/tokens";
import {buttonBase, IconCircleButton, ScreenTitle, SuccessNote, TextButton} from "@/app/_ui/sp";
import GoogleLoginButton from "@/app/login/ui/GoogleLoginButton";
import SignUpForm from "@/app/signup/ui/SignUpForm";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useEffect, useState} from "react";

// Registracija: Google first, then the form. Google makes the player at once (googleAuth.ts) and the app then asks
// the birth date and "Pušiš li?" (BirthDatePrompt, SmokerPrompt). On the phone the form waits behind Registriraj se
// emailom, so the screen opens with the two ways instead of a form two screens long.
export default function SignUp() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const [created, setCreated] = useState(false);
  const [withEmail, setWithEmail] = useState(false);
  const login = "/login";

  useEffect(() => {
    if (!created) return;
    const t = setTimeout(() => router.push(login, "back"), 1800);
    return () => clearTimeout(t);
  }, [created, router, login]);

  const done = created && <SuccessNote>Profil je napravljen! Preusmjeravamo te na prijavu…</SuccessNote>;

  const google = (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <GoogleLoginButton pill={isDesktop} label="Registriraj se s Googleom" />
      <Box component="p" sx={{m: 0, px: "8px", fontSize: 13, lineHeight: 1.4, color: color.muted, textAlign: "center", textWrap: "pretty"}}>
        Bez nove lozinke. Ime i email uzimamo s tvog Google računa.
      </Box>
    </Box>
  );

  const loginLink = (
    <TextButton onClick={() => router.push(login, "back")} sx={{alignSelf: "center", fontWeight: 500, color: color.ink2}}>
      Već imaš profil?{" "}
      <Box component="span" sx={{fontWeight: 700, color: color.navy}}>
        Prijavi se
      </Box>
    </TextButton>
  );

  if (isDesktop) {
    return (
      <AuthFrame>
        <Box sx={{width: 520, display: "flex", flexDirection: "column", gap: "16px"}}>
          <ScreenTitle eyebrow="Novi igrač" title="Registracija" size={44} sx={{px: 0}} />
          {done || (
            <>
              {google}
              <OrDivider />
              <SignUpForm onSuccess={() => setCreated(true)} twoColumn />
            </>
          )}
          {loginLink}
        </Box>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame phoneBrand={false}>
      <Box sx={{display: "flex", alignItems: "center"}}>
        <IconCircleButton label="Nazad na prijavu" onClick={() => router.push(login, "back")}>
          <ArrowBackRoundedIcon />
        </IconCircleButton>
      </Box>
      <ScreenTitle eyebrow="Novi igrač" title="Registracija" sx={{py: "4px"}} />
      {done || (
        <>
          {google}
          <OrDivider />
          {withEmail ? (
            <SignUpForm onSuccess={() => setCreated(true)} autoFocus />
          ) : (
            // the Google button's look, so the two ways read as a pair
            <Box
              component="button"
              type="button"
              onClick={() => setWithEmail(true)}
              sx={{
                ...buttonBase,
                width: "100%",
                height: 56,
                borderRadius: "16px",
                border: `1.5px solid ${color.borderControl}`,
                background: color.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                fontSize: 17,
                fontWeight: 600,
                color: color.ink,
                "& svg": {fontSize: 22, color: color.navy},
                "&:active": {transform: "scale(.98)"},
              }}
            >
              <MailOutlineRoundedIcon aria-hidden />
              Registriraj se emailom
            </Box>
          )}
        </>
      )}
      <Box sx={{mt: "auto", display: "flex", justifyContent: "center"}}>{loginLink}</Box>
    </AuthFrame>
  );
}
