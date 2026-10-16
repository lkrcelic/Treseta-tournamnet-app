"use client";

import {createSponsorAPI, LogoUpload, SponsorFields, updateSponsorAPI} from "@/app/_fetchers/sponsors";
import {forgetLeagueSponsors} from "@/app/_hooks/useSponsors";
import {SPONSOR_MESSAGE_MAX, SPONSOR_URL_ERROR, SponsorAdmin} from "@/app/_interfaces/sponsor";
import {isSafeUrl} from "@/app/_lib/nights";
import {prepareLogo} from "@/app/_lib/ui/logoUpload";
import {groupDigits, leaguesLabel} from "@/app/_lib/ui/sponsors";
import {NOUN, plural} from "@/app/_lib/ui/text";
import {color} from "@/app/_styles/tokens";
import {buttonBase, Segmented, TextField, TextInput} from "@/app/_ui/sp";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import {Box} from "@mui/material";
import React, {useId, useRef, useState} from "react";
import {LogoSource, SponsorLogo} from "./SponsorParts";

type Draft = {name: string; url: string; message: string; dark: boolean};
const draftOf = (s: SponsorAdmin | null): Draft => ({name: s?.name ?? "", url: s?.url ?? "", message: s?.message ?? "", dark: s?.dark ?? false});

