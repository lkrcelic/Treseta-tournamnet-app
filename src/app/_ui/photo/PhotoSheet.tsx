"use client";

import {GOOGLE_PHOTO_PATH} from "@/app/_fetchers/photos";
import {color, font} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, ErrorNote, InitialsAvatar, OutlineButton} from "@/app/_ui/sp";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {Box} from "@mui/material";
import React, {useId, useState} from "react";
import {CropSource, PhotoScreen} from "./PhotoCropper";
import {BlockedNote, PHOTO_TEXT, PhotoControls, PhotoKind, useFilePicker, VisibilityChoices} from "./PhotoParts";
import {ViewableAvatar} from "./PhotoViewer";

// "Profilna slika" / "Slika ekipe" on the phone (Claude Design M2, M5, M6, T2): the Google picture offered as a
// suggestion (a player signed in with Google, no photo yet), Fotografiraj, Odaberi iz galerije, Koristi Google sliku
// and Makni sliku, then "Tko vidi sliku", saved as soon as it is picked. A photo picked or taken opens "Pomakni i
// zumiraj" (PhotoScreen) and is saved from there. While an admin has blocked new photos the sheet only says so (M6).

// google: the player's Google account (its email under "Slika s Google računa"); null when it has no picture
export function PhotoSheet({
  kind,
  photo,
  name,
  letters,
  google,
  open,
  onClose,
}: {
  kind: PhotoKind;
  photo: PhotoControls;
  name: string;
  letters?: string;
  google?: {email: string} | null;
  open: boolean;
  onClose: () => void;
}) {
  const text = PHOTO_TEXT[kind];
  const {photo_url, photo_visibility, photo_blocked} = photo.info;
  const [source, setSource] = useState<CropSource | null>(null);
  const crop = (s: CropSource) => {
    photo.setError(null);
    setSource(s);
    onClose();
  };
  const camera = useFilePicker((file) => crop({file}), true);
  const gallery = useFilePicker((file) => crop({file}));
  const useGoogle = () => crop({src: `${GOOGLE_PHOTO_PATH}?t=${Date.now()}`, fresh: true});
  const whoId = useId();

  const actions: {icon: React.ReactNode; label: string; sub?: string; danger?: boolean; onClick: () => void}[] = [
    {icon: <PhotoCameraOutlinedIcon />, label: "Fotografiraj", onClick: camera.open},
    {icon: <PhotoLibraryOutlinedIcon />, label: "Odaberi iz galerije", sub: photo_url ? undefined : "PNG, JPG ili WebP", onClick: gallery.open},
    ...(photo_url && google ? [{icon: <AccountCircleRoundedIcon />, label: "Koristi Google sliku", onClick: useGoogle}] : []),
    ...(photo_url
      ? [
          {
            icon: <DeleteRoundedIcon />,
            label: "Makni sliku",
            sub: text.removeSub,
            danger: true,
            onClick: async () => {
              if (await photo.remove()) onClose();
            },
          },
        ]
      : []),
  ];

  return (
    <>
      {camera.input}
      {gallery.input}
      <BottomSheet open={open} onClose={onClose} title={text.title} closable busy={photo.busy}>
        {/* the sheet scrolls on a short phone */}
        <Box sx={{minHeight: 0, maxHeight: "calc(100dvh - 150px)", overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "14px", mx: "-4px", px: "4px"}}>
          {photo_blocked ? (
            <>
              <Box sx={{flex: "none", display: "flex", justifyContent: "center", py: "8px"}}>
                <InitialsAvatar name={name} letters={letters} size={112} variant="navy" />
              </Box>
              <BlockedNote kind={kind} />
              <OutlineButton height={52} onClick={onClose} sx={{flex: "none", fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
                U redu
              </OutlineButton>
            </>
          ) : (
            <>
              {photo_url ? (
                <Box sx={{flex: "none", display: "flex", justifyContent: "center", py: "6px"}}>
                  <ViewableAvatar kind={kind} name={name} letters={letters} src={photo_url} size={112} />
                </Box>
              ) : (
                google && <GoogleCard email={google.email} onUse={useGoogle} />
              )}
              <Box component="ul" sx={{flex: "none", listStyle: "none", m: 0, p: 0, borderRadius: "18px", background: color.paper2, overflow: "hidden"}}>
                {actions.map((a, i) => (
                  <Box component="li" key={a.label} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                    <Box
                      component="button"
                      type="button"
                      onClick={a.onClick}
                      disabled={photo.busy}
                      sx={{...buttonBase, width: "100%", minHeight: 60, display: "flex", alignItems: "center", gap: "14px", p: "8px 14px", textAlign: "left", color: a.danger ? color.red : color.ink, "&:disabled": {opacity: 0.5}}}
                    >
                      <Box
                        component="span"
                        aria-hidden
                        sx={{width: 40, height: 40, flex: "none", borderRadius: "12px", background: color.white, color: a.danger ? color.red : color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}
                      >
                        {a.icon}
                      </Box>
                      <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "1px"}}>
                        <Box component="span" sx={{fontSize: 16, fontWeight: 600}}>
                          {a.label}
                        </Box>
                        {a.sub && (
                          <Box component="span" sx={{fontSize: 12.5, color: color.muted}}>
                            {a.sub}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
              {photo.error && <ErrorNote>{photo.error}</ErrorNote>}
              <Box id={whoId} sx={{flex: "none", fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted, pl: "4px", pt: "2px"}}>
                {text.who}
              </Box>
              <VisibilityChoices kind={kind} value={photo_visibility} onChange={photo.setVisibility} labelId={whoId} />
              {kind === "player" ? (
                <Box sx={{flex: "none", fontSize: 13, color: color.muted, pl: "4px"}}>{text.hiddenNote}</Box>
              ) : (
                <Box sx={{flex: "none", display: "flex", gap: "8px", alignItems: "flex-start", p: "12px 14px", borderRadius: "16px", background: color.paper2, fontSize: 13.5, lineHeight: 1.45, color: color.ink, "& svg": {fontSize: 20, color: color.navy, flex: "none"}}}>
                  <InfoOutlinedIcon aria-hidden />
                  {text.hiddenNote}
                </Box>
              )}
            </>
          )}
        </Box>
      </BottomSheet>
      {source && <PhotoScreen source={source} onClose={() => setSource(null)} onSave={photo.save} />}
    </>
  );
}

// "Slika s Google računa": the player's Google picture as a suggestion, with Koristi (it opens the cropper; nothing is
// set by itself)
export function GoogleCard({email, onUse, desktop = false}: {email: string; onUse: () => void; desktop?: boolean}) {
  return (
    <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px", p: desktop ? "12px 14px" : "12px 14px", borderRadius: "18px", background: color.cream}}>
      <Box
        component="img"
        src={GOOGLE_PHOTO_PATH}
        alt=""
        onError={(e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.style.visibility = "hidden")}
        sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", objectFit: "cover", background: color.white}}
      />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
          Slika s Google računa
        </Box>
        <Box component="span" sx={{fontSize: 13, color: color.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
          {email}
        </Box>
      </Box>
      <Box
        component="button"
        type="button"
        onClick={onUse}
        sx={{...buttonBase, height: 40, flex: "none", px: "16px", borderRadius: "20px", background: color.navy, color: color.white, fontFamily: font.display, fontSize: 15, fontWeight: 700}}
      >
        Koristi
      </Box>
    </Box>
  );
}
