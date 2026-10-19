"use client";

import {PhotoTarget, removePhotoAPI, savePhotoAPI, savePhotoBlockedAPI, savePhotoVisibilityAPI} from "@/app/_fetchers/photos";
import type {PhotoVisibility} from "@/app/_interfaces/photo";
import {color, crop as cropColor} from "@/app/_styles/tokens";
import {buttonBase, InitialsAvatar} from "@/app/_ui/sp";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useCallback, useEffect, useRef, useState} from "react";

// What the photo screens share (Claude Design "Profilna slika igrača i ekipe"): the copy for a player's photo and a
// team's, the state of one photo with its calls, the avatar with its camera badge and the "Tko vidi sliku" choice.

export type PhotoKind = PhotoTarget["kind"];

// A photo as the screens hold it: its address (null = the initials or the team's letter), who sees it and whether an
// admin has blocked new ones
export type PhotoInfo = {photo_url: string | null; photo_visibility: PhotoVisibility; photo_blocked: boolean};

type Choice = {key: PhotoVisibility; label: string; sub: string; icon: React.ReactNode};

export const PHOTO_TEXT = {
  player: {
    title: "Profilna slika",
    who: "Tko vidi sliku",
    removeSub: "Vraćaju se inicijali",
    hiddenNote: "Kome je slika skrivena, vidi tvoje inicijale.",
    blocked: "Admin je isključio postavljanje slike na tvom profilu. Ako misliš da je greška, javi se adminu lige.",
    choices: [
      {key: "ALL", label: "Svi", sub: "Svi prijavljeni igrači", icon: <PublicRoundedIcon />},
      {key: "TEAMMATES", label: "Ja i suigrači", sub: "Igrači iz mojih ekipa", icon: <GroupRoundedIcon />},
      {key: "ME", label: "Samo ja", sub: "Ostali vide inicijale", icon: <LockRoundedIcon />},
    ] as Choice[],
  },
  team: {
    title: "Slika ekipe",
    who: "Tko vidi sliku ekipe",
    removeSub: "Vraća se slovo ekipe",
    hiddenNote: "Sliku i vidljivost može promijeniti bilo koji član ekipe.",
    blocked: "Admin je isključio sliku ove ekipe.",
    choices: [
      {key: "ALL", label: "Svi", sub: "Svi prijavljeni igrači", icon: <PublicRoundedIcon />},
      {key: "TEAMMATES", label: "Ja i suigrači", sub: "Samo članovi ekipe", icon: <GroupRoundedIcon />},
    ] as Choice[],
  },
} as const;

// "Svi", "Ja i suigrači", "Samo ja": the row's value on Moj profil and the Team page
export function visibilityLabel(v: PhotoVisibility): string {
  return PHOTO_TEXT.player.choices.find((c) => c.key === v)?.label ?? "Svi";
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// One photo and what can be done to it. The screen shows `info` (it moves at once; a refused change is undone and
// `error` says why); onChange tells the page (and the stores) what is new.
export function usePhoto(target: PhotoTarget, initial: PhotoInfo, onChange?: (info: PhotoInfo) => void) {
  const [info, setInfo] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the page's newer answer (a reload) wins
  useEffect(() => {
    setInfo(initial);
  }, [initial.photo_url, initial.photo_visibility, initial.photo_blocked, target.kind, target.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(info);
  latest.current = info;
  const changed = useRef(onChange);
  changed.current = onChange;

  const apply = useCallback((next: PhotoInfo) => {
    // at once: a second change right after this one (Makni sliku, then Zabrani) builds on it before the next render
    latest.current = next;
    setInfo(next);
    changed.current?.(next);
  }, []);

  // the crop as a data: URL; true once saved
  const save = useCallback(
    async (data: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const photo_url = await savePhotoAPI(target, data);
        apply({...latest.current, photo_url});
        return true;
      } catch (e) {
        setError(errorText(e, "Slika nije spremljena."));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [target, apply]
  );

  const remove = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await removePhotoAPI(target);
      apply({...latest.current, photo_url: null});
      return true;
    } catch (e) {
      setError(errorText(e, "Slika nije maknuta."));
      return false;
    } finally {
      setBusy(false);
    }
  }, [target, apply]);

  // saved as soon as it is picked; a refused one goes back
  const setVisibility = useCallback(
    async (photo_visibility: PhotoVisibility) => {
      const before = latest.current;
      if (before.photo_visibility === photo_visibility) return;
      setError(null);
      apply({...before, photo_visibility});
      try {
        await savePhotoVisibilityAPI(target, photo_visibility);
      } catch (e) {
        apply({...latest.current, photo_visibility: before.photo_visibility});
        setError(errorText(e, "Vidljivost nije spremljena."));
      }
    },
    [target, apply]
  );

  // the admin's "Zabrani novu sliku"
  const setBlocked = useCallback(
    async (photo_blocked: boolean): Promise<boolean> => {
      const before = latest.current;
      setError(null);
      apply({...before, photo_blocked});
      try {
        await savePhotoBlockedAPI(target, photo_blocked);
        return true;
      } catch (e) {
        apply({...latest.current, photo_blocked: before.photo_blocked});
        setError(errorText(e, "Promjena nije spremljena."));
        return false;
      }
    },
    [target, apply]
  );

  return {info, busy, error, setError, save, remove, setVisibility, setBlocked};
}

export type PhotoControls = ReturnType<typeof usePhoto>;

// The avatar a player (or a team's player) changes: the camera badge in its bottom right corner (28 px on the phone,
// 34 px on the computer, navy with a cream ring) and, on the computer, a dark layer with the camera and "Promijeni"
// under the pointer. blocked: an admin has stopped new photos, so there is no badge (a tap tells why). badge 0: none
// (the admin's badge takes its place on the computer's Team page).
export function EditableAvatar({
  name,
  letters,
  src,
  size,
  badge,
  label,
  hover = false,
  blocked = false,
  onClick,
  sx,
}: {
  name: string;
  letters?: string;
  src: string | null;
  size: number;
  badge: number;
  label: string;
  hover?: boolean;
  blocked?: boolean;
  onClick: () => void;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onClick}
      sx={{
        ...buttonBase,
        position: "relative",
        flex: "none",
        width: size,
        height: size,
        borderRadius: "50%",
        "&:focus-visible": {outline: `3px solid ${color.navy}`, outlineOffset: "3px"},
        ...(hover && {"&:hover .photo-hover, &:focus-visible .photo-hover": {opacity: 1}}),
      }}
    >
      <InitialsAvatar name={name} letters={letters} src={src} size={size} variant="navy" sx={sx} />
      {hover && !blocked && (
        <Box
          className="photo-hover"
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: cropColor.shade,
            color: color.white,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2px",
            fontSize: 13,
            fontWeight: 700,
            opacity: 0,
            transition: "opacity 150ms ease",
            "& svg": {fontSize: 24},
          }}
        >
          <PhotoCameraRoundedIcon />
          Promijeni
        </Box>
      )}
      {!blocked && badge > 0 && (
        <Box
          component="span"
          aria-hidden
          sx={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: badge,
            height: badge,
            boxSizing: "border-box",
            borderRadius: "50%",
            border: `3px solid ${color.cream}`,
            background: color.navy,
            color: color.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& svg": {fontSize: Math.round(badge * 0.5)},
          }}
        >
          <PhotoCameraRoundedIcon />
        </Box>
      )}
    </Box>
  );
}

