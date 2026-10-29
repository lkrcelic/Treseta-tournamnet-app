"use client";

import {addTeamToLeagueAPI} from "@/app/_fetchers/league/leagues";
import {addTeamPlayerAPI, deleteTeamAPI, removeTeamPlayerAPI, renameTeamAPI} from "@/app/_fetchers/team/manage";
import {adminPlayersList} from "@/app/_hooks/useAdminPlayers";
import {LeagueOption, reloadLeagues, updateCachedLeague} from "@/app/_hooks/useLeagues";
import type {Overview} from "@/app/_hooks/useOverview";
import {teamsList} from "@/app/_hooks/useTeams";
import type {AdminPlayerRow} from "@/app/_interfaces/player";
import type {TeamOverview, TeamOverviewLeague, TeamOverviewPlayer} from "@/app/_interfaces/profiles";
import {leagueDateString} from "@/app/_lib/dates";
import {leagueEnded} from "@/app/_lib/league";
import {startNavStack} from "@/app/_lib/navStack";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {
  addPlayerTeam,
  addTeamLeague,
  addTeamMember,
  neighbourId,
  removePlayerTeam,
  removeTeam,
  removeTeamEverywhere,
  removeTeamMember,
  renamePlayersTeam,
  renameTeamIn,
  sortHr,
  teamNameError,
} from "@/app/_lib/ui/directory";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ConfirmSheet, ErrorNote, GhostIconButton, OutlineButton, Spinner} from "@/app/_ui/sp";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import {Box, Dialog} from "@mui/material";
import {usePathname} from "next/navigation";
import React, {useCallback, useEffect, useId, useRef, useState} from "react";
import {useDirectoryFrame} from "./PageParts";

// The admin's controls on a desktop Team page (handoff §6 "Admin controls": always visible, no edit mode; design 13h,
// Profiles P:185-186, 205-258): the pencil that renames the team, "Dodaj igrača" with a remove button per player, and
// "Dodaj u ligu". Every change is saved at once and shows at once, here and in the Ekipe and Igrači directories; a
// change the server refuses is undone and its reason shown in the card. "Nova ekipa" (NewTeamPage.tsx) uses the name
// field and its ✓.

export const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// a team's leagues as the page lists them: running ones first, then the newest (teamLeagueRows)
const leagueOrder = (a: TeamOverviewLeague, b: TeamOverviewLeague) => Number(b.live) - Number(a.live) || b.league_id - a.league_id;

// A player being added: shown at the end of Igrači (with a spinner for the rating) until the page has them
export type PendingPlayer = {id: number; name: string};

export type TeamAdmin = {
  rename: NameEditing;
  pending: PendingPlayer[];
  addPlayer: (player: AdminPlayerRow) => void;
  removePlayer: (player: TeamOverviewPlayer) => void;
  addLeague: (league: LeagueOption) => void;
  playersError: string | null;
  leaguesError: string | null;
};

export type NameEditing = {
  editing: boolean;
  draft: string;
  setDraft: (name: string) => void;
  start: () => void;
  cancel: () => void;
  save: () => void;
  saving: boolean;
  error: string | null;
};

