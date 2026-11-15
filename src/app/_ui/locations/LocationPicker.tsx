"use client";

import {createLocationAPI} from "@/app/_fetchers/locations";
import useCan from "@/app/_hooks/useCan";
import {putLocation, useLocations} from "@/app/_hooks/useLocations";
import {LocationView, locationUseLabel} from "@/app/_interfaces/location";
import {NightLocation} from "@/app/_lib/nights";
import {color, shadow} from "@/app/_styles/tokens";
import {EMPTY_PLACE, PlaceDraft, PlaceFields, placeFields} from "@/app/_ui/locations/LocationFields";
import {ErrorNote, inputSx as fieldSx, mergeSx, OutlineButton, SearchInput, SolidButton} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {Box, SxProps, Theme} from "@mui/material";
import Link from "next/link";
import React, {useEffect, useId, useMemo, useRef, useState} from "react";

// One "Lokacija" field instead of Ime mjesta, Adresa and Link (Claude Design 10 A): Podaci lige, Uredi večer, Nova
// liga and the tournament form pick a place from Lokacije. Open, it searches the places by name and address, adds a
// new one in place (Nova lokacija, with the name typed so far) and links to Sve lokacije for an admin.

// Searching ignores case and the hooks of č, ć, š, ž and đ: "kartas" finds Kartaš
const folded = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

export const locationOfView = (l: LocationView): NightLocation => ({id: l.location_id, name: l.name, address: l.address, url: l.url});

