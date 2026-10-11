"use client";

import {closeBurzaPostAPI} from "@/app/_fetchers/burza";
import {invalidateBurza} from "@/app/_hooks/useBurza";
import {LeagueOption} from "@/app/_hooks/useLeagues";
import {BurzaCreateRequest, BurzaKind, BurzaPost, MyLeague} from "@/app/_interfaces/burza";
import {leagueDateString} from "@/app/_lib/dates";
import {nextNightIndex, nightLabel} from "@/app/_lib/nights";
import {isValidPhone} from "@/app/_lib/phone";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, Card, cardSx, EmptyState, ErrorNote, InitialsAvatar, PrimaryButton} from "@/app/_ui/sp";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";
import {Callout, ChoicePill, NoteField, OutlineAction, PhoneField, PostCard, PublicNote, shareLink, shareText, Step, TextArea, TogglePill} from "./BurzaParts";

// The three "Novi oglas" forms (Claude Design "Nađi zamjenu · obrazac", "Tražim partnera", "Dostupan sam") and
// "Oglas je objavljen". Each form keeps its own fields and hands the finished ad to onPublish.

// how many of a league's next nights "Večer" offers
const NIGHT_CHOICES = 6;

export type PhoneState = {value: string; save: boolean; profile: string | null};

type FormProps = {
  phone: PhoneState;
  setPhone: (p: PhoneState) => void;
  submitting: boolean;
  error: string | null;
  onPublish: (req: BurzaCreateRequest) => void;
  // lays out the form and its publish button (at the bottom of the phone screen, after the form on the desktop)
  layout: (body: React.ReactNode, action?: React.ReactNode) => React.ReactNode;
};

function Phone({phone, setPhone}: Pick<FormProps, "phone" | "setPhone">) {
  return (
    <PhoneField
      value={phone.value}
      onChange={(value) => setPhone({...phone, value})}
      profilePhone={phone.profile}
      save={phone.save}
      onSave={(save) => setPhone({...phone, save})}
    />
  );
}

// the profile is offered the number only when it's a valid new one
const savePhone = (p: PhoneState) => p.save && isValidPhone(p.value) && p.value !== p.profile;

function PublishButton({disabled, submitting, onClick}: {disabled: boolean; submitting: boolean; onClick: () => void}) {
  return (
    <PrimaryButton icon={<CampaignRoundedIcon />} disabled={disabled} loading={submitting} onClick={onClick} sx={{fontSize: 17}}>
      Objavi oglas
    </PrimaryButton>
  );
}

