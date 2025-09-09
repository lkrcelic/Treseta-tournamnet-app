"use client";

import LogInForm from "@/app/login/ui/LogInForm";
import GoogleLoginButton from "@/app/login/ui/GoogleLoginButton";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {Alert, Box, Button, Divider, Paper, Typography} from "@mui/material";

export default function LogIn() {
  const [success, setSuccess] = useState<boolean | undefined>(undefined);
  const router = useRouter();

  const handleFormSubmit = (success: boolean) => {
    setSuccess(success);
    if (success) {
      setTimeout(() => router.push("/"), 100);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 90px)',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
      py: 4
    }}>
      <Box sx={{
        width: "100%",
        backgroundColor: 'none',
        pb: 4,
        position: 'sticky',
        zIndex: 10
      }}>
        <Typography variant="h4" component="h1" sx={{
          fontWeight: 'bold',
          textAlign: 'center',
          color: 'primary.main',
          pb: 1,
        }}>
          Trešeta Liga
        </Typography>
        <Divider/>
      </Box>
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 3,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h5"
          component="h1"
          sx={{
            mb: 3,
            fontWeight: 'bold',
            textAlign: 'center',
            color: 'primary.main'
          }}
        >
          Prijava
        </Typography>

        <GoogleLoginButton
          onLoginComplete={(success) => {
            setSuccess(success);
            if (success) {
              router.push("/");
            }
          }}
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            my: 2
          }}
        >
          <Divider sx={{flexGrow: 1}}/>
          <Typography variant="body2" color="text.secondary" sx={{px: 2}}>
            ili
          </Typography>
          <Divider sx={{flexGrow: 1}}/>
        </Box>

        <LogInForm onFormSubmit={handleFormSubmit}/>

        {success === true && (
          <Alert severity="success" sx={{mt: 2}}>
            Prijava uspješna!
          </Alert>
        )}

        {success === false && (
          <Alert severity="error" sx={{mt: 2}}>
            Korisničko ime ili lozinka su netočni.
          </Alert>
        )}
      </Paper>

      <Button
        onClick={() => router.push('/signup')}
        variant="text"
        color="primary"
        sx={{
          textTransform: "none",
          fontSize: "16px",
          fontWeight: "medium",
          mt: 3
        }}
      >
        Nemaš profil? Registriraj se
      </Button>
    </Box>
  );
}