export function LocationPicker({
  label = "Lokacija",
  value,
  onChange,
  soft = true,
  inputSx,
  placeholder = "Odaberi lokaciju",
  clearable = true,
  exclude = [],
  defaultOpen = false,
  action,
  error: fieldError,
  sx,
}: {
  label?: string;
  value: NightLocation | null;
  onChange: (place: NightLocation | null) => void;
  soft?: boolean;
  inputSx?: SxProps<Theme>;
  placeholder?: string;
  // the × that takes the place away (Bez lokacije)
  clearable?: boolean;
  // places not offered (a night's first place, when its second is picked)
  exclude?: number[];
  // it opens at once (Dodaj drugu lokaciju)
  defaultOpen?: boolean;
  // a button beside the field (Uredi večer's × that takes the second place away)
  action?: React.ReactNode;
  // what is wrong with the place picked, under the field
  error?: string;
  sx?: SxProps<Theme>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const {list, error: loadError, reload} = useLocations();
  const manage = useCan("location.manage");
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<PlaceDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  // a click outside or Escape closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setAdding(null);
    setError(null);
  };

  const matches = useMemo(() => {
    const q = folded(query.trim());
    return (list ?? []).filter((l) => !exclude.includes(l.location_id) && (!q || folded(`${l.name} ${l.address ?? ""}`).includes(q)));
  }, [list, query, exclude]);
  const exact = (list ?? []).some((l) => folded(l.name) === folded(query.trim()));

  const pick = (l: LocationView) => {
    onChange(locationOfView(l));
    close();
  };

  const add = async () => {
    if (!adding || !adding.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const made = await createLocationAPI(placeFields(adding));
      putLocation(made);
      pick(made);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lokacija nije dodana.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box ref={box} sx={mergeSx({display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}, sx)}>
      <Box component="label" htmlFor={id} sx={{fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}}>
        {label}
      </Box>
      <Box sx={{display: "flex", alignItems: "stretch", gap: "8px"}}>
        <Box sx={{position: "relative", flex: 1, minWidth: 0}}>
          <Box
            component="button"
            type="button"
            id={id}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            onClick={() => (open ? close() : setOpen(true))}
            sx={mergeSx(
              fieldSx,
              soft && {background: color.paper2},
              {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textAlign: "left",
                cursor: "pointer",
                pr: value && clearable ? "92px" : "48px",
                ...(open && {borderColor: color.navy}),
              },
              inputSx,
              {height: "auto", minHeight: 52, py: "8px"}
            )}
          >
            <PlaceRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: value ? color.navy : color.faint}} />
            {value ? (
              <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column"}}>
                <Box component="span" sx={{fontSize: 15.5, fontWeight: 700, color: color.ink, overflowWrap: "anywhere"}}>
                  {value.name}
                </Box>
                {value.address && (
                  <Box component="span" sx={{fontSize: 13, color: color.muted, overflowWrap: "anywhere"}}>
                    {value.address}
                  </Box>
                )}
              </Box>
            ) : (
              <Box component="span" sx={{fontSize: 16, color: color.faint}}>
                {placeholder}
              </Box>
            )}
          </Box>
          <Box sx={{position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "2px", pointerEvents: "none"}}>
            {value && clearable && (
              <Box
                component="button"
                type="button"
                aria-label="Makni lokaciju"
                onClick={() => {
                  onChange(null);
                  close();
                }}
                sx={{
                  pointerEvents: "auto",
                  width: 36,
                  height: 36,
                  border: 0,
                  borderRadius: "50%",
                  background: "transparent",
                  color: color.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  "&:hover": {background: color.line},
                  "& svg": {fontSize: 20},
                }}
              >
                <CloseRoundedIcon />
              </Box>
            )}
            <ExpandMoreRoundedIcon aria-hidden sx={{fontSize: 24, color: color.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease"}} />
          </Box>
        </Box>
        {action}
      </Box>
      {fieldError && (
        <Box id={errorId} sx={{display: "flex", alignItems: "flex-start", gap: "6px", pl: "4px", fontSize: 14, lineHeight: "20px", fontWeight: 600, color: color.red}}>
          <ErrorRoundedIcon sx={{flex: "none", fontSize: 18, mt: "1px"}} />
          {fieldError}
        </Box>
      )}

      {open && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            p: "10px",
            borderRadius: "16px",
            background: color.white,
            border: `1px solid ${color.line}`,
            boxShadow: shadow.cardHover,
          }}
        >
          {adding ? (
            <Box sx={{display: "flex", flexDirection: "column", gap: "12px", p: "4px"}}>
              <Box sx={{fontSize: 14, fontWeight: 700, color: color.ink}}>Nova lokacija</Box>
              <PlaceFields value={adding} onChange={setAdding} gap="10px" autoFocus inputSx={{height: 48, borderRadius: "12px", fontSize: 16}} />
              {error && <ErrorNote>{error}</ErrorNote>}
              <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "8px"}}>
                <OutlineButton height={46} onClick={() => setAdding(null)} disabled={saving} sx={{fontSize: 15, borderWidth: "1.5px", borderColor: color.borderControl}}>
                  Natrag
                </OutlineButton>
                <SolidButton height={46} onClick={add} disabled={!adding.name.trim()} loading={saving} sx={{fontSize: 15}}>
                  Dodaj lokaciju
                </SolidButton>
              </Box>
            </Box>
          ) : (
            <>
              <SearchInput
                autoFocus
                height={44}
                variant="paper"
                placeholder="Traži lokaciju…"
                aria-label="Traži lokaciju po imenu ili adresi"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery("")}
              />
              {loadError ? (
                <ErrorNote onRetry={reload}>{loadError}</ErrorNote>
              ) : list == null ? (
                <Box sx={{p: "10px", fontSize: 14, color: color.muted}}>Učitavam lokacije…</Box>
              ) : (
                <Box role="listbox" aria-label="Lokacije" sx={{display: "flex", flexDirection: "column", maxHeight: 280, overflowY: "auto", overscrollBehavior: "contain"}}>
                  {matches.length === 0 && (
                    <Box sx={{p: "10px", fontSize: 14, color: color.muted}}>{query.trim() ? "Nema lokacije s tim imenom." : "Još nema lokacija."}</Box>
                  )}
                  {matches.map((l) => {
                    const current = value?.id === l.location_id;
                    const uses = locationUseLabel(l.uses);
                    return (
                      <Box
                        key={l.location_id}
                        component="button"
                        type="button"
                        role="option"
                        aria-selected={current}
                        onClick={() => pick(l)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          p: "10px",
                          border: 0,
                          borderRadius: "10px",
                          background: current ? tintSelected : "transparent",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          "&:hover": {background: color.line},
                        }}
                      >
                        <PlaceRoundedIcon aria-hidden sx={{flex: "none", fontSize: 20, color: color.navy}} />
                        <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                          <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
                            {l.name}
                          </Box>
                          {l.address && (
                            <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                              {l.address}
                            </Box>
                          )}
                        </Box>
                        <Box component="span" sx={{flex: "none", fontSize: 12, fontWeight: 600, color: color.muted}}>
                          {current ? "trenutno" : uses || "nije u upotrebi"}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
              <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", borderTop: `1px solid ${color.line}`, pt: "8px"}}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setAdding({...EMPTY_PLACE, name: exact ? "" : query.trim()})}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    p: "8px 10px",
                    border: 0,
                    borderRadius: "10px",
                    background: "transparent",
                    color: color.navy,
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 0,
                    "&:hover": {background: color.line},
                    "& svg": {fontSize: 20},
                  }}
                >
                  <AddRoundedIcon aria-hidden />
                  <Box component="span" sx={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                    {query.trim() && !exact ? `Nova lokacija „${query.trim()}”` : "Nova lokacija"}
                  </Box>
                </Box>
                {manage && (
                  <Box
                    component={Link}
                    href="/lokacije"
                    target="_blank"
                    sx={{display: "flex", alignItems: "center", gap: "4px", p: "8px 10px", color: color.muted, fontSize: 14, fontWeight: 600, textDecoration: "none", flex: "none", "& svg": {fontSize: 16}}}
                  >
                    Sve lokacije
                    <OpenInNewRoundedIcon aria-hidden />
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

const tintSelected = color.cream2;
