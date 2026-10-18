"use client";

import {createSponsorAPI, LogoUpload, SponsorFields, updateSponsorAPI} from "@/app/_fetchers/sponsors";
import {forgetLeagueSponsors} from "@/app/_hooks/useSponsors";
import {LogoBackground, SPONSOR_MESSAGE_MAX, SPONSOR_URL_ERROR, SponsorAdmin} from "@/app/_interfaces/sponsor";
import {isSafeUrl} from "@/app/_lib/nights";
import {groupDigits, leaguesLabel, logoAspect, logoTile} from "@/app/_lib/ui/sponsors";
import {NOUN, plural} from "@/app/_lib/ui/text";
import {color} from "@/app/_styles/tokens";
import {buttonBase, Segmented, TextField, TextInput} from "@/app/_ui/sp";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import {Box} from "@mui/material";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import React, {useId, useState} from "react";
import {LogoDialog, LogoResult, LogoScreen, LogoSourceSheet} from "./LogoEditor";
import {LogoSource, SponsorLogo} from "./SponsorParts";

type Draft = {name: string; url: string; message: string; background: LogoBackground};
const draftOf = (s: SponsorAdmin | null): Draft => ({name: s?.name ?? "", url: s?.url ?? "", message: s?.message ?? "", background: s?.background ?? "none"});

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
    const all: SponsorFields = {name: d.name.trim(), url: d.url.trim() || null, message: d.message.trim(), background: d.background};
    if (upload) all.logo = {data: upload.data, width: upload.width, height: upload.height};
    if (isNew) return all;
    const change: SponsorFields = {};
    if (all.name !== sponsor.name) change.name = all.name;
    if (all.url !== (sponsor.url ?? null)) change.url = all.url;
    if (all.message !== sponsor.message) change.message = all.message;
    if (all.background !== sponsor.background) change.background = all.background;
    if (all.logo) change.logo = all.logo;
    return change;
  };
  const dirty = Object.keys(fields()).length > 0;
  const hasLogo = upload != null || !isNew;
  const ok = d.name.trim() !== "" && hasLogo && (isNew || dirty);

  // the logo cropped in the dialog (or the phone's full screen), with the background chosen there
  const setLogo = (r: LogoResult) => {
    setUpload(r.upload);
    set("background", r.background);
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
    ? {name: d.name, logo: upload.preview, logo_width: upload.width, logo_height: upload.height, background: d.background}
    : sponsor
      ? {...sponsor, background: d.background}
      : null;

  return {d, set, logo, setLogo, save, saving, error, ok, dirty, isNew, reset};
}

export type SponsorForm = ReturnType<typeof useSponsorForm>;

const inputSx = {height: 52, borderRadius: "14px", fontSize: 16} as const;
const hintSx = {fontSize: 13, fontWeight: 500, color: color.muted, lineHeight: 1.4, pl: "4px"} as const;
const labelSx = {fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"} as const;

// The fields; sponsor (when editing) adds its counts under them
// The logo is cropped like a profile photo (Claude Design "Profilna slika · dijalog"): on the computer in the "Logo
// sponzora" dialog, on the phone from Fotografiraj / Odaberi iz galerije into the full-screen "Pomakni i zumiraj".
type Editing = {kind: "dialog"} | {kind: "source"} | {kind: "screen"; file: File | null};

export function SponsorFormFields({form, sponsor}: {form: SponsorForm; sponsor: SponsorAdmin | null}) {
  const messageId = useId();
  const isDesktop = useIsDesktop();
  const [editing, setEditing] = useState<Editing | null>(null);
  const {d, set, logo} = form;
  const choose = () => setEditing(isDesktop ? {kind: "dialog"} : {kind: "source"});
  const done = (r: LogoResult) => {
    form.setLogo(r);
    setEditing(null);
  };

  return (
    <>
      {editing?.kind === "dialog" && <LogoDialog src={logo?.logo ?? null} background={d.background} onClose={() => setEditing(null)} onDone={done} />}
      {editing?.kind === "source" && (
        <LogoSourceSheet
          hasLogo={logo != null}
          onClose={() => setEditing(null)}
          onFile={(file) => setEditing({kind: "screen", file})}
          onRecrop={() => setEditing({kind: "screen", file: null})}
        />
      )}
      {editing?.kind === "screen" && (
        <LogoScreen file={editing.file} src={editing.file ? null : logo?.logo ?? null} background={d.background} onClose={() => setEditing(null)} onDone={done} />
      )}
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px"}}>
        {logo ? (
          <Box component="button" type="button" aria-label="Promijeni logo" onClick={choose} sx={{...buttonBase, display: "flex", borderRadius: `${logoTile(64, logoAspect(logo)).radius}px`}}>
            <SponsorLogo sponsor={logo} height={64} />
          </Box>
        ) : (
          <Box
            component="button"
            type="button"
            onClick={choose}
            sx={{
              ...buttonBase,
              // the shape of the logo's tile (logoTile at 64 px)
              width: logoTile(64).width,
              height: 64,
              flex: "none",
              borderRadius: `${logoTile(64).radius}px`,
              border: `1.5px dashed ${color.borderStrong}`,
              background: color.paper2,
              color: color.navy,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              fontSize: 13,
              fontWeight: 600,
              "& svg": {fontSize: 24},
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
            PNG, JPG ili WebP. Logo možeš pomaknuti, zumirati i okrenuti.
          </Box>
        </Box>
      </Box>

      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box sx={labelSx}>Pozadina loga</Box>
        <Segmented<LogoBackground>
          items={[
            {key: "none", label: "Bez pozadine"},
            {key: "dark", label: "Crna pozadina"},
          ]}
          value={d.background}
          onChange={(k) => set("background", k)}
          label="Pozadina loga"
          variant="track"
          size={42}
          asTabs={false}
        />
        <Box sx={hintSx}>Crna pozadina za svijetli logo koji se na bijelom ne vidi.</Box>
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
