"use client";

import {refreshUser} from "@/app/_bootstrap/refreshUser";
import {loginUser, LoginOutcome} from "@/app/_fetchers/authentication/login";
import {ACCOUNT_DEACTIVATED} from "@/app/_interfaces/login";
import {ErrorNote, PasswordField, PrimaryButton, TextField} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import React, {useState} from "react";

type Errors = {username?: string; password?: string; form?: string};

const OUTCOME_ERROR: Record<Exclude<LoginOutcome, "ok">, string> = {
  wrong: "Korisničko ime ili lozinka su netočni.",
  locked: "Previše neuspjelih pokušaja. Pokušaj ponovno za nekoliko minuta.",
  inactive: ACCOUNT_DEACTIVATED,
  error: "Prijava trenutno nije moguća. Pokušaj ponovno.",
};

// onSubmit: the player tries again (Prijava then hides an older error, e.g. a failed Google login)
export default function LogInForm({onSuccess, onSubmit, soft = false}: {onSuccess: () => void; onSubmit?: () => void; soft?: boolean}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    onSubmit?.();
    const next: Errors = {};
    if (!username.trim()) next.username = "Upiši korisničko ime ili email.";
    if (!password) next.password = "Upiši lozinku.";
    setErrors(next);
    if (next.username || next.password) return;

    setSubmitting(true);
    try {
      const outcome = await loginUser({username: username.trim(), password});
      if (outcome === "ok") {
        // the app keeps the logged-in player in a store; fill it before leaving the page
        await refreshUser();
        onSuccess();
        return;
      }
      setErrors({form: OUTCOME_ERROR[outcome]});
    } catch {
      setErrors({form: OUTCOME_ERROR.error});
    }
    setSubmitting(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{display: "flex", flexDirection: "column", gap: "16px"}}>
      <TextField
        label="Korisničko ime ili Email"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="npr. marko"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={errors.username}
        soft={soft}
      />
      <PasswordField
        label="Lozinka"
        name="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        soft={soft}
      />
      {errors.form && <ErrorNote>{errors.form}</ErrorNote>}
      <PrimaryButton type="submit" loading={submitting} sx={{mt: "4px"}}>
        Prijavi se
      </PrimaryButton>
    </Box>
  );
}
