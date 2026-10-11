"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {AuthFrame, OrDivider} from "@/app/_ui/auth/AuthFrame";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {Card, Display, TextButton} from "@/app/_ui/sp";
import {color} from "@/app/_styles/tokens";
import GoogleLoginButton from "@/app/login/ui/GoogleLoginButton";
import LogInForm from "@/app/login/ui/LogInForm";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";

export default function LogIn() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const onSuccess = () => router.replace("/");

  const signupLink = (
    <TextButton onClick={() => router.push("/signup")} sx={{alignSelf: "center", fontWeight: 500, color: color.inkSoft}}>
      Nemaš profil?{" "}
      <Box component="span" sx={{fontWeight: 700, color: color.navy}}>
        Registriraj se
      </Box>
    </TextButton>
  );

  if (isDesktop) {
    return (
      <AuthFrame>
        <Box sx={{width: 420, display: "flex", flexDirection: "column", gap: "18px"}}>
          <Display size={44}>Prijava</Display>
          <GoogleLoginButton pill />
          <OrDivider />
          <LogInForm onSuccess={onSuccess} />
          {signupLink}
        </Box>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <Card sx={{p: "22px 18px", display: "flex", flexDirection: "column", gap: "16px", borderRadius: "24px"}}>
        <Display size={28}>Prijava</Display>
        <GoogleLoginButton />
        <OrDivider />
        <LogInForm onSuccess={onSuccess} soft />
      </Card>
      <Box sx={{mt: "auto", display: "flex", justifyContent: "center"}}>{signupLink}</Box>
      <InstallSheet />
    </AuthFrame>
  );
}
