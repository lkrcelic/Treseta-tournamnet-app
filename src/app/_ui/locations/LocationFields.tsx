"use client";

import {TextField} from "@/app/_ui/sp";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";

// A place being typed (Lokacije, Nova lokacija in a place picker): the three fields as they are ("" for an empty one)
export type PlaceDraft = {name: string; address: string; url: string};

export const EMPTY_PLACE: PlaceDraft = {name: "", address: "", url: ""};

// What a place is saved as: an empty address or link is null
export const placeFields = (p: PlaceDraft) => ({name: p.name.trim(), address: p.address.trim() || null, url: p.url.trim() || null});

// Ime mjesta, Adresa and Link na Google Mape, in that order (no help text: the link is only checked to be http(s), and
// a wrong one is said in the form's error note)
export function PlaceFields({
  value,
  onChange,
  inputSx,
  soft = true,
  gap = "14px",
  autoFocus = false,
}: {
  value: PlaceDraft;
  onChange: (p: PlaceDraft) => void;
  inputSx?: SxProps<Theme>;
  soft?: boolean;
  gap?: string;
  autoFocus?: boolean;
}) {
  const set = (k: keyof PlaceDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({...value, [k]: e.target.value});
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap}}>
      <TextField
        label="Ime mjesta"
        placeholder="npr. Caffe bar Kartaš"
        maxLength={100}
        value={value.name}
        onChange={set("name")}
        soft={soft}
        inputSx={inputSx}
        autoFocus={autoFocus}
      />
      <TextField label="Adresa" placeholder="npr. Ilica 128, Zagreb" maxLength={200} value={value.address} onChange={set("address")} soft={soft} inputSx={inputSx} />
      <TextField
        label="Link na Google Mape"
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://maps.app.goo.gl/…"
        maxLength={500}
        value={value.url}
        onChange={set("url")}
        soft={soft}
        inputSx={inputSx}
      />
    </Box>
  );
}
