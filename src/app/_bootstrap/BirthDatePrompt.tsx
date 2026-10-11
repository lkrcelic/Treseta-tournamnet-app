"use client";

import {updateBirthDateAPI} from "@/app/_fetchers/player/updateBirthDate";
import {leagueDateString} from "@/app/_lib/dates";
import useAuthStore from "@/app/_store/authStore";
import {BottomSheet, ErrorNote, Muted, PrimaryButton, TextButton, TextField} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import {usePathname} from "next/navigation";
import React, {useState} from "react";

// Google doesn't give us a birth date, so a player who signed up with Google is asked for it once.
// "Kasnije" hides it until the app is opened again. It never interrupts a match or the login pages.
export default function BirthDatePrompt() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const pathname = usePathname();
  const [later, setLater] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quietPage = ["/login", "/signup", "/ongoing-match", "/round/"].some((p) => pathname.startsWith(p));
  if (!user?.needs_birth_date || later || quietPage) return null;

  const today = leagueDateString();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > today) {
      setError("Upiši ispravan datum rođenja.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBirthDateAPI(user.id, value);
      setUser({...user, needs_birth_date: false});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datum rođenja nije spremljen.");
      setSaving(false);
    }
  };

  return (
    <BottomSheet open onClose={() => setLater(true)} title="Datum rođenja">
      <Box component="form" onSubmit={save} noValidate sx={{display: "flex", flexDirection: "column", gap: "14px", px: "8px"}}>
        <Muted>Google nam ga ne šalje. Upiši ga jednom i više te nećemo pitati.</Muted>
        <TextField
          label="Datum rođenja"
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={today}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton type="submit" loading={saving} disabled={!value}>
          Spremi
        </PrimaryButton>
        <TextButton onClick={() => setLater(true)}>Kasnije</TextButton>
      </Box>
    </BottomSheet>
  );
}