// The admin's actions on the team shown (overview.data must be there). Every change to the page (setData) drops a load
// still on its way, so each action loads the page again once the server has answered: a player being added leaves
// the pending rows only when a load lists them.
export function useTeamAdmin(overview: Overview<TeamOverview>): TeamAdmin {
  const team = overview.data;
  const teamId = team?.team.id ?? 0;
  const teamName = team?.team.name ?? "";
  const {setData, reload} = overview;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlayer[]>([]);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);

  // another team (the page beside the directory changed): nothing of the last one's editing stays
  useEffect(() => {
    setEditing(false);
    setNameError(null);
    setPending([]);
    setPlayersError(null);
    setLeaguesError(null);
  }, [teamId]);

  // a player being added leaves the pending rows once the page lists them
  const roster = team?.players;
  useEffect(() => {
    if (roster && pending.some((p) => roster.some((r) => r.id === p.id))) setPending((prev) => prev.filter((p) => !roster.some((r) => r.id === p.id)));
  }, [roster, pending]);

  // a card's error is about the last change: the next change anywhere on the page clears it
  const clearErrors = useCallback(() => {
    setPlayersError(null);
    setLeaguesError(null);
  }, []);

  const start = useCallback(() => {
    clearErrors();
    setDraft(teamName);
    setNameError(null);
    setEditing(true);
  }, [teamName, clearErrors]);
  const cancel = useCallback(() => {
    setEditing(false);
    setNameError(null);
  }, []);
  // typing again clears the last refusal
  const changeDraft = useCallback((name: string) => {
    setDraft(name);
    setNameError(null);
  }, []);
  const save = useCallback(async () => {
    const name = draft.trim();
    const problem = teamNameError(name, null, teamId);
    if (problem) {
      setNameError(problem);
      return;
    }
    if (name === teamName) {
      cancel();
      return;
    }
    setSaving(true);
    setNameError(null);
    try {
      await renameTeamAPI(teamId, name);
      setData((t) => ({...t, team: {...t.team, name}}));
      teamsList.update((list) => sortHr(renameTeamIn(list, teamId, name), (t) => t.name));
      adminPlayersList.update((list) => renamePlayersTeam(list, teamId, name));
      setEditing(false);
      // the change drops a load still on its way (a player being added waits for it): load the page again
      reload();
    } catch (e) {
      setNameError(errorText(e, "Ime ekipe nije spremljeno."));
    }
    setSaving(false);
  }, [draft, teamId, teamName, cancel, setData, reload]);

  const addPlayer = useCallback(
    async (p: AdminPlayerRow) => {
      clearErrors();
      setPending((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, {id: p.id, name: p.name}]));
      try {
        await addTeamPlayerAPI(teamId, p.id);
        teamsList.update((list) => addTeamMember(list, teamId, {id: p.id, first_name: p.first_name, last_name: p.last_name, username: p.username}));
        adminPlayersList.update((list) => addPlayerTeam(list, p.id, {team_id: teamId, team_name: teamName}));
        // the player's rating and the team's numbers come from the server
        reload();
      } catch (e) {
        setPending((prev) => prev.filter((x) => x.id !== p.id));
        setPlayersError(errorText(e, "Igrač nije dodan u ekipu."));
      }
    },
    [teamId, teamName, reload, clearErrors]
  );

  const removePlayer = useCallback(
    async (p: TeamOverviewPlayer) => {
      clearErrors();
      // where the row goes back if the server refuses
      const at = roster?.findIndex((x) => x.id === p.id) ?? -1;
      setData((t) => (t.players.some((x) => x.id === p.id) ? {...t, players: t.players.filter((x) => x.id !== p.id), stats: {...t.stats, players: t.stats.players - 1}} : t));
      try {
        await removeTeamPlayerAPI(teamId, p.id);
        teamsList.update((list) => removeTeamMember(list, teamId, p.id));
        adminPlayersList.update((list) => removePlayerTeam(list, p.id, teamId));
        // "Tvoja ekipa" when an admin removed themself
        reload();
      } catch (e) {
        setData((t) => {
          if (t.players.some((x) => x.id === p.id)) return t;
          const players = [...t.players];
          players.splice(at < 0 ? players.length : Math.min(at, players.length), 0, p);
          return {...t, players, stats: {...t.stats, players: t.stats.players + 1}};
        });
        setPlayersError(errorText(e, "Igrač nije uklonjen iz ekipe."));
        // what the server has now (the undo also dropped any load on its way)
        reload();
      }
    },
    [teamId, roster, setData, reload, clearErrors]
  );

  const addLeague = useCallback(
    async (l: LeagueOption) => {
      clearErrors();
      const live = !leagueEnded(l.endDate ?? null, l.lastNight ?? null, leagueDateString());
      const row: TeamOverviewLeague = {league_id: l.id, league_name: l.name, season: l.season ?? null, live, rank: null, points: null, played: 0};
      const change = (t: TeamOverview, by: 1 | -1): TeamOverview => ({
        ...t,
        stats: {...t.stats, leagues: t.stats.leagues + by, leagues_live: t.stats.leagues_live + (live ? by : 0)},
      });
      setData((t) => (t.leagues.some((x) => x.league_id === l.id) ? t : {...change(t, 1), leagues: [...t.leagues, row].sort(leagueOrder)}));
      try {
        await addTeamToLeagueAPI(l.id, teamId);
        teamsList.update((list) => addTeamLeague(list, teamId, {id: l.id, name: l.name}));
        updateCachedLeague(l.id, {teamCount: (l.teamCount ?? 0) + 1});
        reload();
      } catch (e) {
        setData((t) => (t.leagues.some((x) => x.league_id === l.id) ? {...change(t, -1), leagues: t.leagues.filter((x) => x.league_id !== l.id)} : t));
        setLeaguesError(errorText(e, "Ekipa nije dodana u ligu."));
        reload();
      }
    },
    [teamId, setData, reload, clearErrors]
  );

  return {
    rename: {editing, draft, setDraft: changeDraft, start, cancel, save, saving, error: nameError},
    pending,
    addPlayer,
    removePlayer,
    addLeague,
    playersError,
    leaguesError,
  };
}

