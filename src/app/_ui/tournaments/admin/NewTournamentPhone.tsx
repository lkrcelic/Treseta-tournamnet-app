"use client";

import {useAdminTournaments} from "@/app/_hooks/useTournaments";
import useNavStack from "@/app/_hooks/useNavStack";
import {nightLabel} from "@/app/_lib/nights";
import {color, font} from "@/app/_styles/tokens";
import {adminCardSx} from "@/app/_ui/admin/AdminParts";
import {ErrorNote, Field, IconCircleButton, PrimaryButton, Screen, ScrollArea} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import {Box} from "@mui/material";
import React from "react";
import {EMPTY_TOURNAMENT, TournamentFields, useOwnPhone, useTournamentForm} from "../TournamentForm";
import {useCopySource, useCreateTournament} from "./NewTournamentDesktop";

// Novi turnir on the admin's phone (Claude Design "Turniri admin" M10, M10b): Kopiraj iz turnira first, the whole form
// in one column, Kreiraj turnir at the end. It is published at once, with sign-ups open.
export default function NewTournamentPhone() {
  const nav = useNavStack("Novi turnir", "/turniri/upravljanje");
  const form = useTournamentForm(EMPTY_TOURNAMENT);
  useOwnPhone(form);
  const copy = useCopySource(form);
  const {create, saving, error} = useCreateTournament(form);
  const {tournaments} = useAdminTournaments();
  const sources = [...(tournaments ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Screen fill gap={14}>
      <Box sx={{flex: "none", mx: "-6px"}}>
        <IconCircleButton label="Natrag" size={44} onClick={nav.back} sx={{"& svg": {fontSize: 26}}}>
          <ChevronLeftRoundedIcon />
        </IconCircleButton>
      </Box>
      <Box component="header" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "4px", px: "4px"}}>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
          Admin · Turniri
        </Box>
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1.05}}>
          Novi turnir
        </Box>
      </Box>
      <ScrollArea bleed sx={{gap: "12px"}}>
        <Box sx={adminCardSx}>
          <Field label="Kopiraj iz turnira">
            {(a11y) => (
              <Box
                component="select"
                {...a11y}
                value={copy.source ?? ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => copy.pick(e.target.value ? Number(e.target.value) : null)}
                sx={{height: 52, borderRadius: "16px", border: `1.5px solid ${color.border}`, background: color.paper2, px: "14px", fontFamily: "inherit", fontSize: 16, color: color.ink}}
              >
                <option value="">Bez kopiranja</option>
                {sources.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {nightLabel(t.date)}
                  </option>
                ))}
              </Box>
            )}
          </Field>
          <Box sx={{fontSize: 13, lineHeight: 1.45, color: color.muted}}>Datum, prijave i nagrade se ne kopiraju.</Box>
          {copy.error && <ErrorNote>{copy.error}</ErrorNote>}
        </Box>
        <Box sx={adminCardSx}>
          <TournamentFields form={{...form, touched: form.touched || error != null}} compact />
        </Box>
        <Box sx={{flex: "none", px: "4px", fontSize: 14, lineHeight: 1.45, color: color.ink2}}>Turnir se objavi odmah i prijave su otvorene. Sve se može mijenjati do početka turnira.</Box>
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton icon={<AddRoundedIcon />} loading={saving} onClick={create} sx={{flex: "none"}}>
          Kreiraj turnir
        </PrimaryButton>
      </ScrollArea>
    </Screen>
  );
}
