"use client";

import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {ConfirmSheet, ErrorNote, OutlineButton, PrimaryButton} from "@/app/_ui/sp";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box, Dialog} from "@mui/material";
import React, {useId} from "react";

// A change of a finished match's hands the admin confirms first: it leaves the match without a winner (the server's
// NoWinnerWarning), so the match counts for neither team. retry sends the same change again, allowed.
export type NoWinnerAsk = {text: string; action: string; retry: () => void};

export const NO_WINNER_TITLE = "Meč ostaje bez pobjednika?";

// Odustani keeps what was entered, as before the save; the action saves it anyway. On the phone a sheet (as Obriši
// igru), on the computer a dialog (as Obrisati kolo?).
export function NoWinnerConfirm({ask, phone, busy, error, onClose}: {ask: NoWinnerAsk | null; phone: boolean; busy: boolean; error?: string | null; onClose: () => void}) {
  const titleId = useId();
  if (phone) {
    return (
      <ConfirmSheet
        open={ask != null}
        onClose={onClose}
        onConfirm={() => ask?.retry()}
        title={NO_WINNER_TITLE}
        text={ask?.text ?? ""}
        action={ask?.action ?? ""}
        icon={<WarningRoundedIcon />}
        busy={busy}
        error={error}
      />
    );
  }
  if (!ask) return null;
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 520, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.15}}>
        {NO_WINNER_TITLE}
      </Box>
      <Box sx={{display: "flex", gap: "12px", alignItems: "flex-start", p: "14px", borderRadius: "16px", background: tint.red[8], "& > svg": {fontSize: 26, color: color.red, flex: "none"}}}>
        <WarningRoundedIcon aria-hidden />
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink}}>
          {ask.text}
        </Box>
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "flex", gap: "10px"}}>
        <OutlineButton height={52} onClick={onClose} disabled={busy} sx={{flex: 1, fontSize: 16, border: `1.5px solid ${tint.navy[25]}`}}>
          Odustani
        </OutlineButton>
        <PrimaryButton height={52} bg={color.red} onClick={ask.retry} loading={busy} sx={{flex: 1, fontSize: 16, borderRadius: "16px", boxShadow: "none"}}>
          {ask.action}
        </PrimaryButton>
      </Box>
    </Dialog>
  );
}
