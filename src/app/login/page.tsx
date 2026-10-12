"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {AuthFrame, OrDivider} from "@/app/_ui/auth/AuthFrame";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {Card, Display, ErrorNote, TextButton} from "@/app/_ui/sp";
import {color} from "@/app/_styles/tokens";
import GoogleLoginButton from "@/app/login/ui/GoogleLoginButton";
import LogInForm from "@/app/login/ui/LogInForm";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {safeNextPath} from "@/app/_lib/publicPaths";
import {useSearchParams} from "next/navigation";
import {loginErrorMessage} from "@/app/_interfaces/login";
import {useEffect, useState} from "react";

export default function LogIn() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  // ?next=: the page that sent the player here (a Burza form), opened again after logging in
  const params = useSearchParams();
  const next = safeNextPath(params.get("next")) ?? "/";
  const onSuccess = () => router.replace(next);
  // ?error=: a refused or failed Google login, or a login that ended because the account was deactivated
  // (loginErrorMessage). Read once and taken out of the address, so a reload doesn't show it again; it goes away
  // when the player tries again, so only the latest error is on screen.
  const [error, setError] = useState(() => loginErrorMessage(params.get("error")));
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) return;
    url.searchParams.delete("error");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  const clearError = () => setError(null);
  const errorNote = error && <ErrorNote>{error}</ErrorNote>;

  const signupLink = (
    <TextButton onClick={() => router.push("/signup")} sx={{alignSelf: "center", fontWeight: 500, color: color.ink2}}>
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
          <GoogleLoginButton pill callbackUrl={next} onStart={clearError} />
          {errorNote}
          <OrDivider />
          <LogInForm onSuccess={onSuccess} onSubmit={clearError} />
          {signupLink}
        </Box>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <Card sx={{p: "22px 18px", display: "flex", flexDirection: "column", gap: "16px", borderRadius: "24px"}}>
        <Display size={28}>Prijava</Display>
        <GoogleLoginButton callbackUrl={next} onStart={clearError} />
        {errorNote}
        <OrDivider />
        <LogInForm onSuccess={onSuccess} onSubmit={clearError} soft />
      </Card>
      <Box sx={{mt: "auto", display: "flex", justifyContent: "center"}}>{signupLink}</Box>
      <InstallSheet />
    </AuthFrame>
  );
}
