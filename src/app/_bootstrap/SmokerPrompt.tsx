"use client";

import {updateSmokerAPI} from "@/app/_fetchers/player/updateSmoker";
import useAuthStore from "@/app/_store/authStore";
import {color} from "@/app/_styles/tokens";
import {SMOKER_HINT} from "@/app/_ui/smoking/SmokingParts";
import {BottomSheet, ErrorNote, Muted, OutlineButton, Spinner, TextButton} from "@/app/_ui/sp";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import {Box} from "@mui/material";
import {usePathname} from "next/navigation";
import {useState} from "react";

// A player who hasn't answered "Pušiš li?" (a Google sign-up, or a player from before the question) is asked once,
// after the birth date. "Kasnije" hides it until the app is opened again. It never interrupts a match or the login
// pages.
export default function SmokerPrompt() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const pathname = usePathname();
  const [later, setLater] = useState(false);
  const [saving, setSaving] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quietPage = ["/login", "/signup", "/ongoing-match", "/round/"].some((p) => pathname.startsWith(p));
  if (!user?.needs_smoker || user.needs_birth_date || later || quietPage) return null;

  const answer = async (smoker: boolean) => {
    if (saving != null) return;
    setSaving(smoker);
    setError(null);
    try {
      await updateSmokerAPI(user.id, smoker);
      setUser({...user, needs_smoker: false});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odgovor nije spremljen.");
      setSaving(null);
    }
  };

  const choice = {flex: 1, height: 56, borderRadius: "16px", border: `1.5px solid ${color.border}`, background: color.card, color: color.ink, fontSize: 17};
  return (
    <BottomSheet open onClose={() => setLater(true)} title="Pušiš li?">
      <Box sx={{display: "flex", flexDirection: "column", gap: "14px", px: "8px"}}>
        <Muted>{SMOKER_HINT}</Muted>
        <Box sx={{display: "flex", gap: "10px"}}>
          <OutlineButton onClick={() => answer(false)} disabled={saving != null} aria-busy={saving === false || undefined} sx={choice}>
            {saving === false && <Spinner size={18} />}
            Ne
          </OutlineButton>
          <OutlineButton
            onClick={() => answer(true)}
            disabled={saving != null}
            aria-busy={saving === true || undefined}
            sx={{...choice, "& svg": {fontSize: 22, color: color.navy}}}
          >
            {saving === true ? <Spinner size={18} /> : <SmokingRoomsRoundedIcon aria-hidden />}
            Da
          </OutlineButton>
        </Box>
        {error && <ErrorNote>{error}</ErrorNote>}
        <TextButton onClick={() => setLater(true)}>Kasnije</TextButton>
      </Box>
    </BottomSheet>
  );
}