// "Tko vidi sliku": a radio list saved as soon as a row is picked (no Spremi), each row with its icon on the right
export function VisibilityChoices({kind, value, onChange, labelId, disabled}: {kind: PhotoKind; value: PhotoVisibility; onChange: (v: PhotoVisibility) => void; labelId?: string; disabled?: boolean}) {
  const choices = PHOTO_TEXT[kind].choices;
  const pick = (i: number) => onChange(choices[(i + choices.length) % choices.length].key);
  return (
    <Box role="radiogroup" aria-labelledby={labelId} sx={{flex: "none", borderRadius: "18px", background: color.paper2, overflow: "hidden"}}>
      {choices.map((c, i) => {
        const on = c.key === value;
        return (
          <Box
            key={c.key}
            component="button"
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(c.key)}
            onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
              // arrows move the choice, as in any radio group
              if (e.key === "ArrowDown" || e.key === "ArrowRight") (e.preventDefault(), pick(i + 1));
              if (e.key === "ArrowUp" || e.key === "ArrowLeft") (e.preventDefault(), pick(i - 1));
            }}
            sx={{
              ...buttonBase,
              width: "100%",
              minHeight: 58,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              p: "8px 16px",
              borderTop: i ? `1px solid ${color.line}` : "none",
              background: on ? color.cream2 : "transparent",
              textAlign: "left",
              color: color.ink,
              transition: "background 150ms ease",
              "&:disabled": {opacity: 0.5},
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{width: 24, height: 24, flex: "none", boxSizing: "border-box", borderRadius: "50%", border: on ? `7px solid ${color.navy}` : `2px solid ${color.borderStrong}`, background: color.white, transition: "border 150ms ease"}}
            />
            <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
              <Box component="span" sx={{fontSize: 16, fontWeight: 600}}>
                {c.label}
              </Box>
              <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                {c.sub}
              </Box>
            </Box>
            <Box component="span" aria-hidden sx={{flex: "none", display: "flex", color: color.navy, "& svg": {fontSize: 22}}}>
              {c.icon}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// The admin's block on new photos, said to the player or the team (M6, T3)
export function BlockedNote({kind, sx}: {kind: PhotoKind; sx?: SxProps<Theme>}) {
  return (
    <Box
      role="note"
      sx={{
        flex: "none",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        p: "12px 14px",
        borderRadius: "16px",
        background: color.paper2,
        color: color.ink,
        fontSize: 14,
        lineHeight: 1.45,
        "& svg": {fontSize: 20, color: color.navy, flex: "none", mt: "1px"},
        ...(sx as object),
      }}
    >
      <BlockRoundedIcon aria-hidden />
      <span>{PHOTO_TEXT[kind].blocked}</span>
    </Box>
  );
}

// A hidden file input and the call that opens it: the gallery or a file (PNG, JPG or WebP), or the front camera
export function useFilePicker(onFile: (f: File) => void, camera = false) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <Box
      component="input"
      ref={ref}
      type="file"
      accept={camera ? "image/*" : "image/png,image/jpeg,image/webp"}
      {...(camera ? {capture: "user"} : {})}
      tabIndex={-1}
      aria-hidden
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = "";
      }}
      sx={{display: "none"}}
    />
  );
  return {input, open: () => ref.current?.click()};
}
