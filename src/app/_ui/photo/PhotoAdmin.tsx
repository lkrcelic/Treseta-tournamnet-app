"use client";

import type {PhotoTarget} from "@/app/_fetchers/photos";
import {color, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ConfirmSheet, ErrorNote, InitialsAvatar, SectionLabel, SwitchRow, SwitchTrack} from "@/app/_ui/sp";
import HideImageRoundedIcon from "@mui/icons-material/HideImageRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {Box} from "@mui/material";
import React, {useId, useState} from "react";
import {PhotoInfo, usePhoto, visibilityLabel} from "./PhotoParts";

// The admin's block on a player's or a team's photo (Claude Design: admin-mobile 33 and 35, desktop A4): whether there
// is one, who the player (or team) chose to show it to, "Makni sliku" (asked first, with "Zabrani i novu sliku"; the
// player isn't told) and "Zabrani novu sliku", which stops new photos until it is switched off. An admin sees every
// photo and sets none.

const TEXT = {
  player: {
    title: "Profilna slika",
    chose: "Igrač je odabrao",
    blockSub: "Igrač ne može postaviti sliku dok ovo ne isključiš.",
    removed: (name: string) => `Slika igrača ${name} se briše i umjesto nje se prikazuju inicijali. Igrač ne dobiva obavijest.`,
    always: "Admin uvijek vidi sve slike, bez obzira na izbor igrača.",
  },
  team: {
    title: "Slika ekipe",
    chose: "Ekipa je odabrala",
    blockSub: "Ekipa ne može postaviti sliku dok ovo ne isključiš.",
    removed: (name: string) => `Slika ekipe ${name} se briše i umjesto nje se prikazuje slovo ekipe. Ekipa ne dobiva obavijest.`,
    always: "Admin uvijek vidi sve slike, bez obzira na izbor ekipe.",
  },
} as const;

export function PhotoAdminCard({
  target,
  name,
  letters,
  info,
  phone,
  onChange,
}: {
  target: PhotoTarget;
  name: string;
  letters?: string;
  info: PhotoInfo;
  phone: boolean;
  onChange?: (info: PhotoInfo) => void;
}) {
  const text = TEXT[target.kind];
  const photo = usePhoto(target, info, onChange);
  const {photo_url, photo_visibility, photo_blocked} = photo.info;
  const [asking, setAsking] = useState(false);
  const [alsoBlock, setAlsoBlock] = useState(false);
  const titleId = useId();

  const status = photo_url ? "Ima sliku" : photo_blocked ? "Bez slike · nova je zabranjena" : "Bez slike";
  const chose = `${text.chose}: ${visibilityLabel(photo_visibility).toLowerCase()}. Admin vidi uvijek.`;

  const ask = () => {
    photo.setError(null);
    setAlsoBlock(photo_blocked);
    setAsking(true);
  };
  const confirm = async () => {
    if (!(await photo.remove())) return;
    if (alsoBlock && !photo_blocked) await photo.setBlocked(true);
    setAsking(false);
  };

  const removeButton = (
    <Box
      component="button"
      type="button"
      onClick={ask}
      aria-haspopup={phone ? "dialog" : undefined}
      aria-expanded={!phone ? asking : undefined}
      disabled={photo.busy}
      sx={{
        ...buttonBase,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        borderRadius: "14px",
        border: `1.5px solid ${tint.red[35]}`,
        background: color.white,
        color: color.red,
        fontSize: 15,
        fontWeight: 600,
        "& svg": {fontSize: 20},
        "&:disabled": {opacity: 0.5},
      }}
    >
      <HideImageRoundedIcon aria-hidden />
      Makni sliku
    </Box>
  );

  const blockSwitch = (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={photo_blocked}
      onClick={() => photo.setBlocked(!photo_blocked)}
      sx={{...buttonBase, width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", textAlign: "left"}}
    >
      <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 15.5, fontWeight: 600, color: color.ink}}>
          Zabrani novu sliku
        </Box>
        <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
          {text.blockSub}
        </Box>
      </Box>
      <SwitchTrack on={photo_blocked} />
    </Box>
  );

  // "Zabrani i novu sliku" in the confirmation
  const alsoBlockSwitch = (
    <SwitchRow
      checked={alsoBlock}
      disabled={photo.busy || photo_blocked}
      onChange={setAlsoBlock}
      sx={{flex: "none", minHeight: 60, px: "14px", borderRadius: "14px", borderBottom: "none", background: color.paper2, fontSize: 15, color: color.ink}}
    >
      <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontWeight: 600}}>
          Zabrani i novu sliku
        </Box>
        <Box component="span" sx={{fontSize: 12.5, fontWeight: 400, color: color.muted}}>
          Može se isključiti kasnije
        </Box>
      </Box>
    </SwitchRow>
  );

  return (
    <Box component="section" aria-labelledby={titleId} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id={titleId}>{phone ? text.title : `${name} · ${text.title}`}</SectionLabel>
      <Box sx={{background: color.white, borderRadius: "22px", boxShadow: shadow.card, p: "14px 16px", display: "flex", flexDirection: "column", gap: "12px"}}>
        <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
          <InitialsAvatar name={name} letters={letters} src={photo_url} size={44} variant="paper" />
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 15.5, fontWeight: 700, color: color.ink}}>
              {status}
            </Box>
            <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
              {chose}
            </Box>
          </Box>
        </Box>
        {photo_url && !(asking && !phone) && removeButton}
        {asking && !phone && (
          // the computer asks in place, as the panel's other confirmations
          <Box role="group" aria-label="Maknuti sliku?" sx={{display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "14px", background: tint.red[8]}}>
            <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
              Maknuti sliku?
            </Box>
            <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.ink}}>
              {text.removed(name)}
            </Box>
            {alsoBlockSwitch}
            {photo.error && <ErrorNote>{photo.error}</ErrorNote>}
            <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px"}}>
              <Box
                component="button"
                type="button"
                onClick={() => setAsking(false)}
                disabled={photo.busy}
                sx={{...buttonBase, height: 44, borderRadius: "12px", border: `1.5px solid ${color.borderControl}`, background: color.white, color: color.navy, fontSize: 15, fontWeight: 600}}
              >
                Odustani
              </Box>
              <Box
                component="button"
                type="button"
                onClick={confirm}
                disabled={photo.busy}
                aria-busy={photo.busy || undefined}
                sx={{...buttonBase, height: 44, borderRadius: "12px", background: color.red, color: color.white, fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.6}}}
              >
                Makni sliku
              </Box>
            </Box>
          </Box>
        )}
        <Box sx={{borderTop: `1px solid ${color.line}`}} />
        {blockSwitch}
        {!asking && photo.error && <ErrorNote>{photo.error}</ErrorNote>}
      </Box>
      {!phone && (
        <Box sx={{display: "flex", alignItems: "center", gap: "8px", px: "4px", fontSize: 13, color: color.muted, "& svg": {fontSize: 18, color: color.navy}}}>
          <VisibilityRoundedIcon aria-hidden />
          {text.always}
        </Box>
      )}
      {phone && (
        <ConfirmSheet
          open={asking}
          onClose={() => setAsking(false)}
          onConfirm={confirm}
          title="Maknuti sliku?"
          text={text.removed(name)}
          action="Makni sliku"
          icon={<HideImageRoundedIcon />}
          busy={photo.busy}
          error={photo.error}
          extra={alsoBlockSwitch}
        />
      )}
    </Box>
  );
}
