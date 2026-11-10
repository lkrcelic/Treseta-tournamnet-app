"use client";

import {searchTeammatesAPI, signUpAPI, TeammateHit} from "@/app/_fetchers/tournament";
import {MyTeamOption, TournamentDetail} from "@/app/_interfaces/tournament";
import {nightLabel} from "@/app/_lib/nights";
import {BRAND} from "@/app/_lib/brand";
import {tournamentHref} from "@/app/_ui/tournaments/PlayerParts";
import {teamInitial} from "@/app/_lib/ui/profiles";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, ellipsis, ErrorNote, InitialsAvatar, PrimaryButton, SearchInput, Spinner, TextField} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";

// Prijava ekipe (Claude Design "Natjecanja" F1–F4): the player picks one of their teams (each with all its players: who
// of them plays is picked on Tko igra before every Kolo), or makes a new team with a teammate who has an account and
// signs it up in the same step. A teammate without an account gets an invitation link instead, by WhatsApp or the
// phone's sharing ("Gost i poziv" S1–S3). The search finds players by name or username (both public, #88).

type Props = {t: TournamentDetail; open: boolean; onClose: () => void; onDone: (status: "REGISTERED" | "WAITING", team: string) => void};

export default function SignUpSheet({t, open, onClose, onDone}: Props) {
  const [view, setView] = useState<"pick" | "new">("pick");
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = t.my_teams.filter((m) => !m.entry && !m.reason);
  useEffect(() => {
    if (!open) return;
    setView(t.my_teams.length === 0 ? "new" : "pick");
    setPicked(eligible.length === 1 ? eligible[0].team_id : null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (body: Parameters<typeof signUpAPI>[1]) => {
    setBusy(true);
    setError(null);
    try {
      const r = await signUpAPI(t.id, body);
      onDone(r.status, "new_team" in body ? body.new_team.name : (t.my_teams.find((m) => m.team_id === body.team_id)?.team_name ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekipa nije prijavljena.");
    }
    setBusy(false);
  };
  const eyebrow = `${t.name} · ${nightLabel(t.date)}`;
  const team = t.my_teams.find((m) => m.team_id === picked);

  if (view === "new") {
    return (
      <BottomSheet open={open} onClose={onClose} title="Nova ekipa" eyebrow={eyebrow} closable tall busy={busy}>
        {t.my_teams.length > 0 && (
          <Box component="button" type="button" onClick={() => setView("pick")} sx={{...buttonBase, alignSelf: "flex-start", height: 36, display: "flex", alignItems: "center", gap: "2px", pr: "10px", borderRadius: "10px", color: color.navy, fontSize: 14, fontWeight: 700, "& svg": {fontSize: 22}}}>
            <ChevronLeftRoundedIcon aria-hidden />
            Moje ekipe
          </Box>
        )}
        <NewTeamForm
          me={t.my_teams.flatMap((m) => m.players).find((p) => p.me) ?? null}
          tournament={t}
          full={t.max_teams != null && t.teams >= t.max_teams}
          busy={busy}
          error={error}
          onSubmit={(name, partnerId) => submit({new_team: {name, partner_id: partnerId}})}
        />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Koju ekipu prijavljuješ?" eyebrow={eyebrow} closable tall busy={busy}>
      <Box component="ul" aria-label="Moje ekipe" sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", listStyle: "none", m: 0, p: "2px", display: "flex", flexDirection: "column", gap: "10px", "& > li": {flex: "none"}}}>
        {t.my_teams.map((m) => (
          <TeamOption key={m.team_id} m={m} on={m.team_id === picked} onPick={() => setPicked(m.team_id)} />
        ))}
        <Box component="li">
          <Box
            component="button"
            type="button"
            onClick={() => setView("new")}
            sx={{...buttonBase, width: "100%", height: 56, borderRadius: "18px", border: `1.5px dashed ${tint.navy[35]}`, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: 16, fontWeight: 700, "& svg": {fontSize: 22}}}
          >
            <AddRoundedIcon aria-hidden />
            Nova ekipa
          </Box>
        </Box>
        <Box component="li" sx={{fontSize: 13, color: color.muted, textAlign: "center", pb: "4px"}}>
          {t.my_teams.some((m) => m.ban_until != null) ? "Zabranjena ekipa se ne može odabrati. Za pitanja se javite organizatoru." : "Prikazane su samo ekipe u kojima igraš."}
        </Box>
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <PrimaryButton icon={<HowToRegRoundedIcon />} disabled={!team || !!team.reason || !!team.entry} loading={busy} onClick={() => team && submit({team_id: team.team_id})} sx={{flex: "none"}}>
        {team ? `Prijavi ekipu ${team.team_name}` : "Odaberi ekipu"}
      </PrimaryButton>
    </BottomSheet>
  );
}

// One of the player's teams: its letter and name, a radio, and every player of it; one that can't sign up says why
function TeamOption({m, on, onPick}: {m: MyTeamOption; on: boolean; onPick: () => void}) {
  const off = !!m.reason || !!m.entry;
  const why = m.entry === "REGISTERED" ? "Već je prijavljena." : m.entry === "WAITING" ? "Već je na listi čekanja." : m.reason;
  return (
    <Box component="li">
      <Box
        component="button"
        type="button"
        role="radio"
        aria-checked={on}
        aria-disabled={off || undefined}
        onClick={off ? undefined : onPick}
        sx={{
          ...buttonBase,
          width: "100%",
          p: "14px",
          borderRadius: "18px",
          background: on ? color.cream2 : color.white,
          border: `1.5px solid ${on ? color.navy : color.line}`,
          boxShadow: on ? shadow.card : "none",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          textAlign: "left",
          opacity: off ? 0.6 : 1,
          cursor: off ? "not-allowed" : "pointer",
        }}
      >
        <Box sx={{display: "flex", alignItems: "center", gap: "12px", width: "100%"}}>
          <InitialsAvatar name={m.team_name} letters={teamInitial(m.team_name)} src={m.photo_url} size={40} variant={on ? "navy" : "paper"} />
          <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, ...ellipsis}}>
            {m.team_name}
          </Box>
          {m.ban_until != null ? (
            <BlockRoundedIcon aria-label="Zabrana prijava" sx={{color: color.red}} />
          ) : (
            !off && (on ? <RadioButtonCheckedRoundedIcon sx={{color: color.navy}} /> : <RadioButtonUncheckedRoundedIcon sx={{color: color.faint}} />)
          )}
        </Box>
        <Box sx={{width: "100%", display: "flex", flexDirection: "column", gap: "6px", pl: "2px"}}>
          <Box component="span" sx={{fontSize: 11.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
            Igrači
          </Box>
          {m.players.map((p) => (
            <Box key={p.id} sx={{display: "flex", alignItems: "center", gap: "8px", fontSize: 15, minWidth: 0}}>
              <InitialsAvatar name={p.name} src={p.photo_url} size={28} sx={{fontSize: 10}} />
              <Box component="span" sx={ellipsis}>
                {p.name}
              </Box>
              {p.me && (
                <Box component="span" sx={{flex: "none", color: color.muted}}>
                  (ti)
                </Box>
              )}
            </Box>
          ))}
        </Box>
        {why && (
          <Box component="span" sx={{fontSize: 13, fontWeight: 600, color: m.reason ? color.red : color.muted}}>
            {why}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// The invitation: the tournament's page, which anyone may open, with a line to the teammate
function inviteText(teammate: string, t: Pick<TournamentDetail, "id" | "name">): string {
  const url = `${window.location.origin}${tournamentHref(t.id)}`;
  return `${teammate ? `${teammate}, ` : ""}napravi račun u ${BRAND.name.replace("Liga", "Ligi")} pa se zajedno prijavimo na turnir ${t.name}: ${url}`;
}

// Ostalo: the phone's sharing, or the link copied where the browser can't share
async function shareInvite(text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({title: BRAND.name, text});
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (e) {
    return e instanceof Error && e.name === "AbortError" ? "cancelled" : "failed";
  }
}

// F2–F4 ("Gost i poziv" S1–S3): the player (fixed), the teammate picked by searching for a name, the team's name,
// Kreiraj ekipu i prijavi. Before a name is typed, "S kim igraš?" with the rules and the invitation; when nobody is
// found, the navy "Nema računa" card with it; once it is sent, "Poziv je poslan".
function NewTeamForm({
  me,
  tournament,
  full,
  busy,
  error,
  onSubmit,
}: {
  me: {name: string; photo_url: string | null} | null;
  tournament: Pick<TournamentDetail, "id" | "name">;
  full: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (name: string, partnerId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TeammateHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [partner, setPartner] = useState<TeammateHit | null>(null);
  const [name, setName] = useState("");
  // the invitation went out (WhatsApp opened or the phone shared it), or the link was copied; null: not yet
  const [sent, setSent] = useState<"sent" | "copied" | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    setSent(null);
    setInviteError(null);
    if (partner || q.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchTeammatesAPI(q)
        .then((h) => !cancelled && setHits(h))
        .catch(() => !cancelled && setHits([]))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, partner]);

  const missing = hits != null && hits.length === 0 && query.trim().length >= 3 && !loading;
  const ready = partner != null && name.trim().length > 0;
  const hint = !partner ? "Oba igrača moraju imati račun." : !name.trim() ? "Upiši ime ekipe." : null;
  const slot = {display: "flex", alignItems: "center", gap: "12px", minHeight: 56, px: "14px"} as const;
  const teammate = missing ? (query.trim().split(/\s+/)[0] ?? "") : "";

  const viaWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText(teammate, tournament))}`, "_blank", "noopener,noreferrer");
    setSent("sent");
  };
  const viaShare = async () => {
    const r = await shareInvite(inviteText(teammate, tournament));
    if (r === "shared") setSent("sent");
    else if (r === "copied") setSent("copied");
    else if (r === "failed") setInviteError("Poveznica se nije mogla podijeliti.");
  };
  const invite = {onWhatsApp: viaWhatsApp, onShare: viaShare};

  return (
    <>
      {/* the column scrolls; its parts keep their height (a long list of hits would squeeze the players' box) */}
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "14px", p: "2px", "& > *": {flex: "none"}}}>
        <Box sx={{borderRadius: "20px", background: color.white, border: `1px solid ${color.line}`, overflow: "hidden"}}>
          <Box sx={{...slot, minHeight: 60, borderBottom: `1px solid ${color.line}`}}>
            <Box component="span" sx={{width: 18, fontFamily: font.display, fontWeight: 800, color: color.muted}}>
              1
            </Box>
            {me && <InitialsAvatar name={me.name} src={me.photo_url} size={36} sx={{fontSize: 12}} />}
            <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
              {me ? me.name : "Ti"}
            </Box>
            {me && (
              <Box component="span" sx={{flex: "none", color: color.muted}}>
                (ti)
              </Box>
            )}
          </Box>
          {partner ? (
            <Box sx={slot}>
              <Box component="span" sx={{width: 18, fontFamily: font.display, fontWeight: 800, color: color.muted}}>
                2
              </Box>
              <InitialsAvatar name={partner.name} src={partner.photo_url} size={36} sx={{fontSize: 12}} />
              <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, ...ellipsis}}>
                {partner.name}
              </Box>
              <Box component="button" type="button" aria-label={`Makni ${partner.name}`} onClick={() => setPartner(null)} sx={{...buttonBase, width: 40, height: 40, borderRadius: "50%", color: color.muted, display: "flex", alignItems: "center", justifyContent: "center", "&:hover": {background: color.paper}}}>
                <CloseRoundedIcon />
              </Box>
            </Box>
          ) : (
            <Box sx={{display: "flex", alignItems: "center", gap: "10px", p: "8px 10px 12px 14px"}}>
              <Box component="span" sx={{width: 18, fontFamily: font.display, fontWeight: 800, color: color.muted}}>
                2
              </Box>
              <SearchInput variant="paper" height={50} placeholder="Ime ili korisničko ime suigrača" aria-label="Traži suigrača" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} sx={{flex: 1}} />
            </Box>
          )}
        </Box>
        {!partner && !query.trim() && <TeammateRules {...invite} />}
        {!partner && hits != null && hits.length > 0 && (
          <Box component="ul" aria-label="Igrači u aplikaciji" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "16px", background: color.white, border: `1px solid ${color.line}`, overflow: "hidden"}}>
            {hits.map((h, i) => (
              <Box component="li" key={h.id} sx={{...slot, borderTop: i ? `1px solid ${color.line}` : "none"}}>
                <InitialsAvatar name={h.name} src={h.photo_url} size={34} sx={{fontSize: 12}} />
                {/* the name and, under it, the handle (#88) */}
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                    {h.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    @{h.username}
                  </Box>
                </Box>
                <Box component="button" type="button" onClick={() => setPartner(h)} sx={{...buttonBase, height: 40, px: "14px", borderRadius: "12px", background: color.navy, color: color.white, fontSize: 14, fontWeight: 700}}>
                  Odaberi
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {!partner && loading && (
          <Box sx={{display: "flex", alignItems: "center", gap: "10px", fontSize: 14, color: color.muted, px: "4px"}}>
            <Spinner size={18} /> Tražim…
          </Box>
        )}
        {!partner && missing && !sent && <NoAccountCard query={query.trim()} {...invite} />}
        {!partner && sent && <InviteSentCard copied={sent === "copied"} />}
        {!partner && inviteError && <ErrorNote>{inviteError}</ErrorNote>}
        {partner && <TextField label="Ime ekipe" placeholder="npr. Kvartovski" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}
        {full && <Box sx={{fontSize: 13, color: color.ink2}}>Turnir je pun: nova ekipa ide na listu čekanja.</Box>}
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "6px"}}>
        <PrimaryButton icon={<HowToRegRoundedIcon />} disabled={!ready} loading={busy} onClick={() => partner && onSubmit(name.trim(), partner.id)}>
          Kreiraj ekipu i prijavi
        </PrimaryButton>
        {hint && (
          <Box component="span" sx={{fontSize: 13, color: color.muted, textAlign: "center"}}>
            {hint}
          </Box>
        )}
      </Box>
    </>
  );
}

type InviteActions = {onWhatsApp: () => void; onShare: () => void};

// WhatsApp · Ostalo: on white (S1) or on the navy card (S2)
function InviteButtons({onWhatsApp, onShare, onNavy = false}: InviteActions & {onNavy?: boolean}) {
  const button = {...buttonBase, height: onNavy ? 52 : 48, borderRadius: onNavy ? "15px" : "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontSize: 15, fontWeight: 700, "& svg": {fontSize: 20}} as const;
  return (
    <Box sx={{display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "8px"}}>
      <Box component="button" type="button" onClick={onWhatsApp} sx={{...button, background: onNavy ? color.white : color.navy, color: onNavy ? color.navy : color.white}}>
        <ChatRoundedIcon aria-hidden />
        WhatsApp
      </Box>
      <Box component="button" type="button" onClick={onShare} sx={{...button, background: onNavy ? tint.creamOnNavy[16] : color.paper, color: onNavy ? color.white : color.navy}}>
        <ShareRoundedIcon aria-hidden />
        Ostalo
      </Box>
    </Box>
  );
}

// S1: before a name is typed, what to type and that the teammate needs an account, and the invitation right away
function TeammateRules(invite: InviteActions) {
  const rule = {display: "flex", alignItems: "flex-start", gap: "10px", fontSize: 14.5, lineHeight: 1.4, color: color.ink2} as const;
  const icon = {width: 28, height: 28, flex: "none", borderRadius: "9px", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 17}} as const;
  return (
    <Box sx={{borderRadius: "22px", background: color.white, border: `1px solid ${color.line}`, p: "18px", display: "flex", flexDirection: "column", gap: "14px"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box component="span" sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
          Igrač 2
        </Box>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1.1}}>
          S kim igraš?
        </Box>
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
        <Box sx={rule}>
          <Box component="span" aria-hidden sx={icon}>
            <SearchRoundedIcon />
          </Box>
          Upiši ime ili korisničko ime suigrača.
        </Box>
        <Box sx={rule}>
          <Box component="span" aria-hidden sx={icon}>
            <VerifiedUserRoundedIcon />
          </Box>
          Suigrač mora imati račun u {BRAND.name.replace("Liga", "Ligi")}.
        </Box>
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "8px", pt: "14px", borderTop: `1px solid ${color.line}`}}>
        <Box component="span" sx={{fontSize: 14, fontWeight: 700}}>
          Suigrač nema račun? Pozovi ga odmah.
        </Box>
        <InviteButtons {...invite} />
      </Box>
    </Box>
  );
}

// S2: nobody by that name has an account: invite them
function NoAccountCard({query, ...invite}: InviteActions & {query: string}) {
  return (
    <Box role="status" sx={{borderRadius: "24px", background: color.navy, color: color.white, p: "20px 18px 18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.hero}}>
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        <Box component="span" aria-hidden sx={{width: 48, height: 48, flex: "none", borderRadius: "15px", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 28}}}>
          <PersonAddRoundedIcon />
        </Box>
        <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0}}>
          <Box component="span" sx={{fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream}}>
            Nema računa
          </Box>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1.1, overflowWrap: "anywhere"}}>
            „{query}” još nije u {BRAND.name.replace("Liga", "Ligi")}
          </Box>
        </Box>
      </Box>
      <Box component="span" sx={{fontSize: 15, lineHeight: 1.45, color: color.cream, textWrap: "pretty"}}>
        Pozovi suigrača. Kad napravi račun, potraži ga ponovo i prijavite ekipu.
      </Box>
      <InviteButtons {...invite} onNavy />
    </Box>
  );
}

// S3: the invitation went out (or its link was copied)
function InviteSentCard({copied}: {copied: boolean}) {
  return (
    <Box role="status" sx={{borderRadius: "24px", background: color.white, p: "18px", display: "flex", alignItems: "center", gap: "12px", boxShadow: `inset 0 0 0 1.5px ${tint.navy[18]}`}}>
      <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "14px", background: tint.green[13], color: color.green, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
        <MarkEmailReadRoundedIcon />
      </Box>
      <Box sx={{flex: 1, display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
          {copied ? "Poveznica je kopirana" : "Poziv je poslan"}
        </Box>
        <Box component="span" sx={{fontSize: 13.5, lineHeight: 1.4, color: color.ink2}}>
          {copied ? "Pošalji je suigraču. Kad se registrira, potraži ga ovdje ponovo." : "Kad se suigrač registrira, potraži ga ovdje ponovo."}
        </Box>
      </Box>
    </Box>
  );
}