// ---------- the team's name ----------

// The input that takes the name's place in the header card (P:185): Enter saves, Escape cancels. note: a line under it
// (Nova ekipa), which the reason a name can't be saved replaces; without a note the reason shows over the tiles under
// the name, so the header card keeps its height.
export function TeamNameInput({
  edit,
  short,
  note,
  inputRef,
}: {
  edit: NameEditing;
  short: boolean;
  note?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const messageId = useId();
  const reason = edit.error && (
    <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: color.ink, "& svg": {flex: "none", fontSize: 16, color: color.red}}}>
      <ErrorRoundedIcon aria-hidden />
      {edit.error}
    </Box>
  );
  return (
    <Box sx={{position: "relative", flex: 1, minWidth: 0, maxWidth: 520, display: "flex", flexDirection: "column", gap: "4px"}}>
      <Box
        component="input"
        ref={inputRef}
        type="text"
        value={edit.draft}
        aria-label="Ime ekipe"
        aria-invalid={edit.error ? true : undefined}
        aria-describedby={edit.error || note ? messageId : undefined}
        maxLength={100}
        autoComplete="off"
        spellCheck={false}
        readOnly={edit.saving}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => edit.setDraft(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!edit.saving) edit.save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            edit.cancel();
          }
        }}
        sx={{
          width: "100%",
          height: short ? 46 : 56,
          boxSizing: "border-box",
          borderRadius: "14px",
          border: `1.5px solid ${edit.error ? color.red : color.navy}`,
          background: color.white,
          p: "0 16px",
          fontFamily: font.display,
          fontSize: short ? 24 : 30,
          fontWeight: 800,
          color: color.ink,
          outline: "none",
          "&:focus-visible": {boxShadow: shadow.focus},
        }}
      />
      {note != null ? (
        // ink text (the icon carries the red): red on the cream card would be under 4.5:1
        <Box key={edit.error ? "reason" : "note"} id={messageId} role={edit.error ? "alert" : undefined} sx={{pl: "4px", fontSize: 13, lineHeight: 1.35, color: color.ink2}}>
          {reason || note}
        </Box>
      ) : (
        reason && (
          <Box
            id={messageId}
            role="alert"
            sx={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 2,
              maxWidth: "100%",
              boxSizing: "border-box",
              p: "7px 12px 7px 10px",
              borderRadius: "12px",
              background: color.white,
              boxShadow: shadow.cardHover,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {reason}
          </Box>
        )
      )}
    </Box>
  );
}

