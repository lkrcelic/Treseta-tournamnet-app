"use client";

import type {PhotoTarget} from "@/app/_fetchers/photos";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ConfirmSheet, ErrorNote, IconCircleButton, InitialsAvatar, SectionLabel, SwitchRow, SwitchTrack} from "@/app/_ui/sp";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HideImageRoundedIcon from "@mui/icons-material/HideImageRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {Box, Popover} from "@mui/material";
import React, {useId, useRef, useState} from "react";
import {PhotoInfo, usePhoto, visibilityLabel} from "./PhotoParts";
import {ViewableAvatar} from "./PhotoViewer";

// The admin's block on a player's or a team's photo (Claude Design: admin-mobile 33 and 35): whether there is one, who
// the player (or team) chose to show it to, "Makni sliku" (asked first, with "Zabrani i novu sliku"; the player isn't
// told) and "Zabrani novu sliku", which stops new photos until it is switched off. An admin sees every photo and sets
// none. The phone shows it as a card under the header card (PhotoAdminCard); the computer keeps it on the photo
// itself, a badge on the header card's avatar that opens it as a panel (PhotoAdminBadge), so the columns under the
// header keep their whole height.

const TEXT = {
  player: {
    title: "Profilna slika",
    chose: "Igrač je odabrao",
    blockSub: "Igrač ne može postaviti sliku dok ovo ne isključiš.",
    removed: (name: string) => `Slika igrača ${name} se briše i umjesto nje se prikazuju inicijali. Igrač ne dobiva obavijest.`,
    always: "Admin uvijek vidi sve slike, bez obzira na izbor igrača.",
    settings: (name: string) => `Profilna slika: ${name}`,
  },
  team: {
    title: "Slika ekipe",
    chose: "Ekipa je odabrala",
    blockSub: "Ekipa ne može postaviti sliku dok ovo ne isključiš.",
    removed: (name: string) => `Slika ekipe ${name} se briše i umjesto nje se prikazuje slovo ekipe. Ekipa ne dobiva obavijest.`,
    always: "Admin uvijek vidi sve slike, bez obzira na izbor ekipe.",
    settings: (name: string) => `Slika ekipe: ${name}`,
  },
} as const;

type AdminPhotoProps = {
  target: PhotoTarget;
  name: string;
  info: PhotoInfo;
  onChange?: (info: PhotoInfo) => void;
};

// The photo with the admin's calls, and "Makni sliku" while it is being asked
function useAdminPhoto({target, info, onChange}: AdminPhotoProps) {
  const text = TEXT[target.kind];
  const photo = usePhoto(target, info, onChange);
  const {photo_url, photo_visibility, photo_blocked} = photo.info;
  const [asking, setAsking] = useState(false);
  const [alsoBlock, setAlsoBlock] = useState(false);
  return {
    text,
    photo,
    asking,
    alsoBlock,
    setAlsoBlock,
    status: photo_url ? "Ima sliku" : photo_blocked ? "Bez slike · nova je zabranjena" : "Bez slike",
    chose: `${text.chose}: ${visibilityLabel(photo_visibility).toLowerCase()}.`,
    ask: () => {
      photo.setError(null);
      setAlsoBlock(photo_blocked);
      setAsking(true);
    },
    cancel: () => setAsking(false),
    confirm: async () => {
      if (!(await photo.remove())) return;
      if (alsoBlock && !photo_blocked) await photo.setBlocked(true);
      setAsking(false);
    },
  };
}

type AdminPhoto = ReturnType<typeof useAdminPhoto>;

function RemoveButton({admin, phone}: {admin: AdminPhoto; phone: boolean}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={admin.ask}
      aria-haspopup={phone ? "dialog" : undefined}
      aria-expanded={!phone ? admin.asking : undefined}
      disabled={admin.photo.busy}
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
        transition: "background 150ms ease",
        "&:hover:not(:disabled)": {background: tint.red[8]},
        "& svg": {fontSize: 20},
        "&:disabled": {opacity: 0.5},
      }}
    >
      <HideImageRoundedIcon aria-hidden />
      Makni sliku
    </Box>
  );
}

