"use client";

import {deletePlayerAPI, updateAdminPlayerAPI} from "@/app/_fetchers/admin/players";
import {adminPlayersList} from "@/app/_hooks/useAdminPlayers";
import type {Overview} from "@/app/_hooks/useOverview";
import useTeams from "@/app/_hooks/useTeams";
import type {PlayerOverview} from "@/app/_interfaces/profiles";
import {leagueDateString} from "@/app/_lib/dates";
import {phoneInput} from "@/app/_lib/phone";
import {teamAddOptions} from "@/app/_lib/ui/directory";
import {teamInitial} from "@/app/_lib/ui/profiles";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, ConfirmSheet, ellipsis, EmptyState, ErrorNote, Field, InitialsAvatar, OutlineButton, SearchAddField, SectionLabel, SolidButton, SwitchRow, SwitchTrack, TextInput} from "@/app/_ui/sp";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import GroupRemoveRoundedIcon from "@mui/icons-material/GroupRemoveRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import {Box} from "@mui/material";
import React, {useId, useMemo, useState} from "react";
import {ACCOUNT_TEXT, changePlayerActive, forgetPlayer, usePlayerForm} from "./EditPlayerPanel";
import {PlayerTeamsAdmin} from "./PlayerAdmin";
import {AddError, errorText, RemoveButton} from "./TeamAdmin";
import {stretchedLink, stretchedRow} from "./PageParts";

// The admin's controls on the phone Player page (admin-mobile 35–39): the player's teams with "Dodaj u ekipu", the Admin
// switch, Račun (Deaktiviraj račun / Obriši igrača, each asked in a sheet) and the "Uredi osobne podatke" sheet. The
// calls and rules are the desktop's (usePlayerTeamsAdmin, usePlayerForm, the Račun helpers).

