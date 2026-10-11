"use client";

import {getPlayerByIdAPI, PlayerById} from "@/app/_fetchers/player/getById";
import {updateBirthDateAPI} from "@/app/_fetchers/player/updateBirthDate";
import {updateUsernameAPI} from "@/app/_fetchers/player/updateUsername";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useMyTeams from "@/app/_hooks/useMyTeams";
import {useMyRating} from "@/app/_hooks/useRatings";
import {formatChange} from "@/app/_lib/ui/ratings";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {leagueDateString} from "@/app/_lib/dates";
import {displayDate} from "@/app/_lib/ui/text";
import {normalizeUsername, USERNAME_MAX, usernameError} from "@/app/_lib/validation/username";
import useAuthStore from "@/app/_store/authStore";
import {color, font} from "@/app/_styles/tokens";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import {
  buttonBase,
  Card,
  dateInputFix,
  CenteredSpinner,
  DesktopShell,
  ellipsis,
  EmptyState,
  ErrorNote,
  InitialsAvatar,
  PlayerChip,
  PrimaryButton,
  Screen,
  ScrollArea,
  SectionLabel,
  tabular,
} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box, Skeleton} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useCallback, useEffect, useState} from "react";

export default function ProfilePage() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const {teams, loading: teamsLoading} = useMyTeams();
  const {me: myRating, total: ratedPlayers} = useMyRating();
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

  const fullName = player ? `${player.first_name} ${player.last_name}`.trim() : "";
  const details = [
    {k: "Email", v: player?.email},
    {k: "First name", v: player?.first_name},
    {k: "Last name", v: player?.last_name},
  ];

  const hero = (desktop: boolean) => (
    <Card
      component="section"
      aria-label="Igrač"
      sx={{
        background: color.cream,
        boxShadow: "none",
        borderRadius: desktop ? "28px" : "24px",
        p: desktop ? "28px" : "20px",
        display: "flex",
        flexDirection: "column",
        gap: desktop ? "22px" : "18px",
        flex: "none",
      }}
    >
      <Box sx={{display: "flex", flexDirection: desktop ? "column" : "row", alignItems: desktop ? "flex-start" : "center", gap: desktop ? "22px" : "14px"}}>
        <InitialsAvatar name={fullName || user?.username || ""} size={desktop ? 96 : 64} variant="navy" />
        <Box sx={{display: "flex", flexDirection: "column", gap: desktop ? "4px" : "2px", minWidth: 0}}>
          <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: desktop ? 34 : 28, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em", ...ellipsis}}>
            {player?.username ?? user?.username ?? <Skeleton width={160} />}
          </Box>
          <Box sx={{fontSize: desktop ? 17 : 16, color: color.inkSoft}}>{player ? fullName : <Skeleton width={120} />}</Box>
        </Box>
      </Box>
      {/* my rating: the last change and my place, opening my rating's detail */}
      <Box
        component={TransitionLink}
        href={myRating ? `/ratings/${myRating.id}` : "/ratings"}
        sx={{...buttonBase, display: "flex", alignItems: "center", gap: "12px", borderTop: `1px solid ${color.border}`, pt: desktop ? "16px" : "14px", textDecoration: "none", color: color.ink, textAlign: "left"}}
      >
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
          <Box sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.inkSoft}}>Rejting</Box>
          {myRating && (
            <Box sx={{display: "flex", alignItems: "baseline", gap: "8px", fontSize: 14, ...tabular}}>
              {myRating.rounds > 0 && (
                <Box component="span" sx={{fontWeight: 700, color: myRating.change! > 0 ? color.green : myRating.change! < 0 ? color.red : color.muted}}>
                  {formatChange(myRating.change)}
                </Box>
              )}
              <Box component="span" sx={{color: color.inkSoft}}>
                #{myRating.rank} od {ratedPlayers}
              </Box>
            </Box>
          )}
        </Box>
        <Box sx={{fontFamily: font.display, fontSize: desktop ? 56 : 44, fontWeight: 800, lineHeight: 0.85, color: color.navy, ...tabular}}>
          {myRating?.rating ?? player?.rating ?? "—"}
        </Box>
        <ChevronRightRoundedIcon sx={{fontSize: 24, color: color.navy}} />
      </Box>
    </Card>
  );

  const detailsBlock = (desktop: boolean) => (
    <Box component="section" aria-labelledby="details" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id="details">Details</SectionLabel>
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
      </Card>
    </Box>
  );

  const teamsBlock = (desktop: boolean) => (
    <Box component="section" aria-labelledby="my-teams" sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id="my-teams">My Teams</SectionLabel>
      {teamsLoading ? (
        <Card>
          <CenteredSpinner />
        </Card>
      ) : teams.length === 0 ? (
        <Card>
          <EmptyState>Još nisi član nijedne ekipe.</EmptyState>
        </Card>
      ) : (
        teams.map((t) => (
          <Card key={t.team_id} sx={{p: desktop ? "18px" : "16px", display: "flex", flexDirection: "column", gap: desktop ? "12px" : "10px"}}>
            <Box component="h3" sx={{m: 0, fontFamily: font.display, fontSize: desktop ? 24 : 22, fontWeight: 700, letterSpacing: "-.01em"}}>
              {t.team_name}
            </Box>
            <Box component="ul" aria-label="Igrači" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: "8px"}}>
              {t.teamPlayers?.map((tp) => (
                <Box component="li" key={tp.player.id}>
                  <PlayerChip name={tp.player.username} />
                </Box>
              ))}
            </Box>
          </Card>
        ))
      )}
    </Box>
  );

  const errorNote = error && <ErrorNote onRetry={load}>{error}</ErrorNote>;

  if (isDesktop) {
    return (
      <DesktopShell active="profile" eyebrow="My Profile" title="Profil">
        {errorNote}
        <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: "20px", alignItems: "start"}}>
          {hero(true)}
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "20px", alignItems: "start"}}>
            {detailsBlock(true)}
            {teamsBlock(true)}
          </Box>
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
    </Screen>
  );
}

