"use client";

import {createLocationAPI, deleteLocationAPI, LocationFields, updateLocationAPI} from "@/app/_fetchers/locations";
import {dropLocation, putLocation} from "@/app/_hooks/useLocations";
import {inUse, LOCATION_URL_ERROR, locationUseLabel, LocationView} from "@/app/_interfaces/location";
import {isSafeUrl} from "@/app/_lib/nights";
import {NounForms} from "@/app/_lib/ui/text";
import {color} from "@/app/_styles/tokens";
import {mapLinkProps} from "@/app/_ui/gathering/Gathering";
import {EMPTY_PLACE, PlaceDraft, placeFields} from "@/app/_ui/locations/LocationFields";
import {mergeSx, visuallyHidden} from "@/app/_ui/sp";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {Box, SxProps, Theme} from "@mui/material";
import {useState} from "react";

// Lokacije (Admin · Lokacije, Claude Design 03 A "kao Sponzori"): what the computer's card and the phone's sheet share

export const LOKACIJA: NounForms = ["lokacija", "lokacije", "lokacija"];

export const LOCATIONS_INTRO = "Mjesta na kojima se igraju večeri lige i turniri. Promjena vrijedi svugdje gdje se lokacija koristi.";

// What uses a place, or "Nije u upotrebi" (the list's right-hand column, the phone row's last line)
export const usageLine = (l: LocationView) => locationUseLabel(l.uses) || "Nije u upotrebi";

export const deleteLocationText = (name: string) => `${name} se briše s popisa lokacija.`;

// Obriši: the place leaves the list here and in every picker
export async function removeLocation(id: number) {
  await deleteLocationAPI(id);
  dropLocation(id);
}

const draftOf = (l: LocationView | null): PlaceDraft => (l ? {name: l.name, address: l.address ?? "", url: l.url ?? ""} : EMPTY_PLACE);

// Nova lokacija and Uredi lokaciju: Ime mjesta, Adresa and Link na Google Mape. place: the one being edited, null for a
// new one. A saved place goes into the shared list, so every picker shows it at once.
export function useLocationForm(place: LocationView | null, onSaved: (l: LocationView) => void) {
  const [d, setD] = useState<PlaceDraft>(() => draftOf(place));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = place == null;
  const set = (next: PlaceDraft) => {
    setD(next);
    setError(null);
  };

  // what the form changes, or for a new place everything
  const fields = (): LocationFields => {
    const all = placeFields(d);
    if (isNew) return all;
    const change: LocationFields = {};
    if (all.name !== place.name) change.name = all.name;
    if (all.address !== place.address) change.address = all.address;
    if (all.url !== place.url) change.url = all.url;
    return change;
  };
  const dirty = Object.keys(fields()).length > 0;
  const ok = d.name.trim() !== "" && (isNew || dirty);

  const save = async () => {
    if (!ok || saving) return;
    if (d.url.trim() && !isSafeUrl(d.url)) {
      setError(LOCATION_URL_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createLocationAPI(fields()) : await updateLocationAPI(place.location_id, fields());
      putLocation(saved);
      setD(draftOf(saved));
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : isNew ? "Lokacija nije dodana." : "Lokacija nije spremljena.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setD(draftOf(place));
    setError(null);
  };

  return {d, set, save, saving, error, ok, dirty, isNew, reset};
}

export type LocationForm = ReturnType<typeof useLocationForm>;

// "Otvori kartu" under the fields, for the link as typed (to try it before saving); nothing without an http(s) link
export function MapLink({url, sx}: {url: string; sx?: SxProps<Theme>}) {
  if (!isSafeUrl(url)) return null;
  return (
    <Box
      component="a"
      {...mapLinkProps(url)}
      sx={mergeSx(
        {
          flex: "none",
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          minHeight: 44,
          px: "4px",
          color: color.navy,
          fontSize: 14.5,
          fontWeight: 600,
          textDecoration: "none",
          "& svg": {fontSize: 18},
          "&:hover": {textDecoration: "underline"},
          "&:focus-visible": {outline: `3px solid ${color.navy}`, outlineOffset: "2px", borderRadius: "8px"},
        },
        sx
      )}
    >
      Otvori kartu
      <OpenInNewRoundedIcon aria-hidden />
      <Box component="span" sx={visuallyHidden}>
        (otvara se u novom prozoru)
      </Box>
    </Box>
  );
}

// Why Obriši is locked: "Koristi se: 2 lige · 14 večeri. Lokacija se ne može obrisati dok se koristi." Nothing for a
// place nothing uses. id: for the delete button's aria-describedby.
export function InUseNote({place, id}: {place: LocationView; id?: string}) {
  if (!inUse(place.uses)) return null;
  return (
    <Box
      id={id}
      sx={{flex: "none", display: "flex", alignItems: "flex-start", gap: "10px", p: "12px 14px", borderRadius: "14px", background: color.paper2, fontSize: 14, lineHeight: 1.45, color: color.ink2, "& > svg": {fontSize: 20, color: color.navy, flex: "none", mt: "1px"}}}
    >
      <LockOutlinedIcon aria-hidden />
      <Box component="span" sx={{flex: 1, minWidth: 0, textWrap: "pretty"}}>
        Koristi se: <Box component="b" sx={{color: color.ink, fontWeight: 600}}>{locationUseLabel(place.uses)}</Box>. Lokacija se ne može obrisati dok se koristi.
      </Box>
    </Box>
  );
}