// Novi sponzor and Uredi sponzora, on the phone (a sheet) and the computer (the card next to the list): the logo, its
// background, name, link and the message for the players. sponsor: the one being edited, null for a new one.
export function useSponsorForm(sponsor: SponsorAdmin | null, onSaved: (s: SponsorAdmin) => void) {
  const [d, setD] = useState<Draft>(() => draftOf(sponsor));
  const [upload, setUpload] = useState<(LogoUpload & {preview: string}) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = sponsor == null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((p) => ({...p, [k]: v}));
    setError(null);
  };

  // what the form changes, or for a new sponsor everything
  const fields = (): SponsorFields => {
    const all: SponsorFields = {name: d.name.trim(), url: d.url.trim() || null, message: d.message.trim(), dark: d.dark};
    if (upload) all.logo = {data: upload.data, width: upload.width, height: upload.height};
    if (isNew) return all;
    const change: SponsorFields = {};
    if (all.name !== sponsor.name) change.name = all.name;
    if (all.url !== (sponsor.url ?? null)) change.url = all.url;
    if (all.message !== sponsor.message) change.message = all.message;
    if (all.dark !== sponsor.dark) change.dark = all.dark;
    if (all.logo) change.logo = all.logo;
    return change;
  };
  const dirty = Object.keys(fields()).length > 0;
  const hasLogo = upload != null || !isNew;
  const ok = d.name.trim() !== "" && hasLogo && (isNew || dirty);

  const pickLogo = async (file: File) => {
    setError(null);
    try {
      setUpload(await prepareLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo se nije učitao.");
    }
  };

  const save = async () => {
    if (!ok || saving) return;
    if (d.url.trim() && !isSafeUrl(d.url)) {
      setError(SPONSOR_URL_ERROR);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createSponsorAPI(fields()) : await updateSponsorAPI(sponsor.id, fields());
      forgetLeagueSponsors();
      setUpload(null);
      setD(draftOf(saved));
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : isNew ? "Sponzor nije dodan." : "Sponzor nije spremljen.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setD(draftOf(sponsor));
    setUpload(null);
    setError(null);
  };

  // the logo as the form shows it: the one just picked, else the saved one
  const logo: LogoSource | null = upload
    ? {name: d.name, logo: upload.preview, logo_width: upload.width, logo_height: upload.height, dark: d.dark}
    : sponsor
      ? {...sponsor, dark: d.dark}
      : null;

  return {d, set, logo, pickLogo, save, saving, error, ok, dirty, isNew, reset};
}

export type SponsorForm = ReturnType<typeof useSponsorForm>;

const inputSx = {height: 52, borderRadius: "14px", fontSize: 16} as const;
const hintSx = {fontSize: 13, fontWeight: 500, color: color.muted, lineHeight: 1.4, pl: "4px"} as const;
const labelSx = {fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"} as const;

// The fields; sponsor (when editing) adds its counts under them
export function SponsorFormFields({form, sponsor}: {form: SponsorForm; sponsor: SponsorAdmin | null}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const {d, set, logo} = form;
  const choose = () => fileRef.current?.click();

  return (
    <>
      <Box
        component="input"
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        tabIndex={-1}
        aria-hidden
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) form.pickLogo(file);
          e.target.value = "";
        }}
        sx={{display: "none"}}
      />
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px"}}>
        {logo ? (
          <SponsorLogo sponsor={logo} height={logo.dark ? 60 : 88} sx={{outline: `1px solid ${color.line}`}} />
        ) : (
          <Box
            component="button"
            type="button"
            onClick={choose}
            sx={{
              ...buttonBase,
              width: 88,
              height: 88,
              flex: "none",
              borderRadius: "20px",
              border: `1.5px dashed ${color.borderStrong}`,
              background: color.paper2,
              color: color.navy,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: 13,
              fontWeight: 600,
              "& svg": {fontSize: 28},
            }}
          >
            <AddPhotoAlternateOutlinedIcon aria-hidden />
            Dodaj logo
          </Box>
        )}
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px"}}>
          {logo && (
            <Box
              component="button"
              type="button"
              onClick={choose}
              sx={{...buttonBase, height: 44, display: "flex", alignItems: "center", gap: "6px", px: "14px", borderRadius: "14px", border: `1.5px solid ${color.borderControl}`, background: color.white, color: color.navy, fontSize: 14.5, fontWeight: 600, "& svg": {fontSize: 20}}}
            >
              <UploadRoundedIcon aria-hidden />
              Promijeni logo
            </Box>
          )}
          <Box component="span" sx={{fontSize: 13, color: color.muted, lineHeight: 1.4}}>
            PNG, JPG ili WebP, do 1 MB. Najbolje kvadratni ili položeni.
          </Box>
        </Box>
      </Box>

      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box sx={labelSx}>Pozadina loga</Box>
        <Segmented<"light" | "dark">
          items={[
            {key: "light", label: "Svijetla"},
            {key: "dark", label: "Tamna"},
          ]}
          value={d.dark ? "dark" : "light"}
          onChange={(k) => set("dark", k === "dark")}
          label="Pozadina loga"
          variant="track"
          size={42}
          asTabs={false}
        />
        <Box sx={hintSx}>Tamna za svijetli logo bez pozadine.</Box>
      </Box>

      <TextField label="Ime" placeholder="npr. Caffe bar Kartaš" maxLength={100} value={d.name} onChange={(e) => set("name", e.target.value)} soft inputSx={inputSx} />
      <TextField
        label="Link · neobavezno"
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://…"
        maxLength={500}
        value={d.url}
        onChange={(e) => set("url", e.target.value)}
        soft
        inputSx={inputSx}
      />
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box component="label" htmlFor={messageId} sx={{...labelSx, display: "flex", justifyContent: "space-between", gap: "8px"}}>
          <span>Poruka igračima · neobavezno</span>
          <Box component="span" aria-hidden sx={{fontWeight: 500, color: color.faint, fontVariantNumeric: "tabular-nums"}}>
            {d.message.length}/{SPONSOR_MESSAGE_MAX}
          </Box>
        </Box>
        <TextInput
          id={messageId}
          soft
          maxLength={SPONSOR_MESSAGE_MAX}
          placeholder="npr. 10 % popusta uz karticu lige"
          value={d.message}
          onChange={(e) => set("message", e.target.value.slice(0, SPONSOR_MESSAGE_MAX))}
          sx={inputSx}
        />
      </Box>

      {sponsor && (
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "10px", p: "12px 14px", borderRadius: "14px", background: color.paper2, fontSize: 14, color: color.ink2, "& > svg": {fontSize: 22, color: color.navy, flex: "none"}}}>
          <InsightsRoundedIcon aria-hidden />
          <Box sx={{flex: 1, minWidth: 0, lineHeight: 1.4}}>
            <div>
              Ukupno:{" "}
              <Box component="b" sx={{color: color.ink, fontVariantNumeric: "tabular-nums"}}>
                {groupDigits(sponsor.views)}
              </Box>{" "}
              {plural(sponsor.views, ...NOUN.prikaz)} ·{" "}
              <Box component="b" sx={{color: color.ink, fontVariantNumeric: "tabular-nums"}}>
                {groupDigits(sponsor.clicks)}
              </Box>{" "}
              {plural(sponsor.clicks, ...NOUN.otvaranje)} stranice
            </div>
            <div>U ligama: {leaguesLabel(sponsor.leagues, ", ")}</div>
          </Box>
        </Box>
      )}
    </>
  );
}
