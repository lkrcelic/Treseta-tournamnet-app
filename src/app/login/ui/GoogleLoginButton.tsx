"use client";

import {signIn} from "next-auth/react";
import {Button} from "@mui/material";
import {Google as GoogleIcon} from "@mui/icons-material";

interface GoogleLoginButtonProps {
  onLoginStart?: () => void;
  onLoginComplete?: (success: boolean) => void;
}

export default function GoogleLoginButton({
                                            onLoginStart,
                                            onLoginComplete,
                                          }: GoogleLoginButtonProps) {
  const handleGoogleLogin = async () => {
    if (onLoginStart) onLoginStart();

    try {
      // Using NextAuth client-side signIn with callbackUrl
      await signIn("google", {
        callbackUrl: "/"
      });

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
