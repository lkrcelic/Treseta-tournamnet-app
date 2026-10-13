"use client";

import {getPlayerByIdAPI, PlayerById} from "@/app/_fetchers/player/getById";
import {updateBirthDateAPI} from "@/app/_fetchers/player/updateBirthDate";
import {updateSmokerAPI} from "@/app/_fetchers/player/updateSmoker";
import {updateUsernameAPI} from "@/app/_fetchers/player/updateUsername";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLogout from "@/app/_hooks/useLogout";
import useMyTeams from "@/app/_hooks/useMyTeams";
import useNavStack from "@/app/_hooks/useNavStack";
import {useMyRating} from "@/app/_hooks/useRatings";
import {fullName} from "@/app/_lib/players/names";
import {leagueDateString} from "@/app/_lib/dates";
import {ratingPath} from "@/app/_lib/ui/ratings";
import {displayDate} from "@/app/_lib/ui/text";
import {normalizeUsername, USERNAME_MAX, usernameError} from "@/app/_lib/validation/username";
import useAuthStore from "@/app/_store/authStore";
import {color, tint} from "@/app/_styles/tokens";
import {HeroRating, ProfileHero} from "@/app/_ui/profiles/ProfileHero";
import {TeamCards} from "@/app/_ui/profiles/TeamCards";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import {
  buttonBase,
  Card,
  dateInputFix,
  DesktopShell,
  ellipsis,
  ErrorNote,
  PrimaryButton,
  Screen,
  ScrollArea,
  SectionLabel,
  SwitchTrack,
  tabular,
  TextButton,
} from "@/app/_ui/sp";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import {Box, Skeleton} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useCallback, useEffect, useState} from "react";