// Trebam zamjenu: league → one of its next nights → who can't play → phone → note
export function SubstituteForm({leagues, preset, ...props}: FormProps & {leagues: MyLeague[]; preset: {league?: number; night?: string}}) {
  const today = leagueDateString();
  // the leagues where the player's team is active and has nights left
  const options = leagues.filter((l) => l.active && nextNightIndex(l.nights, today) >= 0);
  const [pick, setPick] = useState(() => Math.max(0, options.findIndex((l) => l.league_id === preset.league)));
  const league = options[pick] ?? null;
  const nights = league ? league.nights.slice(nextNightIndex(league.nights, today)).slice(0, NIGHT_CHOICES) : [];
  const [night, setNight] = useState<string | null>(() => (preset.night && nights.includes(preset.night) ? preset.night : nights[0] ?? null));
  // teammates first, the player last ("Ja · ...")
  const players = league ? [...league.players].sort((a, b) => Number(a.me) - Number(b.me)) : [];
  const [out, setOut] = useState<number | null>(players[0]?.id ?? null);
  const [note, setNote] = useState("");

  if (!league) {
    return props.layout(
      <Card>
        <EmptyState>Zamjenu možeš tražiti kad tvoja ekipa igra u ligi koja ima još večeri. Admin dodaje ekipe i večeri lige.</EmptyState>
      </Card>
    );
  }

  const pickLeague = (i: number) => {
    const l = options[i];
    setPick(i);
    const first = l.nights[nextNightIndex(l.nights, today)] ?? null;
    setNight(first);
    setOut([...l.players].sort((a, b) => Number(a.me) - Number(b.me))[0]?.id ?? null);
  };
  const sameLeagueTwice = (l: MyLeague) => options.filter((o) => o.league_id === l.league_id).length > 1;
  const valid = night != null && out != null && isValidPhone(props.phone.value);
  const publish = () =>
    valid &&
    props.onPublish({
      kind: "SUBSTITUTE",
      league_id: league.league_id,
      team_id: league.team_id,
      night: night!,
      out_player_id: out!,
      phone: props.phone.value,
      note: note.trim(),
      save_phone: savePhone(props.phone),
    });

  return props.layout(
    <>
      <Step n={1} id="step-league">
        Liga
      </Step>
      <Box role="radiogroup" aria-labelledby="step-league" sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
        {options.map((l, i) => (
          <ChoicePill key={`${l.league_id}-${l.team_id}`} on={i === pick} onClick={() => pickLeague(i)}>
            {sameLeagueTwice(l) ? `${l.league_name} · ${l.team_name}` : l.league_name}
          </ChoicePill>
        ))}
      </Box>
      <Step n={2} id="step-night">
        Večer
      </Step>
      <Box role="radiogroup" aria-labelledby="step-night" sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
        {nights.map((n) => (
          <ChoicePill key={n} on={n === night} onClick={() => setNight(n)}>
            {n === today ? `Večeras · ${nightLabel(n)}` : nightLabel(n)}
          </ChoicePill>
        ))}
      </Box>
      <Step n={3} id="step-out">
        Tko ne može?
      </Step>
      <Box role="radiogroup" aria-labelledby="step-out" sx={{...cardSx, overflow: "hidden"}}>
        {players.map((p, i) => {
          const on = p.id === out;
          return (
            <Box
              key={p.id}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setOut(p.id)}
              sx={{...buttonBase, width: "100%", minHeight: 68, display: "flex", alignItems: "center", gap: "12px", p: "10px 14px", borderBottom: i < players.length - 1 ? `1px solid ${color.line}` : "none", background: on ? color.mine : color.card, textAlign: "left", transition: "background 160ms ease"}}
            >
              <InitialsAvatar name={p.name} size={40} variant={p.me ? "navy" : "cream"} sx={{fontSize: 14, ...(p.me ? {color: "#FFFFFF"} : {})}} />
              <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink}}>
                  {p.me ? `Ja · ${p.name}` : p.name}
                </Box>
                <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                  Rejting {p.rating}
                </Box>
              </Box>
              <RadioDot on={on} />
            </Box>
          );
        })}
      </Box>
      <Step n={4}>Kontakt</Step>
      <Phone phone={props.phone} setPhone={props.setPhone} />
      <NoteField value={note} onChange={setNote} placeholder="Npr. u koliko sati počinjete" />
      <PublicNote />
      {props.error && <ErrorNote>{props.error}</ErrorNote>}
    </>,
    <PublishButton disabled={!valid} submitting={props.submitting} onClick={publish} />
  );
}

function RadioDot({on}: {on: boolean}) {
  return (
    <Box component="span" aria-hidden sx={{width: 24, height: 24, flex: "none", boxSizing: "border-box", borderRadius: "50%", border: `2px solid ${on ? color.navy : "rgba(60,74,103,.3)"}`, display: "flex", alignItems: "center", justifyContent: "center"}}>
      <Box component="span" sx={{width: 12, height: 12, borderRadius: "50%", background: on ? color.navy : "transparent", transition: "background 160ms ease"}} />
    </Box>
  );
}

