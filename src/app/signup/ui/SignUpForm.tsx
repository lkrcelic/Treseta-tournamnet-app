"use client";

import {signUp} from "@/app/_fetchers/authentication/signup";
import {SignupErrors, SignupValues, validateSignup, validateSignupField} from "@/app/_lib/ui/signupValidation";
import {ErrorNote, PasswordField, PrimaryButton, TextField} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import React, {useState} from "react";

const EMPTY: SignupValues = {username: "", password: "", confirm: "", email: "", first_name: "", last_name: "", birth_date: ""};

// Server messages come back keyed by field (e.g. a taken username or email)
const SERVER_FIELDS: (keyof SignupValues)[] = ["username", "password", "email", "first_name", "last_name", "birth_date"];

export default function SignUpForm({onSuccess, twoColumn = false}: {onSuccess: () => void; twoColumn?: boolean}) {
  const [values, setValues] = useState<SignupValues>(EMPTY);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SignupValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (field: keyof SignupValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = {...values, [field]: e.target.value};
    setValues(next);
    // re-check fields the player already left, and the confirmation whenever the password changes
    setErrors((prev) => {
      const out = {...prev};
      if (touched[field]) out[field] = validateSignupField(field, next);
      if (field === "password" && touched.confirm) out.confirm = validateSignupField("confirm", next);
      return out;
    });
  };

  const blur = (field: keyof SignupValues) => () => {
    setTouched((t) => ({...t, [field]: true}));
    setErrors((prev) => ({...prev, [field]: validateSignupField(field, values)}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const all = validateSignup(values);
    setErrors(all);
    setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])));
    if (Object.keys(all).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await signUp({
        username: values.username.trim(),
        password: values.password,
        email: values.email.trim(),
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        birth_date: values.birth_date,
      });
      if (res.success) {
        onSuccess();
        return;
      }
      const serverErrors: SignupErrors = {};
      SERVER_FIELDS.forEach((k) => {
        if (res.errors?.[k]) serverErrors[k] = res.errors[k];
      });
      setErrors(serverErrors);
      const message = res.errors?.error;
      if (!Object.keys(serverErrors).length) setFormError(typeof message === "string" ? message : "Registracija nije uspjela.");
    } catch {
      setFormError("Registracija trenutno nije moguća. Pokušaj ponovo.");
    }
    setSubmitting(false);
  };

  const field = (name: keyof SignupValues) => ({
    name,
    value: values[name],
    onChange: set(name),
    onBlur: blur(name),
    error: errors[name],
  });

  const pair = {display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px"};

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{display: "flex", flexDirection: "column", gap: "14px"}}>
      <TextField label="Korisničko ime" placeholder="mmarkovic" autoComplete="username" autoCapitalize="none" spellCheck={false} {...field("username")} />
      <Box sx={twoColumn ? pair : {display: "flex", flexDirection: "column", gap: "14px"}}>
        <PasswordField label="Lozinka" placeholder="••••••••" autoComplete="new-password" {...field("password")} />
        <PasswordField label="Potvrdi lozinku" placeholder="••••••••" autoComplete="new-password" {...field("confirm")} />
      </Box>
      <TextField label="Email" type="email" placeholder="marko@email.com" autoComplete="email" autoCapitalize="none" {...field("email")} />
      <Box sx={pair}>
        <TextField label="Ime" placeholder="Marko" autoComplete="given-name" {...field("first_name")} />
        <TextField label="Prezime" placeholder="Marković" autoComplete="family-name" {...field("last_name")} />
      </Box>
      <TextField label="Datum rođenja" type="date" autoComplete="bday" {...field("birth_date")} />
      {formError && <ErrorNote>{formError}</ErrorNote>}
      <PrimaryButton type="submit" loading={submitting} sx={{mt: "4px"}}>
        Registriraj se
      </PrimaryButton>
    </Box>
  );
}