export default function ProfilePage() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const {teams, loading: teamsLoading} = useMyTeams();
  const {me: myRating, total: ratedPlayers, loaded: ratingsLoaded} = useMyRating();
  const {logout, loggingOut} = useLogout();
  // the name a Team page opened from "Stranica ekipe ›" shows on its back pill
  useNavStack("Moj profil");
  const [player, setPlayer] = useState<PlayerById | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user?.id) return;
    setError(null);
    getPlayerByIdAPI(user.id)
      .then(setPlayer)
      .catch(() => setError("Profil nije moguće učitati."));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const name = player ? fullName(player) : "";
  const details = [
    {k: "Email", v: player?.email},
    {k: "Ime", v: player?.first_name},
    {k: "Prezime", v: player?.last_name},
  ];

  // my rating as Rejting shows it; before my first rated round I'm not on Rejting: my stored rating, still Privremeno,
  // and the strip opens the Rejting list
  const rating: HeroRating | null = myRating
    ? {...myRating, total: ratedPlayers}
    : ratingsLoaded || player
      ? {rating: player?.rating ?? null, change: null, rounds: 0, rank: null, total: ratedPlayers, provisional: ratingsLoaded}
      : null;
  const hero = (desktop: boolean) => (
    <ProfileHero
      desktop={desktop}
      name={player?.username ?? user?.username ?? null}
      sub={player ? name : null}
      avatarName={name || user?.username || ""}
      rating={rating}
      ratingHref={myRating ? ratingPath(myRating.id) : "/ratings"}
    />
  );

  const detailsBlock = (desktop: boolean) => (
    <Box component="section" aria-labelledby="details" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id="details">Podaci</SectionLabel>
      <Card component="dl" sx={{m: 0, overflow: "hidden"}}>
        <UsernameRow
          value={player?.username ?? null}
          desktop={desktop}
          onSave={async (username) => {
            if (!player) return;
            const saved = await updateUsernameAPI(player.id, username);
            setPlayer({...player, username: saved});
            // the nav and everything else reading the logged-in player show the new name without logging in again
            if (user?.id === player.id) setUser({...user, username: saved});
          }}
        />
        {details.map((d) => (
          <Box
            key={d.k}
            sx={{height: desktop ? 56 : 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", px: desktop ? "18px" : "16px", borderBottom: `1px solid ${color.line}`}}
          >
            <Box component="dt" sx={{flex: "none", whiteSpace: "nowrap", fontSize: 15, color: color.muted}}>
              {d.k}
            </Box>
            <Box component="dd" sx={{m: 0, minWidth: 0, textAlign: "right", fontSize: 15, fontWeight: 600, ...ellipsis}}>
              {player ? d.v || "—" : <Skeleton width={110} />}
            </Box>
          </Box>
        ))}
        {player && (
          <BirthDateRow
            value={player.birth_date ?? null}
            desktop={desktop}
            onSave={async (birthDate) => {
              await updateBirthDateAPI(player.id, birthDate);
              setPlayer({...player, birth_date: birthDate});
              // a Google player who hadn't given it yet isn't asked again
              if (user?.needs_birth_date) setUser({...user, needs_birth_date: false});
            }}
          />
        )}
        {player && (
          <SmokerRow
            value={!!player.smoker}
            desktop={desktop}
            onSave={async (smoker) => {
              await updateSmokerAPI(player.id, smoker);
              setPlayer((p) => (p ? {...p, smoker} : p));
              // answered here, so the app doesn't ask
              if (user?.needs_smoker) setUser({...user, needs_smoker: false});
            }}
          />
        )}
      </Card>
    </Box>
  );

  const teamsBlock = (desktop: boolean) => (
    <TeamCards
      title="Moje ekipe"
      desktop={desktop}
      loading={teamsLoading}
      empty="Još nisi član nijedne ekipe."
      teams={teams.map((t) => ({
        team_id: t.team_id,
        team_name: t.team_name,
        players: (t.teamPlayers ?? []).flatMap(({player: p}) => (p?.id == null ? [] : [{id: p.id, first_name: p.first_name ?? "", last_name: p.last_name ?? ""}])),
      }))}
    />
  );

  const errorNote = error && <ErrorNote onRetry={load}>{error}</ErrorNote>;

  if (isDesktop) {
    return (
      <DesktopShell active="profile" eyebrow="Moj profil" title="Profil">
        {errorNote}
        {/* three columns, each scrolling on its own (the padding keeps the cards' shadows inside the scroll box) */}
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "360px minmax(0,1fr) minmax(0,1fr)", gridTemplateRows: "minmax(0,1fr)", gap: "20px", alignItems: "start"}}>
          {[hero(true), detailsBlock(true), teamsBlock(true)].map((column, i) => (
            <Box key={i} sx={{minHeight: 0, maxHeight: "100%", overflowY: "auto", p: "0 4px 4px", mx: "-4px", display: "flex", flexDirection: "column"}}>
              {column}
            </Box>
          ))}
        </Box>
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      {hero(false)}
      {errorNote}
      <ScrollArea bleed>
        {detailsBlock(false)}
        {teamsBlock(false)}
      </ScrollArea>
      <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
        Početni zaslon
      </PrimaryButton>
      {/* the phone's only way out (the desktop has it in the menu's user card); kept clear of Početni zaslon, so a low
          tap on it doesn't log out */}
      <TextButton onClick={() => logout()} disabled={loggingOut} sx={{alignSelf: "center", mt: "6px", mb: "-8px"}}>
        <LogoutRoundedIcon />
        Odjava
      </TextButton>
    </Screen>
  );
}

