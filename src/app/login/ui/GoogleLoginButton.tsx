"use client";

import { Google as GoogleIcon } from "@mui/icons-material";
import { Button } from "@mui/material";
import { signIn } from "next-auth/react";

interface GoogleLoginButtonProps {
  onLoginStart?: () => void;Ł
  onLoginComplete?: (success: boolean) => void;
}

export default function GoogleLoginButton({
                                            onLoginStart,
                                            onLoginComplete,
                                          }: GoogleLoginButtonProps) {
  const handleGoogleLogin = () => {
    if (onLoginStart) onLoginStart();

    try {
      signIn("google", {callbackUrl: "/"});

      // Note: The code below won't execute immediately as we're redirecting
      if (onLoginComplete) {
        onLoginComplete(true);
      }
    } catch (error) {
      console.error("Google login error:", error);
      if (onLoginComplete) {
        onLoginComplete(false);
      }
    }
  };

  return (
    <Button
      fullWidth
      variant="outlined"
      color="primary"
      size="large"
      onClick={handleGoogleLogin}
      startIcon={<GoogleIcon/>}
      sx={{
        py: 1.5,
        borderRadius: 1.5,
        textTransform: "none",
        fontSize: "1rem",
        fontWeight: "medium",
        mb: 2,
        borderWidth: "1px",
        "&:hover": {
          borderWidth: "1px"
        }
      }}
    >
      Prijavi se s Google računom
    </Button>
  );
}