// Tražim partnera: a running league → the ad's text → phone; the player's rating goes with it
export function PartnerForm({leagues, preset, me, ...props}: FormProps & {leagues: LeagueOption[]; preset: {league?: number}; me: {name: string; rating: number | null}}) {
  const today = leagueDateString();
  // leagues whose season isn't over
  const options = leagues.filter((l) => !l.endDate || l.endDate >= today);
  // until one is picked: the given league, the one being played now, or the first (the list may still be loading)
  const [picked, setLeagueId] = useState<number | null>(null);
  const leagueId = picked ?? options.find((l) => l.id === preset.league)?.id ?? options.find((l) => l.active)?.id ?? options[0]?.id ?? null;
  const [text, setText] = useState("");

  if (!options.length) {
    return props.layout(
      <Card>
        <EmptyState>Trenutno nema lige koja traje.</EmptyState>
      </Card>
    );
  }
  const valid = leagueId != null && isValidPhone(props.phone.value);
  const publish = () =>
    valid && props.onPublish({kind: "PARTNER", league_id: leagueId!, phone: props.phone.value, note: text.trim(), save_phone: savePhone(props.phone)});

  return props.layout(
    <>
      <Step n={1} id="step-league">
        Za koju ligu?
      </Step>
      <Box role="radiogroup" aria-labelledby="step-league" sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
        {options.map((l) => (
          <ChoicePill key={l.id} on={l.id === leagueId} onClick={() => setLeagueId(l.id)}>
            {l.name}
          </ChoicePill>
        ))}
      </Box>
      <Step n={2} id="step-text">
        Oglas
      </Step>
      <TextArea labelledBy="step-text" value={text} onChange={setText} placeholder="Npr. koliko dugo igraš, kad si slobodan" height={92} maxLength={1000} />
      <Step n={3}>Kontakt</Step>
      <Phone phone={props.phone} setPhone={props.setPhone} />
      <Card sx={{p: "12px 14px", display: "flex", alignItems: "center", gap: "12px"}}>
        <InitialsAvatar name={me.name} size={40} variant="navy" sx={{fontSize: 14, color: "#FFFFFF"}} />
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 15, fontWeight: 600}}>
            Uz oglas se vidi tvoj rejting
          </Box>
          <Box component="span" sx={{fontSize: 13, color: color.muted}}>
            {me.name} · {me.rating ?? "još ga nemaš"}
          </Box>
        </Box>
      </Card>
      <PublicNote />
      {props.error && <ErrorNote>{props.error}</ErrorNote>}
    </>,
    <PublishButton disabled={!valid} submitting={props.submitting} onClick={publish} />
  );
}

