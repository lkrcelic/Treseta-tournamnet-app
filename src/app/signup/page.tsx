"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {AuthFrame} from "@/app/_ui/auth/AuthFrame";
import {color} from "@/app/_styles/tokens";
import {IconCircleButton, ScreenTitle, SuccessNote, TextButton} from "@/app/_ui/sp";
import SignUpForm from "@/app/signup/ui/SignUpForm";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useEffect, useState} from "react";

export default function SignUp() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (!created) return;
    const t = setTimeout(() => router.push("/login", "back"), 1800);
    return () => clearTimeout(t);
  }, [created, router]);

  const done = created && <SuccessNote>Profil je napravljen! Preusmjeravamo te na prijavu…</SuccessNote>;

  if (isDesktop) {
    return (
      <AuthFrame>
        <Box sx={{width: 520, display: "flex", flexDirection: "column", gap: "16px"}}>
          <ScreenTitle eyebrow="Novi igrač" title="Registracija" size={44} sx={{px: 0}} />
          {done || <SignUpForm onSuccess={() => setCreated(true)} twoColumn />}
          <TextButton onClick={() => router.push("/login", "back")} sx={{alignSelf: "center", fontWeight: 500, color: color.inkSoft}}>
            Već imaš profil?{" "}
            <Box component="span" sx={{fontWeight: 700, color: color.navy}}>
              Prijavi se
            </Box>
          </TextButton>
        </Box>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame phoneBrand={false}>
      <Box sx={{display: "flex", alignItems: "center"}}>
        <IconCircleButton label="Nazad na prijavu" onClick={() => router.push("/login", "back")}>
          <ArrowBackRoundedIcon />
        </IconCircleButton>
      </Box>
      <ScreenTitle eyebrow="Novi igrač" title="Registracija" sx={{py: "4px"}} />
      {done || <SignUpForm onSuccess={() => setCreated(true)} />}
    </AuthFrame>
  );
}
