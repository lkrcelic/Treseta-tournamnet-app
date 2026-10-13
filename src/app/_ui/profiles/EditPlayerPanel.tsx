"use client";

import {refreshUser} from "@/app/_bootstrap/refreshUser";
import {deletePlayerAPI, playerFieldErrors, setPlayerActiveAPI, updateAdminPlayerAPI} from "@/app/_fetchers/admin/players";
import {adminPlayersList} from "@/app/_hooks/useAdminPlayers";
import type {Overview} from "@/app/_hooks/useOverview";
import {teamsList} from "@/app/_hooks/useTeams";
import type {AdminPlayerField} from "@/app/_interfaces/player";
import type {PlayerOverview} from "@/app/_interfaces/profiles";
import {leagueDateString} from "@/app/_lib/dates";
import {startNavStack} from "@/app/_lib/navStack";
import {phoneInput} from "@/app/_lib/phone";
import {neighbourId, removeAdminPlayer, removeMemberEverywhere, setAdminPlayerActive, updateAdminPlayer, updateTeamMember} from "@/app/_lib/ui/directory";
import {draftChanges, draftErrors, firstErrorField, hasChanges, PlayerDraft, playerDraft} from "@/app/_lib/ui/playerAdmin";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, tint} from "@/app/_styles/tokens";
import {buttonBase, ErrorNote, Field, SidePanel, SolidButton, SwitchRow, TextInput} from "@/app/_ui/sp";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import SmokingRoomsRoundedIcon from "@mui/icons-material/SmokingRoomsRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import {usePathname} from "next/navigation";
import React, {useEffect, useId, useRef, useState} from "react";
import {useDirectoryFrame} from "./PageParts";
import {errorText} from "./TeamAdmin";

// "Uredi osobne podatke" (handoff §6 "Admin controls", design 13j, Profiles P:359-390): the panel an admin opens with
// "Uredi podatke" on a desktop Player page. Spremi sends the fields that changed in one request (what is wrong shows
// under its field); the Račun section deactivates, activates or deletes the player, each after its own confirmation,
// at once and apart from Spremi. While Spremi or an account action is on its way the panel stays open, so its outcome
// is seen. An admin editing themself can't take their own admin role and has no Račun section (the server refuses all
// three too).

type Errors = Partial<Record<AdminPlayerField, string>>;

const ADMIN_NOTE = "Administrator upravlja ligama, ekipama, kolima i igračima.";
// an admin editing themself (the switch can't be changed)
const SELF_ADMIN_NOTE = `${ADMIN_NOTE} Svoja administratorska prava ne možeš ukloniti.`;