function BlockSwitch({admin}: {admin: AdminPhoto}) {
  const blocked = admin.photo.info.photo_blocked;
  return (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={blocked}
      onClick={() => admin.photo.setBlocked(!blocked)}
      sx={{...buttonBase, width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", textAlign: "left"}}
    >
      <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 15.5, fontWeight: 600, color: color.ink}}>
          Zabrani novu sliku
        </Box>
        <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
          {admin.text.blockSub}
        </Box>
      </Box>
      <SwitchTrack on={blocked} />
    </Box>
  );
}

// "Zabrani i novu sliku" in the confirmation
function AlsoBlockSwitch({admin}: {admin: AdminPhoto}) {
  return (
    <SwitchRow
      checked={admin.alsoBlock}
      disabled={admin.photo.busy || admin.photo.info.photo_blocked}
      onChange={admin.setAlsoBlock}
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
}

// The computer asks in place, as its other confirmations
function ConfirmInPlace({admin, name}: {admin: AdminPhoto; name: string}) {
  return (
    <Box role="group" aria-label="Maknuti sliku?" sx={{display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "14px", background: tint.red[8]}}>
      <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
        Maknuti sliku?
      </Box>
      <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.ink}}>
        {admin.text.removed(name)}
      </Box>
      <AlsoBlockSwitch admin={admin} />
      {admin.photo.error && <ErrorNote>{admin.photo.error}</ErrorNote>}
      <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px"}}>
        <Box
          component="button"
          type="button"
          onClick={admin.cancel}
          disabled={admin.photo.busy}
          sx={{...buttonBase, height: 44, borderRadius: "12px", border: `1.5px solid ${color.borderControl}`, background: color.white, color: color.navy, fontSize: 15, fontWeight: 600}}
        >
          Odustani
        </Box>
        <Box
          component="button"
          type="button"
          onClick={admin.confirm}
          disabled={admin.photo.busy}
          aria-busy={admin.photo.busy || undefined}
          sx={{...buttonBase, height: 44, borderRadius: "12px", background: color.red, color: color.white, fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.6}}}
        >
          Makni sliku
        </Box>
      </Box>
    </Box>
  );
}

// The phone's card under the header card (admin-mobile 33 and 35); Makni sliku asks in a sheet
export function PhotoAdminCard({letters, ...props}: AdminPhotoProps & {letters?: string}) {
  const admin = useAdminPhoto(props);
  const {target, name} = props;
  const titleId = useId();
  return (
    <Box component="section" aria-labelledby={titleId} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id={titleId}>{admin.text.title}</SectionLabel>
      <Box sx={{background: color.white, borderRadius: "22px", boxShadow: shadow.card, p: "14px 16px", display: "flex", flexDirection: "column", gap: "12px"}}>
        <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
          <ViewableAvatar kind={target.kind} name={name} letters={letters} src={admin.photo.info.photo_url} size={44} variant="paper" />
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 15.5, fontWeight: 700, color: color.ink}}>
              {admin.status}
            </Box>
            <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
              {admin.chose} Admin vidi uvijek.
            </Box>
          </Box>
        </Box>
        {admin.photo.info.photo_url && <RemoveButton admin={admin} phone />}
        <Box sx={{borderTop: `1px solid ${color.line}`}} />
        <BlockSwitch admin={admin} />
        {!admin.asking && admin.photo.error && <ErrorNote>{admin.photo.error}</ErrorNote>}
      </Box>
      <ConfirmSheet
        open={admin.asking}
        onClose={admin.cancel}
        onConfirm={admin.confirm}
        title="Maknuti sliku?"
        text={admin.text.removed(name)}
        action="Makni sliku"
        icon={<HideImageRoundedIcon />}
        busy={admin.photo.busy}
        error={admin.photo.error}
        extra={<AlsoBlockSwitch admin={admin} />}
      />
    </Box>
  );
}