// The pencil next to the name, and the ✓ that saves it while it is being edited (P:185, 498-500); the ✓ sits level
// with the middle of the field
export function NameButton({edit, short, onStart, buttonRef}: {edit: NameEditing; short: boolean; onStart: () => void; buttonRef?: React.Ref<HTMLButtonElement>}) {
  const label = edit.editing ? "Spremi ime ekipe" : "Uredi ime ekipe";
  const size = short ? 40 : 44;
  const field = short ? 46 : 56;
  return (
    <Box
      component="button"
      type="button"
      ref={buttonRef}
      aria-label={label}
      title={label}
      disabled={edit.saving}
      aria-busy={edit.saving || undefined}
      onClick={edit.editing ? edit.save : onStart}
      sx={{
        ...buttonBase,
        width: size,
        height: size,
        flex: "none",
        mt: edit.editing ? `${(field - size) / 2}px` : 0,
        borderRadius: "50%",
        background: edit.editing ? color.navy : color.white,
        color: edit.editing ? color.white : color.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: shadow.pill,
        transition: "background 150ms ease, box-shadow 150ms ease",
        "&:hover:not(:disabled)": {boxShadow: shadow.cardHover},
        "& svg": {fontSize: 22},
      }}
    >
      {edit.saving ? <Spinner size={20} tone="white" /> : edit.editing ? <CheckRoundedIcon aria-hidden /> : <EditRoundedIcon aria-hidden />}
    </Box>
  );
}