// Mounted while the panel is open: the form starts from the player as the page shows them (data, the page of overview)
export function EditPlayerPanel({data, overview, onClose}: {data: PlayerOverview; overview: Overview<PlayerOverview>; onClose: () => void}) {
  const player = data.player;
  const self = data.viewer.self;
  const [initial] = useState(() => playerDraft(player));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // a Račun action is on its way
  const [accountBusy, setAccountBusy] = useState(false);
  const busy = saving || accountBusy;
  const formId = useId();
  const inputs = useRef<Partial<Record<AdminPlayerField, HTMLInputElement | null>>>({});
  const formErrorRef = useRef<HTMLDivElement>(null);

  // typing in a field clears what was said about it
  const change = <K extends keyof PlayerDraft>(field: K, value: PlayerDraft[K]) => {
    setDraft((d) => ({...d, [field]: value}));
    setErrors((e) => (e[field as AdminPlayerField] ? {...e, [field]: undefined} : e));
  };
  const focusField = (field: AdminPlayerField) => {
    const input = inputs.current[field];
    input?.focus();
    input?.select?.();
  };

  useEffect(() => {
    if (formError) formErrorRef.current?.scrollIntoView({block: "nearest"});
  }, [formError]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const changes = draftChanges(initial, draft);
    // a date input with a part of the date missing gives "" as if it were emptied
    const found = draftErrors(changes, {birthDateIncomplete: inputs.current.birth_date?.validity.badInput === true});
    const first = firstErrorField(found);
    if (first) {
      setErrors(found);
      setFormError(null);
      focusField(first);
      return;
    }
    if (!hasChanges(changes)) {
      onClose();
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const view = await updateAdminPlayerAPI(player.id, changes);
      overview.setData((d) => ({...d, player: view}));
      adminPlayersList.update((list) => updateAdminPlayer(list, view));
      teamsList.update((list) => updateTeamMember(list, {id: view.id, first_name: view.first_name, last_name: view.last_name, username: view.username}));
      // the Team chips and the rating come again with the page; an admin who changed their own username sees it in
      // the menu's user card
      overview.reload();
      if (self) void refreshUser();
      onClose();
    } catch (err) {
      const fields = playerFieldErrors(err);
      const field = firstErrorField(fields);
      setErrors(fields);
      if (field) focusField(field);
      else setFormError(errorText(err, "Promjena nije spremljena."));
      setSaving(false);
    }
  };

  const fieldProps = (field: AdminPlayerField) => ({
    ref: (el: HTMLInputElement | null) => {
      inputs.current[field] = el;
    },
    name: field,
    value: draft[field],
    readOnly: saving,
    autoComplete: "off",
    spellCheck: false,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => change(field, e.target.value),
  });

  return (
    <SidePanel
      open
      onClose={onClose}
      busy={busy}
      title="Uredi osobne podatke"
      sub={player.name}
      footer={
        <>
          <Box component="button" type="button" onClick={onClose} disabled={busy} sx={{...outlineButton, height: 50, borderRadius: "14px", fontSize: 16}}>
            Odustani
          </Box>
          <SolidButton type="submit" form={formId} loading={saving} disabled={accountBusy} height={50} sx={{borderRadius: "14px", fontSize: 16}}>
            Spremi
          </SolidButton>
        </>
      }
    >
      <Box component="form" id={formId} onSubmit={save} noValidate aria-busy={saving || undefined} sx={{display: "flex", flexDirection: "column", gap: "14px"}}>
        {formError && (
          <Box ref={formErrorRef}>
            <ErrorNote sx={{p: "10px 12px", borderRadius: "12px", fontSize: 14}}>{formError}</ErrorNote>
          </Box>
        )}
        <Pair>
          <PanelField label="Ime" error={errors.first_name}>
            {(a11y) => <TextInput {...a11y} {...fieldProps("first_name")} type="text" maxLength={100} soft sx={panelInput} />}
          </PanelField>
          <PanelField label="Prezime" error={errors.last_name}>
            {(a11y) => <TextInput {...a11y} {...fieldProps("last_name")} type="text" maxLength={100} soft sx={panelInput} />}
          </PanelField>
        </Pair>
        <PanelField label="Korisničko ime" error={errors.username}>
          {(a11y) => <TextInput {...a11y} {...fieldProps("username")} type="text" autoCapitalize="none" soft sx={panelInput} />}
        </PanelField>
        <PanelField label="Email" error={errors.email}>
          {(a11y) => <TextInput {...a11y} {...fieldProps("email")} type="email" maxLength={100} soft sx={panelInput} />}
        </PanelField>
        <Pair>
          <PanelField label="Mobitel" error={errors.phone}>
            {(a11y) => (
              <TextInput
                {...a11y}
                {...fieldProps("phone")}
                type="tel"
                inputMode="tel"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => change("phone", phoneInput(e.target.value))}
                soft
                sx={panelInput}
              />
            )}
          </PanelField>
          <PanelField label="Datum rođenja" error={errors.birth_date}>
            {(a11y) => <TextInput {...a11y} {...fieldProps("birth_date")} type="date" min="1900-01-01" max={leagueDateString()} soft sx={panelInput} />}
          </PanelField>
        </Pair>
        <PanelSwitch checked={draft.smoker} disabled={saving} onChange={(v) => change("smoker", v)} icon={<SmokingRoomsRoundedIcon aria-hidden />}>
          Pušač
        </PanelSwitch>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
          {/* an admin can't take their own role (the server refuses it too) */}
          <PanelSwitch checked={draft.is_admin} disabled={saving || self} onChange={(v) => change("is_admin", v)} icon={<AdminPanelSettingsRoundedIcon aria-hidden />}>
            Admin
          </PanelSwitch>
          <Box sx={note}>{self ? SELF_ADMIN_NOTE : ADMIN_NOTE}</Box>
        </Box>
      </Box>
      {!self && <AccountSection player={player} overview={overview} busy={accountBusy} setBusy={setAccountBusy} />}
    </SidePanel>
  );
}

// ---------- the fields ----------

const panelInput = {height: 48, borderRadius: "12px", px: "12px", fontSize: 15} as const;

const note = {pl: "4px", fontSize: 12.5, lineHeight: 1.4, color: color.muted} as const;

