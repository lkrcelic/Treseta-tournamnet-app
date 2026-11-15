"use client";

import {useLocations} from "@/app/_hooks/useLocations";
import {inUse, LocationView} from "@/app/_interfaces/location";
import {count} from "@/app/_lib/ui/text";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {PlaceFields} from "@/app/_ui/locations/LocationFields";
import {SponsorEmpty} from "@/app/_ui/sponsors/AdminSponsorParts";
import {buttonBase, Card, DesktopShell, ellipsis, ErrorNote, LoadingRows, NARROW_DESKTOP, OutlineButton, SolidButton, Spinner} from "@/app/_ui/sp";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import {Box, Dialog} from "@mui/material";
import {useEffect, useId, useState} from "react";
import {deleteLocationText, InUseNote, LOCATIONS_INTRO, LOKACIJA, MapLink, removeLocation, usageLine, useLocationForm} from "./LocationForm";

const GRID = {gridTemplateColumns: "40px minmax(0,1.4fr) minmax(0,1fr) 28px", [NARROW_DESKTOP]: {gridTemplateColumns: "36px minmax(0,1.3fr) minmax(0,1fr) 24px"}} as const;
const inputSx = {height: 52, borderRadius: "14px", fontSize: 16} as const;

// Lokacije on the computer, under Admin in the menu (Claude Design 03 A, as Sponzori): every place with what uses it on
// the left, the chosen one (or a new one) edited on the right
export default function LocationsDesktop() {
  const {list, error, reload} = useLocations();
  // the place on the right: an id, a new one, or none yet (the first of the list once it loads)
  const [picked, setPicked] = useState<number | "new" | null>(null);
  const [asking, setAsking] = useState<LocationView | null>(null);
  useEffect(() => {
    if (picked == null && list?.length) setPicked(list[0].location_id);
  }, [list, picked]);
  const current = typeof picked === "number" ? list?.find((l) => l.location_id === picked) ?? null : null;

  const deleted = (id: number) => {
    const rest = (list ?? []).filter((x) => x.location_id !== id);
    setPicked(rest[0]?.location_id ?? null);
    setAsking(null);
  };

  return (
    <DesktopShell
      active="locations"
      eyebrow="Admin"
      title="Lokacije"
      right={
        <SolidButton height={52} onClick={() => setPicked("new")} sx={{px: "20px", fontSize: 15, boxShadow: shadow.action, "& svg": {fontSize: 22}}}>
          <AddLocationAltOutlinedIcon aria-hidden />
          Dodaj lokaciju
        </SolidButton>
      }
    >
      <Box component="p" sx={{flex: "none", m: "-8px 0 0", maxWidth: 760, fontSize: 14, lineHeight: 1.5, color: color.ink2}}>
        {LOCATIONS_INTRO}
      </Box>
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 360px"}, gap: "20px"}}>
        <Card component="section" aria-label="Sve lokacije" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", p: "18px 20px 14px"}}>
            <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
              Sve lokacije
            </Box>
            {list && list.length > 0 && <Box sx={{fontSize: 13, color: color.muted}}>{count(list.length, LOKACIJA)}</Box>}
          </Box>
          {error && !list ? (
            <ErrorNote onRetry={reload} sx={{m: "0 14px 14px"}}>
              {error}
            </ErrorNote>
          ) : !list ? (
            <LoadingRows rows={7} height={64} />
          ) : list.length === 0 ? (
            <SponsorEmpty
              icon={<PlaceOutlinedIcon />}
              title="Još nema lokacija"
              text="Dodaj mjesto jednom, pa ga u svakoj ligi i turniru samo odabereš."
              sx={{flex: 1, justifyContent: "center", p: "24px"}}
            >
              <SolidButton height={52} onClick={() => setPicked("new")} sx={{alignSelf: "center", px: "20px", fontSize: 15, "& svg": {fontSize: 22}}}>
                <AddLocationAltOutlinedIcon aria-hidden />
                Dodaj lokaciju
              </SolidButton>
            </SponsorEmpty>
          ) : (
            <>
              <Box
                aria-hidden
                sx={{flex: "none", height: 40, display: "grid", ...GRID, gap: "12px", alignItems: "center", px: "20px", background: color.paper2, borderTop: `1px solid ${tint.navy[10]}`, borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
              >
                <span />
                <span>Lokacija</span>
                <Box component="span" sx={{textAlign: "right"}}>
                  Koristi se
                </Box>
                <span />
              </Box>
              <Box component="ul" sx={{flex: 1, minHeight: 0, overflowY: "auto", listStyle: "none", m: 0, p: 0}}>
                {list.map((l) => {
                  const on = l.location_id === picked;
                  const used = inUse(l.uses);
                  return (
                    <Box component="li" key={l.location_id} sx={{borderBottom: `1px solid ${color.divider}`}}>
                      <Box
                        component="button"
                        type="button"
                        aria-current={on || undefined}
                        onClick={() => setPicked(l.location_id)}
                        sx={{
                          ...buttonBase,
                          width: "100%",
                          minHeight: 68,
                          display: "grid",
                          ...GRID,
                          gap: "12px",
                          alignItems: "center",
                          px: "20px",
                          py: "10px",
                          textAlign: "left",
                          color: color.ink,
                          background: on ? color.paper : "transparent",
                          boxShadow: on ? shadow.mineBar : "none",
                          "&:hover": {background: on ? color.paper : color.paper2},
                        }}
                      >
                        <PlaceIcon />
                        <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                          <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
                            {l.name}
                          </Box>
                          <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                            {l.address || "Bez adrese"}
                          </Box>
                        </Box>
                        <Box component="span" sx={{textAlign: "right", fontSize: 13.5, color: used ? color.ink2 : color.muted, ...ellipsis}}>
                          {usageLine(l)}
                        </Box>
                        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 22, color: color.faint}} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Card>

        <Card component="section" aria-label={picked === "new" ? "Nova lokacija" : "Uredi lokaciju"} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          {picked === "new" || current ? (
            <LocationPanel
              key={picked === "new" ? "new" : current!.location_id}
              place={picked === "new" ? null : current}
              onSaved={(l) => setPicked(l.location_id)}
              onCancel={() => setPicked(list?.[0]?.location_id ?? null)}
              onDelete={setAsking}
            />
          ) : (
            <Box sx={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", p: "24px", color: color.faint, textAlign: "center", "& svg": {fontSize: 30}}}>
              <EditNoteRoundedIcon aria-hidden />
              <Box sx={{fontSize: 14, color: color.muted}}>Odaberi lokaciju s popisa ili dodaj novu.</Box>
            </Box>
          )}
        </Card>
      </Box>
      {asking && <DeleteDialog place={asking} onClose={() => setAsking(null)} onDeleted={() => deleted(asking.location_id)} />}
    </DesktopShell>
  );
}

// The pin in a soft circle at the start of a row
function PlaceIcon() {
  return (
    <Box component="span" aria-hidden sx={{width: 40, height: 40, borderRadius: "50%", background: color.paper2, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, [NARROW_DESKTOP]: {width: 36, height: 36}}}>
      <PlaceOutlinedIcon />
    </Box>
  );
}

// Uredi lokaciju / Nova lokacija on the right
function LocationPanel({place, onSaved, onCancel, onDelete}: {place: LocationView | null; onSaved: (l: LocationView) => void; onCancel: () => void; onDelete: (l: LocationView) => void}) {
  const form = useLocationForm(place, onSaved);
  const noteId = useId();
  const locked = place != null && inUse(place.uses);
  return (
    <>
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", p: "18px 20px 8px", display: "flex", flexDirection: "column", gap: "14px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box sx={{fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>{place ? "Uredi lokaciju" : "Nova lokacija"}</Box>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", ...ellipsis}}>
            {place ? place.name : "Nova lokacija"}
          </Box>
        </Box>
        <PlaceFields value={form.d} onChange={form.set} inputSx={inputSx} autoFocus={place == null} />
        <MapLink url={form.d.url} sx={{mt: "-6px"}} />
        {place && <InUseNote place={place} id={noteId} />}
      </Box>
      <Box sx={{flex: "none", p: "12px 20px 20px", display: "flex", flexDirection: "column", gap: "10px", borderTop: `1px solid ${color.line}`}}>
        {form.error && <ErrorNote>{form.error}</ErrorNote>}
        <Box sx={{display: "flex", gap: "10px"}}>
          {place ? (
            <>
              <Box
                component="button"
                type="button"
                aria-label="Obriši lokaciju"
                title={locked ? "Lokacija se ne može obrisati dok se koristi" : "Obriši lokaciju"}
                aria-describedby={locked ? noteId : undefined}
                disabled={locked || form.saving}
                onClick={() => onDelete(place)}
                sx={{
                  ...buttonBase,
                  width: 52,
                  height: 52,
                  flex: "none",
                  borderRadius: "14px",
                  border: `1.5px solid ${tint.red[35]}`,
                  color: color.red,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  "& svg": {fontSize: 22},
                  "&:hover:not(:disabled)": {background: tint.red[8]},
                  "&:disabled": {cursor: "not-allowed", borderColor: color.borderControl, color: color.faint},
                }}
              >
                <DeleteRoundedIcon />
              </Box>
              <OutlineButton height={52} onClick={form.reset} disabled={!form.dirty || form.saving} sx={{flex: 1, fontSize: 15, border: `1.5px solid ${color.borderControl}`}}>
                Odbaci promjene
              </OutlineButton>
            </>
          ) : (
            <OutlineButton height={52} onClick={onCancel} disabled={form.saving} sx={{flex: 1, fontSize: 15, border: `1.5px solid ${color.borderControl}`}}>
              Odustani
            </OutlineButton>
          )}
          <SolidButton height={52} onClick={form.save} disabled={!form.ok} loading={form.saving} sx={{flex: 1, fontSize: 15}}>
            {place ? "Spremi" : "Dodaj"}
          </SolidButton>
        </Box>
      </Box>
    </>
  );
}

// "Obrisati lokaciju?", as Sponzori's "Obrisati sponzora?"
function DeleteDialog({place, onClose, onDeleted}: {place: LocationView; onClose: () => void; onDeleted: () => void}) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeLocation(place.location_id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lokacija nije obrisana.");
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 500, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.01em"}}>
        Obrisati lokaciju?
      </Box>
      <Box sx={{display: "flex", gap: "12px", alignItems: "flex-start", p: "14px", borderRadius: "16px", background: tint.red[8], "& > svg": {fontSize: 24, color: color.red, flex: "none"}}}>
        <DeleteRoundedIcon aria-hidden />
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink, textWrap: "pretty"}}>
          {deleteLocationText(place.name)}
        </Box>
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
        <OutlineButton height={52} onClick={onClose} disabled={busy} sx={{fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
          Odustani
        </OutlineButton>
        <Box
          component="button"
          type="button"
          onClick={confirm}
          disabled={busy}
          aria-busy={busy || undefined}
          sx={{...buttonBase, height: 52, borderRadius: "16px", background: color.red, color: color.white, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"}}
        >
          {busy && <Spinner size={18} tone="white" />}
          Obriši
        </Box>
      </Box>
    </Dialog>
  );
}