// The last Details row: the birth date with an edit button, opening a date field with Cancel and Save in place
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
          Birth date
        </Box>
        <Box component="dd" sx={{m: 0, flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", ...tabular}}>
          {value ? `${displayDate(value)}.` : "—"}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Edit birth date"
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
    <Box sx={{display: "flex", flexDirection: "column", gap: "10px", p: `12px ${px} 14px`, borderBottom: `1px solid ${color.line}`, background: color.creamSoft}}>
      <Box component="dt" sx={{fontSize: 13, fontWeight: 600, color: color.inkSoft}}>
        <label htmlFor="birth-date">Birth date</label>
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
            sx={{...dateInputFix, height: 50, width: "100%", boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${color.navy}`, background: color.card, px: "14px", font: "inherit", fontSize: 16, color: color.ink, outline: "none"}}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Box sx={{display: "flex", gap: "8px"}}>
            <Box
              component="button"
              type="button"
              onClick={() => setDraft(null)}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", border: "1.5px solid rgba(60,74,103,.25)", background: color.card, color: color.navy, fontSize: 15, fontWeight: 600}}
            >
              Cancel
            </Box>
            <Box
              component="button"
              type="submit"
              disabled={!canSave}
              aria-busy={saving || undefined}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", background: color.navy, color: "#FFFFFF", fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.4}}}
            >
              {saving ? "Saving…" : "Save"}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// The first Details row: "@username" with an edit button, opening a field with the username rules, Cancel and Save in place.
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
          Username
        </Box>
        <Box component="dd" sx={{m: 0, flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, fontWeight: 600, ...ellipsis}}>
          {value != null ? `@${value}` : <Skeleton width={110} sx={{ml: "auto"}} />}
        </Box>
        <Box
          component="button"
          type="button"
          aria-label="Edit username"
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
      setSaveError({draft, message: err instanceof Error ? err.message : "Username not saved."});
    }
    setSaving(false);
  };

  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px", p: `12px ${px} 14px`, borderBottom: `1px solid ${color.line}`, background: color.creamSoft}}>
      <Box component="dt" sx={{fontSize: 13, fontWeight: 600, color: color.inkSoft}}>
        <label htmlFor="username">Username</label>
      </Box>
      <Box component="dd" sx={{m: 0}}>
        <Box component="form" onSubmit={save} noValidate sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
          <Box
            sx={{height: 50, display: "flex", alignItems: "center", gap: "2px", boxSizing: "border-box", borderRadius: "14px", border: `1.5px solid ${error ? color.red : color.navy}`, background: color.card, px: "14px"}}
          >
            <Box component="span" aria-hidden sx={{flex: "none", fontSize: 16, color: color.placeholder}}>
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
            {error ?? "Teammates find you by this name when adding you to a team."}
          </Box>
          <Box sx={{display: "flex", gap: "8px"}}>
            <Box
              component="button"
              type="button"
              onClick={() => setDraft(null)}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", border: "1.5px solid rgba(60,74,103,.25)", background: color.card, color: color.navy, fontSize: 15, fontWeight: 600}}
            >
              Cancel
            </Box>
            <Box
              component="button"
              type="submit"
              disabled={!canSave}
              aria-busy={saving || undefined}
              sx={{...buttonBase, flex: 1, height: 46, borderRadius: "14px", background: color.navy, color: "#FFFFFF", fontSize: 15, fontWeight: 600, "&:disabled": {opacity: 0.4}}}
            >
              {saving ? "Saving…" : "Save"}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