// Dostupan sam: as a substitute, a new partner or both → phone → note
export function AvailableForm({initial, ...props}: FormProps & {initial: {as_substitute: boolean; as_partner: boolean; note: string} | null}) {
  const [asSub, setAsSub] = useState(initial?.as_substitute ?? true);
  const [asPartner, setAsPartner] = useState(initial?.as_partner ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const valid = (asSub || asPartner) && isValidPhone(props.phone.value);
  const publish = () =>
    valid &&
    props.onPublish({kind: "AVAILABLE", as_substitute: asSub, as_partner: asPartner, phone: props.phone.value, note: note.trim(), save_phone: savePhone(props.phone)});

  return props.layout(
    <>
      <Step n={1} id="step-as">
        Za što si dostupan?
      </Step>
      <Box role="group" aria-labelledby="step-as" sx={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
        <TogglePill on={asSub} onClick={() => setAsSub(!asSub)}>
          Zamjena
        </TogglePill>
        <TogglePill on={asPartner} onClick={() => setAsPartner(!asPartner)}>
          Novi partner
        </TogglePill>
      </Box>
      {!asSub && !asPartner && (
        <Box role="alert" sx={{px: "6px", fontSize: 13, color: "#A63B3D"}}>
          Odaberi barem jedno.
        </Box>
      )}
      <Step n={2}>Kontakt</Step>
      <Phone phone={props.phone} setPhone={props.setPhone} />
      <NoteField value={note} onChange={setNote} placeholder="Npr. mogu bilo koji dan" />
      <Callout icon={<PersonOutlineRoundedIcon aria-hidden />} tone="plain">
        Isto možeš uključiti i u profilu. Dok si dostupan, oglas stoji u Burzi.
      </Callout>
      <PublicNote />
      {props.error && <ErrorNote>{props.error}</ErrorNote>}
    </>,
    <PublishButton disabled={!valid} submitting={props.submitting} onClick={publish} />
  );
}

const CLOSES: Record<BurzaKind, string> = {
  SUBSTITUTE: "Ovako ga vide drugi. Zatvori ga kad nađeš igrača, a sam se zatvara kad prođe ta večer.",
  PARTNER: "Ovako ga vide drugi. Zatvori ga kad nađeš partnera, a sam se zatvara kad liga završi.",
  AVAILABLE: "Ovako ga vide drugi. Zatvori ga kad više nisi dostupan.",
};

// Oglas je objavljen: the ad as others see it, close it, share it or finish
export function Published({
  post,
  savedPhone,
  onDone,
  layout,
}: {
  post: BurzaPost;
  savedPhone: boolean;
  onDone: () => void;
  layout: (body: React.ReactNode, action?: React.ReactNode) => React.ReactNode;
}) {
  const [current, setCurrent] = useState(post);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const close = async () => {
    setClosing(true);
    setError(null);
    try {
      setCurrent(await closeBurzaPostAPI(current.id));
      invalidateBurza();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oglas nije zatvoren.");
    }
    setClosing(false);
  };
  const share = async () => {
    const outcome = await shareLink(`${window.location.origin}/burza/${current.id}`, "Burza igrača", shareText(current));
    if (outcome === "copied") setNotice("Poveznica je kopirana.");
  };

  return layout(
    <>
      <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", p: "22px 8px 6px", textAlign: "center"}}>
        <Box component="span" aria-hidden sx={{width: 72, height: 72, borderRadius: "50%", background: "rgba(56,102,65,.14)", display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 44, color: color.green}}}>
          <CheckCircleRoundedIcon />
        </Box>
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em"}}>
          {current.closed ? "Oglas je zatvoren" : "Oglas je objavljen"}
        </Box>
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.45, color: color.inkSoft, maxWidth: 300}}>
          {current.closed ? "Više se ne vidi u Burzi." : CLOSES[current.kind]}
        </Box>
      </Box>
      <PostCard
        post={current}
        ago="upravo"
        footer={
          current.phone && (
            <Box sx={{display: "flex", alignItems: "center", gap: "8px", pt: "8px", borderTop: `1px solid ${color.line}`, fontSize: 15, fontWeight: 700, "& svg": {fontSize: 20, color: color.navy}}}>
              <CallRoundedIcon aria-hidden />
              {current.phone}
            </Box>
          )
        }
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!current.closed && (
        <Box
          component="button"
          type="button"
          onClick={close}
          disabled={closing}
          aria-busy={closing || undefined}
          sx={{...buttonBase, alignSelf: "center", height: 44, px: "14px", borderRadius: "12px", color: "#A63B3D", display: "flex", alignItems: "center", gap: "6px", fontSize: 15, fontWeight: 600, "&:hover": {background: "rgba(188,71,73,.08)"}, "&:disabled": {opacity: 0.5}, "& svg": {fontSize: 20}}}
        >
          <CancelRoundedIcon aria-hidden />
          Zatvori oglas
        </Box>
      )}
      {savedPhone && (
        <Callout icon={<CheckRoundedIcon aria-hidden />} tone="ok">
          Broj je spremljen na profil. Idući put je već upisan.
        </Callout>
      )}
      {notice && (
        <Callout icon={<InfoOutlinedIcon aria-hidden />} tone="plain">
          {notice}
        </Callout>
      )}
      <PublicNote />
    </>,
    <Box sx={{flex: "none", display: "flex", gap: "10px"}}>
      {!current.closed && (
        <OutlineAction icon={<ShareRoundedIcon />} onClick={share} sx={{flex: 1, width: "auto", minWidth: 0}}>
          Podijeli
        </OutlineAction>
      )}
      <PrimaryButton onClick={onDone} sx={{flex: 1, width: "auto", minWidth: 0, fontSize: 17}}>
        Gotovo
      </PrimaryButton>
    </Box>
  );
}