// The computer's: a badge on the header card's avatar (HeroCard's avatarOverlay, which places it on the circle's lower
// right) that opens the same block as a panel beside the photo. The badge turns red with a ⊘ while new photos are
// banned, so that shows without opening it. size: the badge's, as the camera badge of the team's players.
export function PhotoAdminBadge({size, letters, ...props}: AdminPhotoProps & {size: number; letters?: string}) {
  const admin = useAdminPhoto(props);
  const {name} = props;
  const blocked = admin.photo.info.photo_blocked;
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => {
    setOpen(false);
    admin.cancel();
  };
  return (
    <>
      <Box
        component="button"
        type="button"
        ref={anchor}
        aria-label={`${admin.text.settings(name)}${blocked ? ", nova je zabranjena" : ""}`}
        title={blocked ? `${admin.text.title} · nova je zabranjena` : admin.text.title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        sx={{
          ...buttonBase,
          position: "absolute",
          right: -4,
          bottom: -4,
          width: size,
          height: size,
          boxSizing: "border-box",
          borderRadius: "50%",
          border: `3px solid ${color.cream}`,
          background: blocked ? color.red : color.navy,
          color: color.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 150ms ease, box-shadow 150ms ease",
          "&:hover": {transform: "scale(1.08)", boxShadow: shadow.raised},
          "&:focus-visible": {outline: `3px solid ${color.navy}`, outlineOffset: "2px"},
          "& svg": {fontSize: Math.round(size * 0.52)},
        }}
      >
        {blocked ? <BlockRoundedIcon aria-hidden /> : <TuneRoundedIcon aria-hidden />}
      </Box>
      <Popover
        open={open}
        anchorEl={anchor.current}
        onClose={close}
        anchorOrigin={{vertical: "bottom", horizontal: "left"}}
        transformOrigin={{vertical: "top", horizontal: "left"}}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-labelledby": titleId,
            sx: {mt: "10px", width: 380, maxWidth: "calc(100vw - 32px)", borderRadius: "22px", p: "16px 18px 14px", boxShadow: shadow.popover, display: "flex", flexDirection: "column", gap: "12px"},
          },
        }}
      >
        <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
          <InitialsAvatar name={name} letters={letters} src={admin.photo.info.photo_url} size={48} variant="paper" />
          <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 19, fontWeight: 800, lineHeight: 1.15, color: color.ink}}>
              {admin.text.title}
            </Box>
            <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
              <Box component="span" sx={{fontWeight: 700, color: blocked && !admin.photo.info.photo_url ? color.red : color.ink}}>
                {admin.status}
              </Box>
              {" · "}
              {admin.chose}
            </Box>
          </Box>
          <IconCircleButton label="Zatvori" size={36} onClick={close} sx={{alignSelf: "flex-start", background: color.paper, boxShadow: "none", "& svg": {fontSize: 20}}}>
            <CloseRoundedIcon />
          </IconCircleButton>
        </Box>
        {admin.photo.info.photo_url && !admin.asking && <RemoveButton admin={admin} phone={false} />}
        {admin.asking && <ConfirmInPlace admin={admin} name={name} />}
        <Box sx={{borderTop: `1px solid ${color.line}`}} />
        <BlockSwitch admin={admin} />
        {!admin.asking && admin.photo.error && <ErrorNote>{admin.photo.error}</ErrorNote>}
        <Box sx={{display: "flex", alignItems: "center", gap: "8px", pt: "10px", borderTop: `1px solid ${color.line}`, fontSize: 12.5, lineHeight: 1.35, color: color.muted, "& svg": {fontSize: 18, color: color.navy, flex: "none"}}}>
          <VisibilityRoundedIcon aria-hidden />
          {admin.text.always}
        </Box>
      </Popover>
    </>
  );
}
