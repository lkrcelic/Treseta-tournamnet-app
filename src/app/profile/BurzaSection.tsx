"use client";

import {getAvailabilityAPI, setAvailabilityAPI} from "@/app/_fetchers/burza";
import {updatePhoneAPI} from "@/app/_fetchers/player/updatePhone";
import {invalidateBurza} from "@/app/_hooks/useBurza";
import {BurzaAvailability} from "@/app/_interfaces/burza";
import {isValidPhone, normalizePhone} from "@/app/_lib/phone";
import {color} from "@/app/_styles/tokens";
import {Callout, PhoneField, TogglePill} from "@/app/burza/ui/BurzaParts";
import {buttonBase, Card, CenteredSpinner, ErrorNote, SectionLabel, SwitchTrack} from "@/app/_ui/sp";
import BackHandRoundedIcon from "@mui/icons-material/BackHandRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {Box} from "@mui/material";
import React, {useCallback, useEffect, useRef, useState} from "react";

type Available = BurzaAvailability["available"];

// Profil · Burza igrača (Claude Design "Burza igrača · spojeno"): "Dostupan sam" with as what, and the optional
// phone number that new ads start with. Being available is the same ad as Burza's "Dostupan sam".
export default function BurzaSection({playerId}: {playerId: number}) {
  // the open availability ad (undefined until loaded) and the profile's number, saved apart so neither overwrites
  // the other
  const [available, setAvailable] = useState<Available | undefined>(undefined);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // as what the player is available while the switch is on (kept when it's switched off and on again)
  const [asSub, setAsSub] = useState(true);
  const [asPartner, setAsPartner] = useState(false);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  // leaving the field and pressing the button both save; this keeps it to one request
  const phoneRequest = useRef(false);

  const load = useCallback(() => {
    setError(null);
    getAvailabilityAPI()
      .then((a) => {
        setAvailable(a.available);
        setProfilePhone(a.phone);
        setPhone(a.phone ?? "");
        if (a.available) {
          setAsSub(a.available.as_substitute);
          setAsPartner(a.available.as_partner);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Burza se nije učitala."));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // the switch and the pills are saved at once; the screen goes back if the server refuses
  const save = async (on: boolean, sub: boolean, partner: boolean) => {
    const before = {available, asSub, asPartner};
    setAsSub(sub);
    setAsPartner(partner);
    if (on && !sub && !partner) return; // "Odaberi barem jedno." until one is picked
    setAvailable(on ? {id: available?.id ?? 0, note: available?.note ?? "", phone: available?.phone ?? null, as_substitute: sub, as_partner: partner} : null);
    setError(null);
    try {
      setAvailable((await setAvailabilityAPI({available: on, as_substitute: sub, as_partner: partner})).available);
      invalidateBurza();
    } catch (e) {
      setAvailable(before.available);
      setAsSub(before.asSub);
      setAsPartner(before.asPartner);
      setError(e instanceof Error ? e.message : "Dostupnost nije spremljena.");
    }
  };

  // saves the typed number (an empty field removes it); nothing when it's the profile's already
  const savePhone = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (available === undefined || phoneRequest.current) return;
    const value = phone.trim() ? normalizePhone(phone) : null;
    if ((phone.trim() && !value) || value === profilePhone) return;
    phoneRequest.current = true;
    setSavingPhone(true);
    setError(null);
    try {
      const saved = await updatePhoneAPI(playerId, value);
      setProfilePhone(saved);
      // shown as stored ("+385 91 234 5678"), unless the field was changed again meanwhile
      setPhone((typed) => ((typed.trim() ? normalizePhone(typed) : null) === saved ? saved ?? "" : typed));
      setPhoneSaved(true);
      invalidateBurza();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broj nije spremljen.");
    }
    phoneRequest.current = false;
    setSavingPhone(false);
  };

  if (available === undefined) {
    return (
      <Box component="section" aria-labelledby="burza" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
        <SectionLabel id="burza">Burza igrača</SectionLabel>
        <Card>{error ? <ErrorNote onRetry={load} sx={{m: "14px"}}>{error}</ErrorNote> : <CenteredSpinner />}</Card>
      </Box>
    );
  }

  const on = available != null;
  const noneChosen = on && !asSub && !asPartner;
  // the ad shows its own number, or the profile's
  const listed = !on || !!(available?.phone ?? profilePhone);
  const changed = (phone.trim() ? normalizePhone(phone) : null) !== profilePhone && (phone.trim() === "" || isValidPhone(phone));

  return (
    <Box component="section" aria-labelledby="burza" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id="burza">Burza igrača</SectionLabel>
      <Card sx={{overflow: "hidden"}}>
        <Box
          component="button"
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => save(!on, asSub || (!asSub && !asPartner), asPartner)}
          sx={{...buttonBase, width: "100%", minHeight: 72, display: "flex", alignItems: "center", gap: "12px", p: "12px 14px", textAlign: "left", boxSizing: "border-box"}}
        >
          <Box component="span" aria-hidden sx={{width: 40, height: 40, flex: "none", borderRadius: "12px", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
            <BackHandRoundedIcon />
          </Box>
          <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
            <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink}}>
              Dostupan sam
            </Box>
            <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
              Ekipe te vide u Burzi i mogu te nazvati.
            </Box>
          </Box>
          <SwitchTrack on={on} />
        </Box>
        {on && (
          <Box role="group" aria-labelledby="burza-as" sx={{p: "2px 14px 16px", display: "flex", flexDirection: "column", gap: "10px"}}>
            <Box id="burza-as" component="span" sx={{fontSize: 13, fontWeight: 600, color: color.inkSoft}}>
              Za što?
            </Box>
            <Box sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
              <TogglePill on={asSub} onClick={() => save(true, !asSub, asPartner)}>
                Zamjena
              </TogglePill>
              <TogglePill on={asPartner} onClick={() => save(true, asSub, !asPartner)}>
                Novi partner
              </TogglePill>
            </Box>
            {noneChosen && (
              <Box component="span" role="alert" sx={{fontSize: 13, color: "#A63B3D"}}>
                Odaberi barem jedno.
              </Box>
            )}
          </Box>
        )}
      </Card>
      <Box component="form" onSubmit={savePhone} noValidate sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
        <PhoneField
          label="Broj mobitela · neobavezno"
          required={false}
          value={phone}
          onChange={(v) => {
            setPhone(v);
            setPhoneSaved(false);
          }}
          // a new number is saved on leaving the field; removing one is left to the button
          onBlur={() => {
            if (isValidPhone(phone)) savePhone();
          }}
          profilePhone={null}
        />
        {(savingPhone || changed || phoneSaved) && (
          <Box sx={{display: "flex", alignItems: "center", gap: "12px", px: "6px", minHeight: 44}}>
            {savingPhone ? (
              <Box component="span" role="status" sx={{fontSize: 13, fontWeight: 600, color: color.muted}}>
                Sprema se…
              </Box>
            ) : changed ? (
              <Box
                component="button"
                type="submit"
                sx={{...buttonBase, height: 44, px: "18px", borderRadius: "14px", background: color.navy, color: "#FFFFFF", fontSize: 15, fontWeight: 600}}
              >
                {phone.trim() ? "Spremi broj" : "Ukloni broj"}
              </Box>
            ) : (
              <Box component="span" role="status" sx={{fontSize: 13, fontWeight: 600, color: color.green}}>
                Spremljeno.
              </Box>
            )}
          </Box>
        )}
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!listed && (
        <Callout icon={<InfoOutlinedIcon aria-hidden />} tone="warn">
          Dodaj broj da te ekipe mogu nazvati. Bez broja nisi na popisu dostupnih.
        </Callout>
      )}
    </Box>
  );
}
