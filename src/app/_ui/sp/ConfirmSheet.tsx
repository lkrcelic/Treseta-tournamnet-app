import {color, tint} from "@/app/_styles/tokens";
import {Box} from "@mui/material";
import React from "react";
import {buttonBase} from "./base";
import {BottomSheet} from "./Sheet";
import {ErrorNote, Spinner} from "./States";

// "Obrisati kolo?" and the admin's other confirmations on the phone (admin-mobile 08, 10, 17, 22, 38, 39): what will
// happen in a tinted box with its icon, then Odustani and the action. danger (the default) is red, for what can't be
// taken back; otherwise navy (Aktivirati račun?). busy: the action is on its way, so nothing can be pressed or closed
// until it answers; error: it failed, and the sheet stays open to try again. extra: a control under the text that goes
// with the action (Maknuti sliku?'s "Zabrani i novu sliku").
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  text,
  action,
  icon,
  danger = true,
  busy = false,
  error,
  eyebrow,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: React.ReactNode;
  action: string;
  icon: React.ReactNode;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  eyebrow?: string;
  extra?: React.ReactNode;
}) {
  const ink = danger ? color.red : color.navy;
  return (
    <BottomSheet open={open} onClose={onClose} title={title} eyebrow={eyebrow} closable busy={busy}>
      <Box
        sx={{
          flex: "none",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
          p: "14px",
          borderRadius: "16px",
          background: danger ? tint.red[8] : color.paper,
          "& > svg": {fontSize: 26, color: ink, flex: "none"},
        }}
      >
        {icon}
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink, textWrap: "pretty", minWidth: 0}}>
          {text}
        </Box>
      </Box>
      {extra}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
        <Box
          component="button"
          type="button"
          onClick={onClose}
          disabled={busy}
          sx={{
            ...buttonBase,
            height: 54,
            border: `1.5px solid ${color.borderControl}`,
            borderRadius: "16px",
            background: color.white,
            color: color.navy,
            fontSize: 16,
            fontWeight: 600,
            "&:disabled": {opacity: 0.5},
          }}
        >
          Odustani
        </Box>
        <Box
          component="button"
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy || undefined}
          sx={{
            ...buttonBase,
            height: 54,
            borderRadius: "16px",
            background: ink,
            color: color.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: 16,
            fontWeight: 600,
            transition: "transform 120ms ease",
            "&:active:not(:disabled)": {transform: "scale(.98)"},
          }}
        >
          {busy && <Spinner size={18} tone="white" />}
          {action}
        </Box>
      </Box>
    </BottomSheet>
  );
}
