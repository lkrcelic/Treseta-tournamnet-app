"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import {useLocations} from "@/app/_hooks/useLocations";
import {inUse, LocationView} from "@/app/_interfaces/location";
import {color, font} from "@/app/_styles/tokens";
import {PlaceFields} from "@/app/_ui/locations/LocationFields";
import {DashedAction, listCardSx, SponsorEmpty} from "@/app/_ui/sponsors/AdminSponsorParts";
import {
  BottomSheet,
  buttonBase,
  ConfirmSheet,
  ellipsis,
  ErrorNote,
  ErrorState,
  IconCircleButton,
  LoadingRows,
  OutlineButton,
  Screen,
  ScrollArea,
  SectionLabel,
  SolidButton,
  StackTopBar,
} from "@/app/_ui/sp";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import {Box} from "@mui/material";
import {useId, useState} from "react";
import {deleteLocationText, InUseNote, LOCATIONS_INTRO, MapLink, removeLocation, usageLine, useLocationForm} from "./LocationForm";

const inputSx = {height: 52, borderRadius: "14px", fontSize: 16} as const;

// Lokacije on the admin's phone (Claude Design 03 A, as Sponzori): the one list of places, each edited in a sheet. The
// bottom bar is full, so the page isn't a tab: it opens from a place picker's "Sve lokacije" and has Back and Home.
export default function LocationsPhone() {
  const {list, error, reload} = useLocations();
  const nav = useNavStack("Lokacije");
  // the sheet: a new place, or the one being edited
  const [editing, setEditing] = useState<LocationView | "new" | null>(null);
  const [asking, setAsking] = useState<LocationView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async () => {
    if (!asking) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeLocation(asking.location_id);
      setAsking(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Lokacija nije obrisana.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen fill gap={14}>
      <StackTopBar eyebrow="Admin" nav={nav} />
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em"}}>
          Lokacije
        </Box>
        <IconCircleButton label="Nova lokacija" onClick={() => setEditing("new")}>
          <AddRoundedIcon />
        </IconCircleButton>
      </Box>

      <ScrollArea bleed sx={{gap: "12px"}}>
        {error && !list ? (
          <ErrorState title="Lokacije se nisu učitale" onRetry={reload} />
        ) : !list ? (
          <Box sx={listCardSx}>
            <LoadingRows rows={6} height={64} />
          </Box>
        ) : list.length === 0 ? (
          <Box sx={{...listCardSx, p: "24px 20px 20px"}}>
            <SponsorEmpty icon={<PlaceOutlinedIcon />} title="Još nema lokacija" text="Dodaj mjesto jednom, pa ga u svakoj ligi i turniru samo odabereš.">
              <SolidButton height={52} onClick={() => setEditing("new")} sx={{fontSize: 16, "& svg": {fontSize: 22}}}>
                <AddLocationAltOutlinedIcon aria-hidden />
                Dodaj lokaciju
              </SolidButton>
            </SponsorEmpty>
          </Box>
        ) : (
          <>
            <Box component="p" sx={{m: 0, px: "6px", fontSize: 13, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>
              {LOCATIONS_INTRO}
            </Box>
            <DashedAction icon={<AddLocationAltOutlinedIcon aria-hidden />} onClick={() => setEditing("new")}>
              Dodaj lokaciju
            </DashedAction>
            <SectionLabel sx={{pt: "4px"}}>Sve lokacije · {list.length}</SectionLabel>
            <Box component="ul" aria-label="Sve lokacije" sx={{...listCardSx, listStyle: "none", m: 0, p: 0}}>
              {list.map((l, i) => (
                <Box component="li" key={l.location_id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setEditing(l)}
                    sx={{...buttonBase, width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", p: "10px 10px 10px 14px", textAlign: "left", color: color.ink, "&:active": {background: color.paper2}}}
                  >
                    <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.paper2, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 24}}}>
                      <PlaceOutlinedIcon />
                    </Box>
                    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                      <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                        {l.name}
                      </Box>
                      <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                        {l.address || "Bez adrese"}
                      </Box>
                      <Box component="span" sx={{fontSize: 12.5, color: inUse(l.uses) ? color.ink2 : color.muted, ...ellipsis}}>
                        {usageLine(l)}
                      </Box>
                    </Box>
                    <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy}} />
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </ScrollArea>

      {editing && (
        <LocationSheet
          key={editing === "new" ? "new" : editing.location_id}
          place={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onDelete={(l) => {
            setEditing(null);
            setDeleteError(null);
            setAsking(l);
          }}
        />
      )}
      <ConfirmSheet
        open={asking != null}
        onClose={() => setAsking(null)}
        onConfirm={remove}
        title="Obrisati lokaciju?"
        text={asking ? deleteLocationText(asking.name) : ""}
        action="Obriši"
        icon={<DeleteRoundedIcon />}
        busy={deleting}
        error={deleteError}
      />
    </Screen>
  );
}

// Nova lokacija / Uredi lokaciju
function LocationSheet({place, onClose, onSaved, onDelete}: {place: LocationView | null; onClose: () => void; onSaved: (l: LocationView) => void; onDelete: (l: LocationView) => void}) {
  const form = useLocationForm(place, onSaved);
  const noteId = useId();
  const locked = place != null && inUse(place.uses);
  return (
    <BottomSheet open onClose={onClose} title={form.isNew ? "Nova lokacija" : "Uredi lokaciju"} closable busy={form.saving}>
      <PlaceFields value={form.d} onChange={form.set} inputSx={inputSx} />
      <MapLink url={form.d.url} sx={{mt: "-6px"}} />
      {place && <InUseNote place={place} id={noteId} />}
      {form.error && <ErrorNote>{form.error}</ErrorNote>}
      <Box sx={{flex: "none", display: "flex", gap: "10px"}}>
        {place ? (
          <Box
            component="button"
            type="button"
            aria-label="Obriši lokaciju"
            aria-describedby={locked ? noteId : undefined}
            disabled={locked || form.saving}
            onClick={() => onDelete(place)}
            sx={{
              ...buttonBase,
              width: 56,
              height: 56,
              flex: "none",
              borderRadius: "16px",
              border: `1.5px solid ${color.red}`,
              color: color.red,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "& svg": {fontSize: 24},
              "&:disabled": {borderColor: color.borderControl, color: color.faint},
            }}
          >
            <DeleteRoundedIcon />
          </Box>
        ) : (
          <OutlineButton onClick={onClose} disabled={form.saving} sx={{flex: 1, fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
            Odustani
          </OutlineButton>
        )}
        <SolidButton onClick={form.save} disabled={!form.ok} loading={form.saving} sx={{flex: 1, fontSize: 16}}>
          {form.isNew ? "Dodaj" : "Spremi"}
        </SolidButton>
      </Box>
    </BottomSheet>
  );
}