function Pair({children}: {children: React.ReactNode}) {
  return <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px", alignItems: "start"}}>{children}</Box>;
}

// A label over its input (13 px, as the panel's design), the message under it when the value is refused
const panelText = {fontSize: 13, pl: 0} as const;

function PanelField({label, error, children}: {label: string; error?: string; children: React.ComponentProps<typeof Field>["children"]}) {
  return (
    <Field label={label} error={error} labelSx={panelText} errorSx={panelText}>
      {children}
    </Field>
  );
}

// "Pušač" / "Admin" (P:368-369): the word with its icon after it, and the switch at the end of the row
function PanelSwitch({
  checked,
  disabled,
  onChange,
  icon,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SwitchRow
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      sx={{
        minHeight: 56,
        flex: "none",
        px: "14px",
        borderRadius: "14px",
        borderBottom: "none",
        background: color.paper2,
        fontSize: 15,
        fontWeight: 600,
        color: color.ink,
        "& svg": {fontSize: 20, color: color.navy},
      }}
    >
      {children}
      {icon}
    </SwitchRow>
  );
}

// ---------- Račun ----------

const outlineButton = {
  ...buttonBase,
  height: 46,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  border: `1.5px solid ${color.borderControl}`,
  borderRadius: "12px",
  background: color.white,
  color: color.navy,
  fontSize: 14,
  fontWeight: 600,
  transition: "background 150ms ease",
  "&:hover:not(:disabled)": {background: color.paper},
  "&:disabled": {cursor: "default", opacity: 0.5},
  "& svg": {fontSize: 20},
} as const;

type Ask = "active" | "delete";