// Ekipe: each team (to its page) with its remove button, and "Dodaj u ekipu · ime ekipe"
export function PlayerTeamsPhone({data, admin}: {data: PlayerOverview; admin: PlayerTeamsAdmin}) {
  const titleId = useId();
  const {list, error, reload} = useTeams();
  const options = useMemo(() => (list ? teamAddOptions(list, data.teams.map((t) => t.team_id)) : []), [list, data.teams]);
  return (
    <Box component="section" aria-labelledby={titleId} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id={titleId}>Ekipe</SectionLabel>
      <Box sx={{background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
        <Box sx={{p: "12px 12px 4px"}}>
          <SearchAddField
            placeholder="Dodaj u ekipu · ime ekipe"
            icon={<GroupAddRoundedIcon aria-hidden />}
            options={options}
            disabled={!data.player.active}
            onAdd={(o) => {
              const team = list?.find((t) => t.id === o.id);
              if (team) admin.addTeam(team);
            }}
            note={!data.player.active ? "Deaktivirani igrač se ne može dodati u ekipu." : undefined}
            noHit="Nema takve ekipe."
            sx={{flex: "none"}}
          />
          {error && !list && <AddError onRetry={reload}>{error}</AddError>}
          {admin.error && <AddError>{admin.error}</AddError>}
        </Box>
        {data.teams.length === 0 ? (
          <EmptyState icon>Igrač još nije ni u jednoj ekipi.</EmptyState>
        ) : (
          <Box component="ul" aria-label="Ekipe igrača" sx={{listStyle: "none", m: 0, p: 0}}>
            {data.teams.map((t, i) => (
              <Box component="li" key={t.team_id} sx={{...stretchedRow, minHeight: 62, display: "flex", alignItems: "center", gap: "12px", p: "0 4px 0 14px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
                <Box component={TransitionLink} href={`/teams/${t.team_id}`} sx={{...stretchedLink, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px"}}>
                  <InitialsAvatar name={t.team_name} letters={teamInitial(t.team_name)} src={t.photo_url} size={38} variant="paper" />
                  <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: color.ink, ...ellipsis}}>
                    {t.team_name}
                  </Box>
                </Box>
                <RemoveButton label={`Ukloni iz ekipe ${t.team_name}`} onClick={() => admin.removeTeam(t)} icon={<GroupRemoveRoundedIcon />} size={44} />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

type Ask = "active" | "delete";

// The Admin switch (saved at once) and Račun. An admin can't take their own role or close their own account (the
// server refuses it too).
export function PlayerAccountPhone({data, overview}: {data: PlayerOverview; overview: Overview<PlayerOverview>}) {
  const router = useTransitionRouter();
  const player = data.player;
  const self = data.viewer.self;
  const [admin, setAdmin] = useState<boolean | null>(null);
  const isAdmin = admin ?? player.is_admin === true;
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAdmin = async () => {
    if (self || adminBusy) return;
    const next = !isAdmin;
    setAdmin(next);
    setAdminBusy(true);
    setAdminError(null);
    try {
      await updateAdminPlayerAPI(player.id, {is_admin: next});
      adminPlayersList.update((list) => list.map((p) => (p.id === player.id ? {...p, admin: next} : p)));
      overview.reload();
    } catch (e) {
      setAdmin(!next);
      setAdminError(errorText(e, "Promjena nije spremljena."));
    }
    setAdminBusy(false);
  };

  const confirm = async () => {
    if (!ask || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (ask === "active") {
        await changePlayerActive(player.id, overview, !player.active);
        setAsk(null);
      } else {
        await deletePlayerAPI(player.id);
        forgetPlayer(player.id);
        setAsk(null);
        router.replace("/players", "back");
      }
    } catch (e) {
      setError(errorText(e, ask === "active" ? "Promjena nije spremljena." : "Igrač nije obrisan."));
    }
    setBusy(false);
  };

  const accountButton = {
    ...buttonBase,
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    borderRadius: "16px",
    border: `1.5px solid ${color.borderControl}`,
    background: color.white,
    color: color.navy,
    fontSize: 15,
    fontWeight: 600,
    "& svg": {fontSize: 20},
  } as const;

  return (
    <>
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
        <SectionLabel>Admin</SectionLabel>
        <Box sx={{background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
          <Box
            component="button"
            type="button"
            role="switch"
            aria-checked={isAdmin}
            aria-label="Administrator"
            disabled={self || adminBusy}
            onClick={toggleAdmin}
            sx={{...buttonBase, width: "100%", minHeight: 72, display: "flex", alignItems: "center", gap: "12px", px: "16px", textAlign: "left"}}
          >
            <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
              <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink}}>
                Administrator
              </Box>
              <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted}}>
                {self ? ACCOUNT_TEXT.selfAdmin : ACCOUNT_TEXT.admin}
              </Box>
            </Box>
            <SwitchTrack on={isAdmin} dim={self} />
          </Box>
        </Box>
        {adminError && <ErrorNote>{adminError}</ErrorNote>}
      </Box>

      {!self && (
        <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
          <SectionLabel>Račun</SectionLabel>
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
            <Box component="button" type="button" onClick={() => (setError(null), setAsk("active"))} sx={accountButton}>
              {player.active ? <BlockRoundedIcon aria-hidden /> : <HowToRegRoundedIcon aria-hidden />}
              {player.active ? "Deaktiviraj račun" : "Aktiviraj račun"}
            </Box>
            <Box component="button" type="button" onClick={() => (setError(null), setAsk("delete"))} sx={{...accountButton, borderColor: tint.red[35], color: color.red}}>
              <PersonOffRoundedIcon aria-hidden />
              Obriši igrača
            </Box>
          </Box>
        </Box>
      )}

      <ConfirmSheet
        open={ask === "active"}
        onClose={() => setAsk(null)}
        onConfirm={confirm}
        title={player.active ? "Deaktivirati račun?" : "Aktivirati račun?"}
        text={
          player.active
            ? `${player.name} se ne može prijaviti i ne nudi se pri slaganju ekipa. Rezultati i rejting ostaju.`
            : `${player.name} se opet može prijaviti i dodavati u ekipe.`
        }
        action={player.active ? "Deaktiviraj" : "Aktiviraj"}
        icon={player.active ? <BlockRoundedIcon /> : <HowToRegRoundedIcon />}
        danger={player.active}
        busy={busy}
        error={ask === "active" ? error : null}
      />
      <ConfirmSheet
        open={ask === "delete"}
        onClose={() => setAsk(null)}
        onConfirm={confirm}
        title="Obrisati igrača?"
        text={`${player.name} se miče iz svih ekipa i ne može se prijaviti. Odigrana kola ostaju u poretku pod imenom „Obrisani igrač”. Ovo se ne može poništiti.`}
        action="Obriši igrača"
        icon={<PersonOffRoundedIcon />}
        busy={busy}
        error={ask === "delete" ? error : null}
      />
    </>
  );
}

// "Uredi osobne podatke" (37): the fields of the desktop panel in a sheet whose fields scroll, with Odustani and Spremi
// at the bottom (kept above the keyboard)
export function PlayerDetailsSheet({data, overview, onClose}: {data: PlayerOverview; overview: Overview<PlayerOverview>; onClose: () => void}) {
  const f = usePlayerForm(data, overview, onClose);
  const formId = useId();
  const input = {height: 50, borderRadius: "14px", px: "14px", fontSize: 16} as const;
  return (
    <BottomSheet open onClose={onClose} title="Uredi osobne podatke" closable tall busy={f.saving}>
      <Box
        component="form"
        id={formId}
        noValidate
        onSubmit={f.save}
        aria-busy={f.saving || undefined}
        sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "14px", mx: "-4px", px: "4px", pb: "4px"}}
      >
        {f.formError && (
          <Box ref={f.formErrorRef}>
            <ErrorNote>{f.formError}</ErrorNote>
          </Box>
        )}
        <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px", alignItems: "start"}}>
          <Field label="Ime" error={f.errors.first_name}>
            {(a11y) => <TextInput {...a11y} {...f.fieldProps("first_name")} type="text" maxLength={100} soft sx={input} />}
          </Field>
          <Field label="Prezime" error={f.errors.last_name}>
            {(a11y) => <TextInput {...a11y} {...f.fieldProps("last_name")} type="text" maxLength={100} soft sx={input} />}
          </Field>
        </Box>
        <Field label="Korisničko ime" error={f.errors.username}>
          {(a11y) => <TextInput {...a11y} {...f.fieldProps("username")} type="text" autoCapitalize="none" soft sx={input} />}
        </Field>
        <Field label="Email" error={f.errors.email}>
          {(a11y) => <TextInput {...a11y} {...f.fieldProps("email")} type="email" maxLength={100} soft sx={input} />}
        </Field>
        <Field label="Mobitel" error={f.errors.phone}>
          {(a11y) => (
            <TextInput
              {...a11y}
              {...f.fieldProps("phone")}
              type="tel"
              inputMode="tel"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => f.change("phone", phoneInput(e.target.value))}
              soft
              sx={input}
            />
          )}
        </Field>
        <Field label="Datum rođenja" error={f.errors.birth_date}>
          {(a11y) => <TextInput {...a11y} {...f.fieldProps("birth_date")} type="date" min="1900-01-01" max={leagueDateString()} soft sx={input} />}
        </Field>
        <SwitchRow
          checked={f.draft.smoker}
          disabled={f.saving}
          onChange={(v) => f.change("smoker", v)}
          sx={{minHeight: 56, flex: "none", px: "14px", borderRadius: "14px", borderBottom: "none", background: color.paper2, fontSize: 16, fontWeight: 600, color: color.ink, "& svg": {fontSize: 20, color: color.navy}}}
        >
          Pušač
          <SmokingRoomsRoundedIcon aria-hidden />
        </SwitchRow>
      </Box>
      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
        <OutlineButton height={54} onClick={onClose} disabled={f.saving} sx={{fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
          Odustani
        </OutlineButton>
        <SolidButton type="submit" form={formId} height={54} loading={f.saving} sx={{fontSize: 16}}>
          Spremi
        </SolidButton>
      </Box>
    </BottomSheet>
  );
}

// the shield next to an admin's name on the phone hero
export function AdminNameTag() {
  return (
    <Box component="span" sx={{height: 22, display: "inline-flex", alignItems: "center", gap: "3px", px: "7px", borderRadius: "7px", background: color.navy, color: color.white, fontSize: 11.5, fontWeight: 700, "& svg": {fontSize: 14}}}>
      <AdminPanelSettingsRoundedIcon aria-hidden />
      Admin
    </Box>
  );
}