// The name editing of a Team page header: the input focused with its text selected when the pencil is pressed, the
// focus back on the pencil when it is saved or cancelled
export function useNameFocus(editing: boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const was = useRef(editing);
  useEffect(() => {
    if (editing && !was.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (!editing && was.current && (document.activeElement == null || document.activeElement === document.body || document.activeElement === inputRef.current)) {
      buttonRef.current?.focus();
    }
    was.current = editing;
  }, [editing]);
  return {inputRef, buttonRef};
}

// ---------- remove ----------

// The remove button at the end of a player's row (P:224): over the row's link, so it takes its own clicks
// size: 44 on the phone (a finger's target)
export function RemoveButton({label, onClick, icon = <PersonRemoveRoundedIcon />, size = 36}: {label: string; onClick: () => void; icon?: React.ReactNode; size?: number}) {
  return (
    <GhostIconButton
      label={label}
      title="Ukloni iz ekipe"
      size={size}
      onClick={onClick}
      sx={{
        position: "relative",
        zIndex: 1,
        borderRadius: "10px",
        color: color.faint,
        transition: "background 150ms ease, color 150ms ease",
        "&:hover": {background: tint.red[10], color: color.red},
        "& svg": {fontSize: 20},
      }}
    >
      {icon}
    </GhostIconButton>
  );
}

// ---------- delete ----------

const DELETE_TEXT =
  "Ekipa nestaje iz aplikacije, zajedno s prijavama u lige i slikom; njezini igrači ostaju. Moguće je samo dok ekipa nije odigrala nijedno kolo. Ovo se ne može poništiti.";

// "Obriši ekipu" (not designed; as Obriši igrača): the button, then on the computer a dialog and on the phone a sheet
// that asks first. A team that has played can't be deleted (viewer.delete_blocked): the phone
// shows the button disabled with the reason under it, the computer's header leaves it out (no room for the reason).
// Should the server still refuse (a table made meanwhile), its reason shows in the confirmation. Once deleted the team leaves the Ekipe list, its players' teams and its leagues' counts, and the page
// goes to the next team of the list (the computer's directory), or back to Ekipe.
export function DeleteTeam({team, phone = false}: {team: TeamOverview; phone?: boolean}) {
  const router = useTransitionRouter();
  const pathname = usePathname();
  const frame = useDirectoryFrame();
  const titleId = useId();
  const reasonId = useId();
  const blocked = team.viewer.delete_blocked ?? null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {id, name} = team.team;

  const ask = () => {
    setError(null);
    setOpen(true);
  };
  const close = () => {
    if (!busy) setOpen(false);
  };
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTeamAPI(id);
    } catch (e) {
      setError(errorText(e, "Ekipa nije obrisana."));
      setBusy(false);
      return;
    }
    // the page is still the deleted team's (the admin hasn't picked another one meanwhile)
    const here = window.location.pathname === pathname;
    // where the directory goes: the next team the list shows (asked while it still has the deleted one)
    const next = !here || phone ? null : frame ? frame.nextAfterDelete(id) : neighbourId(teamsList.peek() ?? [], id);
    teamsList.update((list) => removeTeam(list, id));
    adminPlayersList.update((list) => removeTeamEverywhere(list, id));
    // its leagues' team counts
    if (team.leagues.length) void reloadLeagues();
    setBusy(false);
    setOpen(false);
    if (!here) return;
    if (phone) {
      router.replace("/teams", "back");
      return;
    }
    // the team's page is gone: the next one opens in its place (no Back to the deleted one)
    const to = next != null ? `/teams/${next}` : "/teams";
    startNavStack(to, pathname);
    router.replace(to, "morph");
  };

  const button = (
    <OutlineButton
      height={phone ? 52 : 44}
      tone={color.red}
      onClick={ask}
      disabled={blocked != null}
      aria-describedby={blocked ? reasonId : undefined}
      sx={{
        flex: "none",
        alignSelf: phone ? "stretch" : "center",
        gap: "8px",
        px: "16px",
        borderRadius: phone ? "16px" : "12px",
        border: `1.5px solid ${tint.red[35]}`,
        background: color.white,
        fontSize: phone ? 15 : 14,
        fontWeight: 600,
        "&:hover:not(:disabled)": {background: tint.red[6]},
        "& svg": {fontSize: 20},
      }}
    >
      <DeleteRoundedIcon aria-hidden />
      Obriši ekipu
    </OutlineButton>
  );

  if (blocked && !phone) return null;
  if (phone) {
    return (
      <>
        {blocked ? (
          <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
            {button}
            <Box id={reasonId} sx={{px: "4px", fontSize: 13, lineHeight: 1.4, color: color.muted, textAlign: "center", textWrap: "pretty"}}>
              {blocked}
            </Box>
          </Box>
        ) : (
          button
        )}
        <ConfirmSheet
          open={open}
          onClose={close}
          onConfirm={confirm}
          title="Obrisati ekipu?"
          text={`${name}: ${DELETE_TEXT}`}
          action="Obriši ekipu"
          icon={<DeleteRoundedIcon />}
          busy={busy}
          error={error}
        />
      </>
    );
  }
  return (
    <>
      {button}
      <Dialog
        open={open}
        onClose={close}
        aria-labelledby={titleId}
        slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
        PaperProps={{sx: {width: 500, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
      >
        <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.01em", overflowWrap: "anywhere"}}>
          Obrisati ekipu {name}?
        </Box>
        <Box sx={{display: "flex", gap: "12px", alignItems: "flex-start", p: "14px", borderRadius: "16px", background: tint.red[8], "& > svg": {fontSize: 24, color: color.red, flex: "none"}}}>
          <DeleteRoundedIcon aria-hidden />
          <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink, textWrap: "pretty"}}>
            {DELETE_TEXT}
          </Box>
        </Box>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
          <OutlineButton height={52} onClick={close} disabled={busy} sx={{fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
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
    </>
  );
}

// ---------- the add fields' errors ----------

// under an add field: why the last change was refused, or (onRetry) that its options didn't load
export function AddError({children, onRetry}: {children: React.ReactNode; onRetry?: () => void}) {
  return (
    <ErrorNote onRetry={onRetry} sx={{mt: "8px", p: "8px 12px", borderRadius: "12px", fontSize: 14}}>
      {children}
    </ErrorNote>
  );
}