// The account actions (P:372-385): Deaktiviraj račun / Aktiviraj račun and Obriši igrača, each replaced by its
// confirmation box until it is confirmed or cancelled; both apply at once. busy (the panel's): one is on its way.
function AccountSection({
  player,
  overview,
  busy,
  setBusy,
}: {
  player: PlayerOverview["player"];
  overview: Overview<PlayerOverview>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useTransitionRouter();
  const pathname = usePathname();
  const frame = useDirectoryFrame();
  const labelId = useId();
  // the focus goes into the confirmation and back to the button that opened it
  const activeRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Ask | null>(null);
  // a delete that answers after the panel has gone (another player picked meanwhile) leaves the page alone
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (ask) {
      // the whole box comes into view (at the bottom of the panel's body), not just its Odustani
      confirmRef.current?.scrollIntoView({block: "nearest"});
      cancelRef.current?.focus({preventScroll: true});
    } else if (returnTo.current) {
      (returnTo.current === "delete" ? deleteRef : activeRef).current?.focus();
      returnTo.current = null;
    }
  }, [ask]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({block: "nearest"});
  }, [error]);

  const open = (which: Ask) => {
    setError(null);
    setAsk(which);
  };
  const cancel = () => {
    if (busy) return;
    returnTo.current = ask;
    setAsk(null);
  };

  const confirm = async () => {
    if (!ask || busy) return;
    setBusy(true);
    setError(null);
    if (ask === "active") {
      const active = !player.active;
      try {
        await setPlayerActiveAPI(player.id, active);
        overview.setData((d) => ({...d, player: {...d.player, active}}));
        adminPlayersList.update((list) => setAdminPlayerActive(list, player.id, active));
        overview.reload();
        returnTo.current = "active";
        setAsk(null);
      } catch (e) {
        setError(errorText(e, "Promjena nije spremljena."));
      }
      setBusy(false);
      return;
    }
    try {
      await deletePlayerAPI(player.id);
    } catch (e) {
      if (!mounted.current) return;
      setError(errorText(e, "Igrač nije obrisan."));
      setBusy(false);
      return;
    }
    // the page is still the deleted player's (the admin hasn't picked another one in the list meanwhile)
    const here = mounted.current && window.location.pathname === pathname;
    // where the directory goes: the next player the list shows (asked while it still has the deleted one)
    const next = !here ? null : frame ? frame.nextAfterDelete(player.id) : neighbourId(adminPlayersList.peek() ?? [], player.id);
    adminPlayersList.update((list) => removeAdminPlayer(list, player.id));
    teamsList.update((list) => removeMemberEverywhere(list, player.id));
    if (!here) return;
    // the player's page is gone: the next one opens in its place, as picked from the list (no Back to the deleted one)
    const to = next != null ? `/players/${next}` : "/players";
    startNavStack(to, pathname);
    router.replace(to, "morph");
  };

  const confirmation = ask && CONFIRM[ask === "delete" ? "delete" : player.active ? "deactivate" : "activate"];

  return (
    <Box
      component="section"
      aria-labelledby={labelId}
      sx={{flex: "none", display: "flex", flexDirection: "column", gap: "10px", mt: "6px", pt: "16px", borderTop: `1px solid ${color.line}`}}
    >
      <Box component="h3" id={labelId} sx={{m: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
        Račun
      </Box>
      {confirmation ? (
        <Box
          ref={confirmRef}
          role="group"
          aria-labelledby={`${labelId}-title`}
          aria-describedby={`${labelId}-text`}
          onKeyDown={(e: React.KeyboardEvent) => {
            // Escape cancels the confirmation, not the whole panel (SidePanel leaves a prevented Escape alone)
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          sx={{display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "14px", background: confirmation.danger ? tint.red[8] : color.paper2}}
        >
          <Box sx={{display: "flex", gap: "10px", alignItems: "flex-start"}}>
            <Box component="span" sx={{flex: "none", display: "flex", color: confirmation.danger ? color.red : color.navy, "& svg": {fontSize: 22}}}>
              {confirmation.danger ? <WarningRoundedIcon aria-hidden /> : <BlockRoundedIcon aria-hidden />}
            </Box>
            <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
              <Box component="span" id={`${labelId}-title`} sx={{fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: color.ink, overflowWrap: "anywhere"}}>
                {confirmation.title(player.name)}
              </Box>
              <Box component="span" id={`${labelId}-text`} sx={{fontSize: 13, lineHeight: 1.45, color: color.ink2}}>
                {confirmation.text}
              </Box>
            </Box>
          </Box>
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "8px"}}>
            <Box component="button" type="button" ref={cancelRef} onClick={cancel} disabled={busy} sx={{...outlineButton, height: 42}}>
              Odustani
            </Box>
            <SolidButton
              height={42}
              loading={busy}
              onClick={confirm}
              sx={{borderRadius: "12px", fontSize: 14, background: confirmation.danger ? color.red : color.navy}}
            >
              {confirmation.button}
            </SolidButton>
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
            <Box component="button" type="button" ref={activeRef} onClick={() => open("active")} sx={outlineButton}>
              {player.active ? <BlockRoundedIcon aria-hidden /> : <HowToRegRoundedIcon aria-hidden />}
              {player.active ? "Deaktiviraj račun" : "Aktiviraj račun"}
            </Box>
            <Box
              component="button"
              type="button"
              ref={deleteRef}
              onClick={() => open("delete")}
              sx={{...outlineButton, borderColor: tint.red[35], color: color.red, "&:hover:not(:disabled)": {background: tint.red[6]}}}
            >
              <DeleteRoundedIcon aria-hidden />
              Obriši igrača
            </Box>
          </Box>
          <Box sx={{fontSize: 12.5, lineHeight: 1.45, color: color.muted}}>
            {player.active
              ? "Deaktivirani igrač se ne može prijaviti, ali njegovi rezultati i rejting ostaju. Brisanje je trajno."
              : "Račun je deaktiviran: igrač se ne može prijaviti i ne nudi se pri sastavljanju ekipa."}
          </Box>
        </>
      )}
      {error && (
        <Box ref={errorRef}>
          <ErrorNote sx={{p: "10px 12px", borderRadius: "12px", fontSize: 14}}>{error}</ErrorNote>
        </Box>
      )}
    </Box>
  );
}

// The confirmations' copy (P:409-416)
const CONFIRM = {
  deactivate: {
    danger: false,
    title: () => "Deaktivirati račun?",
    text: "Igrač se neće moći prijaviti dok ga ne aktiviraš. Rezultati i rejting ostaju.",
    button: "Deaktiviraj",
  },
  activate: {
    danger: false,
    title: () => "Aktivirati račun?",
    text: "Igrač se ponovno može prijaviti i igrati.",
    button: "Aktiviraj",
  },
  delete: {
    danger: true,
    title: (name: string) => `Obrisati igrača ${name}?`,
    text: "Igrač se uklanja iz svih ekipa i ne može se prijaviti. Odigrana kola ostaju u poretku, a ime se zamjenjuje s „Obrisani igrač”. Ovo se ne može poništiti.",
    button: "Obriši trajno",
  },
} as const;
