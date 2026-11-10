"use client";

import {createTournamentAPI, getAdminTournamentAPI} from "@/app/_fetchers/tournament";
import {useAdminTournaments} from "@/app/_hooks/useTournaments";
import {nightLabel} from "@/app/_lib/nights";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font} from "@/app/_styles/tokens";
import {Card, DesktopShell, ErrorNote, Field, InfoNote, NARROW_DESKTOP, PrimaryButton} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useEffect, useState} from "react";
import {copyOf, draftPayload, EMPTY_TOURNAMENT, TournamentFields, TournamentFormState, useOwnPhone, useTournamentForm} from "../TournamentForm";

// Novi turnir (Claude Design "Turniri admin" A2): the whole form on the left; on the right Kopiraj turnir (everything
// from an earlier tournament but its date, sign-ups and prizes) and Kreiraj turnir. It is published at once, with
// sign-ups open. ?kopiraj=<id> (Kopiraj on the list) opens it filled in from that tournament.

// The tournament to copy, picked from the list or from ?kopiraj=
export function useCopySource(form: TournamentFormState) {
  const params = useSearchParams();
  const [source, setSource] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async (id: number | null) => {
    setSource(id);
    setError(null);
    if (id == null) return;
    try {
      form.setDraft(copyOf(await getAdminTournamentAPI(id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turnir se nije učitao.");
    }
  };
  useEffect(() => {
    const id = Number(params.get("kopiraj"));
    if (Number.isInteger(id) && id > 0) pick(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {source, pick, error};
}

// Kreiraj turnir: the checks, the request, then the new tournament's Prijave
export function useCreateTournament(form: TournamentFormState) {
  const router = useTransitionRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const create = async () => {
    setTried(true);
    if (!form.valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const {id} = await createTournamentAPI(draftPayload(form.draft));
      router.replace(`/turniri/${id}/upravljanje?view=prijave`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turnir nije kreiran.");
      setSaving(false);
    }
  };
  // the first error to show once Kreiraj was pressed
  const firstError = tried ? Object.values(form.errors)[0] ?? null : null;
  return {create, saving, error: error ?? firstError};
}

export default function NewTournamentDesktop() {
  const form = useTournamentForm(EMPTY_TOURNAMENT);
  useOwnPhone(form);
  const copy = useCopySource(form);
  const {create, saving, error} = useCreateTournament(form);
  const {tournaments} = useAdminTournaments();
  const sources = [...(tournaments ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <DesktopShell active="manageTournaments" eyebrow="Admin · Turniri" title="Novi turnir" back={{label: "Turniri", href: "/turniri/upravljanje"}}>
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 330px"}, gap: "20px"}}>
        <Card component="section" aria-label="Novi turnir" sx={{minHeight: 0, overflowY: "auto", borderRadius: "24px", p: "24px 28px"}}>
          <TournamentFields form={{...form, touched: form.touched || error != null}} />
        </Card>
        <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
          <Card component="section" aria-labelledby="copy-title" sx={{flex: "none", borderRadius: "24px", p: "20px", display: "flex", flexDirection: "column", gap: "10px"}}>
            <Box component="h2" id="copy-title" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
              Kopiraj turnir
            </Box>
            <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.ink2}}>
              Preuzmi podatke iz starog turnira. Datum, prijave i nagrade se ne kopiraju.
            </Box>
            <Field label="Turnir">
              {(a11y) => (
                <Box
                  component="select"
                  {...a11y}
                  value={copy.source ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => copy.pick(e.target.value ? Number(e.target.value) : null)}
                  sx={{height: 52, borderRadius: "16px", border: `1.5px solid ${color.border}`, background: color.paper2, px: "14px", fontFamily: "inherit", fontSize: 16, color: color.ink}}
                >
                  <option value="">Odaberi turnir</option>
                  {sources.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {nightLabel(t.date)}
                    </option>
                  ))}
                </Box>
              )}
            </Field>
            {copy.error && <ErrorNote>{copy.error}</ErrorNote>}
          </Card>
          <InfoNote icon={<InfoRoundedIcon />}>Turnir se objavi odmah i prijave su otvorene. Sve se može mijenjati do početka turnira.</InfoNote>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Box sx={{flex: 1}} />
          <PrimaryButton icon={<AddRoundedIcon />} loading={saving} onClick={create} sx={{flex: "none"}}>
            Kreiraj turnir
          </PrimaryButton>
        </Box>
      </Box>
    </DesktopShell>
  );
}