// The last Podaci row: Pušač with its switch, saved when it is flipped (Novo kolo seats smokers at the smoking
// tables)
function SmokerRow({value, desktop, onSave}: {value: boolean; desktop: boolean; onSave: (smoker: boolean) => Promise<void>}) {
  // the switch moves at once; a failed save puts it back
  const [shown, setShown] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setShown(value), [value]);

  const flip = async () => {
    if (saving) return;
    const next = !shown;
    setShown(next);
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      setShown(!next);
      setError(err instanceof Error ? err.message : "Odgovor nije spremljen.");
    }
    setSaving(false);
  };

  return (
    <Box sx={{borderBottom: `1px solid ${color.line}`}}>
      <Box sx={{height: desktop ? 56 : 52, display: "flex", alignItems: "center", gap: "10px", pl: desktop ? "18px" : "16px", pr: "14px"}}>
        <Box component="dt" sx={{flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: 15, color: color.muted, "& svg": {fontSize: 20, color: color.navy}}}>
          Pušač
          <SmokingRoomsRoundedIcon aria-hidden />
        </Box>
        <Box component="dd" sx={{m: 0, display: "flex", alignItems: "center", gap: "10px"}}>
          <Box component="span" aria-hidden sx={{fontSize: 15, fontWeight: 600, color: color.ink}}>
            {shown ? "Da" : "Ne"}
          </Box>
          <Box
            component="button"
            type="button"
            role="switch"
            aria-checked={shown}
            aria-label="Pušač"
            aria-busy={saving || undefined}
            onClick={flip}
            sx={{...buttonBase, display: "flex", borderRadius: "16px"}}
          >
            <SwitchTrack on={shown} />
          </Box>
        </Box>
      </Box>
      {error && <ErrorNote sx={{m: `0 ${desktop ? "18px" : "16px"} 12px`}}>{error}</ErrorNote>}
    </Box>
  );
}

