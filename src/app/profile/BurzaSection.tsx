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
import React, {useCallback, useEffect, useState} from "react";

// Profil · Burza igrača (Claude Design "Burza igrača · spojeno"): "Dostupan sam" with as what, and the optional
// phone number that new ads start with. Being available is the same ad as Burza's "Dostupan sam".
export default function BurzaSection({playerId}: {playerId: number}) {
  const [data, setData] = useState<BurzaAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  // as what the player is available while the switch is on (kept when it's switched off and on again)
  const [asSub, setAsSub] = useState(true);
  const [asPartner, setAsPartner] = useState(false);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getAvailabilityAPI()
      .then((a) => {
        setData(a);
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
  const save = async (available: boolean, sub: boolean, partner: boolean) => {
    const before = {data, asSub, asPartner};
    setAsSub(sub);
    setAsPartner(partner);
    if (available && !sub && !partner) return; // "Odaberi barem jedno." until one is picked
    setData((d) => d && {...d, available: available ? {id: d.available?.id ?? 0, note: d.available?.note ?? "", phone: d.available?.phone ?? null, as_substitute: sub, as_partner: partner} : null});
    setError(null);
    try {
      setData(await setAvailabilityAPI({available, as_substitute: sub, as_partner: partner}));
      invalidateBurza();
    } catch (e) {
      setData(before.data);
      setAsSub(before.asSub);
      setAsPartner(before.asPartner);
      setError(e instanceof Error ? e.message : "Dostupnost nije spremljena.");
    }
  };

  const savePhone = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!data || savingPhone) return;
    const value = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !value) return;
    setSavingPhone(true);
    setError(null);
    try {
      const saved = await updatePhoneAPI(playerId, value);
      setData({...data, phone: saved});
      setPhone(saved ?? "");
      setPhoneSaved(true);
      invalidateBurza();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broj nije spremljen.");
    }
    setSavingPhone(false);
  };

  if (!data) {
    return (
      <Box component="section" aria-labelledby="burza" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
        <SectionLabel id="burza">Burza igrača</SectionLabel>
        <Card>{error ? <ErrorNote onRetry={load} sx={{m: "14px"}}>{error}</ErrorNote> : <CenteredSpinner />}</Card>
      </Box>
    );
  }

  const on = data.available != null;
  const noneChosen = on && !asSub && !asPartner;
  // the ad shows its own number, or the profile's
  const listed = !on || !!(data.available?.phone ?? data.phone);
  const changed = (phone.trim() ? normalizePhone(phone) : null) !== data.phone && (phone.trim() === "" || isValidPhone(phone));

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
          profilePhone={null}
        />
        {(changed || phoneSaved) && (
          <Box sx={{display: "flex", alignItems: "center", gap: "12px", px: "6px"}}>
            {changed ? (
              <Box
                component="button"
                type="submit"
                disabled={savingPhone}
                aria-busy={savingPhone || undefined}
                sx={{...buttonBase, height: 44, px: "18px", borderRadius: "14px", background: color.navy, color: "#FFFFFF", fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.5}}}
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