// The birth date Podaci row, with an edit button opening a date field with Odustani and Spremi in place
function BirthDateRow({value, desktop, onSave}: {value: string | null; desktop: boolean; onSave: (birthDate: string) => Promise<void>}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = leagueDateString();
  const px = desktop ? "18px" : "16px";

  if (draft == null) {
    return (
      <Box sx={{height: desktop ? 56 : 52, display: "flex", alignItems: "center", gap: "8px", pl: px, pr: "6px", borderBottom: `1px solid ${color.line}`}}>
        <Box component="dt" sx={{flex: "none", whiteSpace: "nowrap", fontSize: 15, color: color.muted}}>
          Datum rođenja
        </Box>
        <Box component="dd" sx={{m: 0, flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", ...tabular}}>
          {value ? `${displayDate(value)}.` : "—"}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Uredi datum rođenja"
          onClick={() => {
            setDraft(value ?? "");
            setError(null);
          }}
          sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "&:hover": {background: color.paper}, "& svg": {fontSize: 20}}}
        >
          <EditRoundedIcon />
        </Box>
      </Box>
    );
  }

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft >= "1900-01-01" && draft <= today;
  const canSave = valid && draft !== value && !saving;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datum rođenja nije spremljen.");
    }
    setSaving(false);
  };

  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "10px", p: `12px ${px} 14px`, borderBottom: `1px solid ${color.line}`, background: color.cream2}}>
      <Box component="dt" sx={{fontSize: 13, fontWeight: 600, color: color.ink2}}>
        <label htmlFor="birth-date">Datum rođenja</label>
      </Box>
      <Box component="dd" sx={{m: 0}}>
        <Box component="form" onSubmit={save} noValidate sx={{display: "flex", flexDirection: "column", gap: "10px"}}>
          <Box
            component="input"
            id="birth-date"
            type="date"
            autoComplete="bday"
            autoFocus
            min="1900-01-01"
            max={today}
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            sx={{...dateInputFix, height: 50, width: "100%", boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${color.navy}`, background: color.white, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none"}}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Box sx={{display: "flex", gap: "8px"}}>
            <Box
              component="button"
              type="button"
              onClick={() => setDraft(null)}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", border: `1.5px solid ${tint.navy[25]}`, background: color.white, color: color.navy, fontSize: 15, fontWeight: 600}}
            >
              Odustani
            </Box>
            <Box
              component="button"
              type="submit"
              disabled={!canSave}
              aria-busy={saving || undefined}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", background: color.navy, color: color.white, fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.4}}}
            >
              {saving ? "Spremam…" : "Spremi"}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// The first Podaci row: "@username" with an edit button, opening a field with the username rules, Odustani and Spremi in place.
// value is null while the profile loads.
function UsernameRow({value, desktop, onSave}: {value: string | null; desktop: boolean; onSave: (username: string) => Promise<void>}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // a save that failed (e.g. the username is taken), shown until the field changes
  const [saveError, setSaveError] = useState<{draft: string; message: string} | null>(null);
  const px = desktop ? "18px" : "16px";

  if (draft == null) {
    return (
      <Box sx={{height: desktop ? 56 : 52, display: "flex", alignItems: "center", gap: "8px", pl: px, pr: "6px", borderBottom: `1px solid ${color.line}`}}>
        <Box component="dt" sx={{flex: "none", whiteSpace: "nowrap", fontSize: 15, color: color.muted}}>
          Korisničko ime
        </Box>
        <Box component="dd" sx={{m: 0, flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, fontWeight: 600, ...ellipsis}}>
          {value != null ? `@${value}` : <Skeleton width={110} sx={{ml: "auto"}} />}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Uredi korisničko ime"
          disabled={value == null}
          onClick={() => {
            setDraft(value ?? "");
            setSaveError(null);
          }}
          sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "&:hover": {background: color.paper}, "& svg": {fontSize: 20}}}
        >
          <EditRoundedIcon />
        </Box>
      </Box>
    );
  }

  const username = normalizeUsername(draft);
  const unchanged = draft === value || username === value;
  // the current username may predate the rules, so it isn't flagged until it's changed
  const error = (unchanged ? undefined : usernameError(draft)) ?? (saveError?.draft === draft ? saveError.message : undefined);
  const canSave = !unchanged && !error && !saving;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(username);
      setDraft(null);
    } catch (err) {
      setSaveError({draft, message: err instanceof Error ? err.message : "Korisničko ime nije spremljeno."});
    }
    setSaving(false);
  };

  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px", p: `12px ${px} 14px`, borderBottom: `1px solid ${color.line}`, background: color.cream2}}>
      <Box component="dt" sx={{fontSize: 13, fontWeight: 600, color: color.ink2}}>
        <label htmlFor="username">Korisničko ime</label>
      </Box>
      <Box component="dd" sx={{m: 0}}>
        <Box component="form" onSubmit={save} noValidate sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
          <Box
            sx={{height: 50, display: "flex", alignItems: "center", gap: "2px", boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${error ? color.red : color.navy}`, background: color.white, px: "14px"}}
          >
            <Box component="span" aria-hidden sx={{flex: "none", fontSize: 16, color: color.faint}}>
              @
            </Box>
            <Box
              component="input"
              id="username"
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={USERNAME_MAX}
              value={draft}
              aria-invalid={error ? true : undefined}
              aria-describedby="username-hint"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value.replace(/\s+/g, ""))}
              sx={{flex: 1, minWidth: 0, height: "100%", p: 0, border: "none", background: "transparent", font: "inherit", fontSize: 16, color: color.ink, outline: "none"}}
            />
          </Box>
          <Box id="username-hint" aria-live="polite" sx={{fontSize: 12.5, color: error ? color.red : color.muted}}>
            {error ?? "Po ovom imenu te suigrači pronalaze kad te dodaju u ekipu."}
          </Box>
          <Box sx={{display: "flex", gap: "8px"}}>
            <Box
              component="button"
              type="button"
              onClick={() => setDraft(null)}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", border: `1.5px solid ${tint.navy[25]}`, background: color.white, color: color.navy, fontSize: 15, fontWeight: 600}}
            >
              Odustani
            </Box>
            <Box
              component="button"
              type="submit"
              disabled={!canSave}
              aria-busy={saving || undefined}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", background: color.navy, color: color.white, fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.4}}}
            >
              {saving ? "Spremam…" : "Spremi"}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
