"use client";

import {renameLeagueAPI} from "@/app/_fetchers/league/leagues";
import {LeagueOption, renameCachedLeague} from "@/app/_hooks/useLeagues";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, Card, ErrorNote, TextInput} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import {Box} from "@mui/material";
import {useId, useState} from "react";

// Manage League · League name: shows the name and renames it in place. The name can't be empty or the name of
// another league (any case); Save stays off until the name changes.
export default function LeagueNameCard({leagueId, leagues}: {leagueId: number; leagues: LeagueOption[]}) {
  const name = leagues.find((l) => l.id === leagueId)?.name ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const errorId = useId();

  const editing = draft != null;
  const trimmed = (draft ?? "").trim();
  const duplicate = trimmed !== "" && leagues.some((l) => l.id !== leagueId && l.name.toLowerCase() === trimmed.toLowerCase());
  const error = !editing ? "" : !trimmed ? "League name is required." : duplicate ? "Another league already has this name." : "";
  const canSave = editing && !error && trimmed !== name && !saving;

  const start = () => {
    setDraft(name);
    setSaved(false);
    setServerError(null);
  };
  const cancel = () => {
    setDraft(null);
    setServerError(null);
  };
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setServerError(null);
    try {
      await renameLeagueAPI(leagueId, trimmed);
      renameCachedLeague(leagueId, trimmed);
      setDraft(null);
      setSaved(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Naziv lige nije spremljen.");
    } finally {
      setSaving(false);
    }
  };

  const small = {...buttonBase, height: 46, borderRadius: "12px", fontSize: 15, fontWeight: 600} as const;

  return (
    <Card component="section" aria-labelledby="league-name" sx={{flex: "none", p: "20px", display: "flex", flexDirection: "column", gap: "10px", borderRadius: "24px"}}>
      <Box component="h2" id="league-name" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
        League name
      </Box>
      {editing ? (
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          sx={{display: "flex", flexDirection: "column", gap: "10px"}}
        >
          <TextInput
            autoFocus
            aria-label="League name"
            placeholder="League name"
            value={draft}
            maxLength={100}
            onChange={(e) => {
              setDraft(e.target.value);
              setServerError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            sx={{height: 50, borderRadius: "14px", fontSize: 16, px: "14px", borderColor: error ? color.red : color.navy}}
          />
          {error && (
            <Box id={errorId} sx={{fontSize: 13, fontWeight: 600, color: color.red}}>
              {error}
            </Box>
          )}
          {serverError && <ErrorNote>{serverError}</ErrorNote>}
          <Box sx={{fontSize: 13, color: color.muted}}>Shown on standings, pairings and the league selector.</Box>
          <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
            <Box component="button" type="button" onClick={cancel} sx={{...small, border: "1.5px solid rgba(60,74,103,.2)", background: color.card, color: color.navy}}>
              Cancel
            </Box>
            <Box
              component="button"
              type="submit"
              disabled={!canSave}
              aria-busy={saving || undefined}
              sx={{...small, background: color.navy, color: "#FFFFFF", opacity: canSave || saving ? 1 : 0.4}}
            >
              {saving ? "Saving…" : "Save name"}
            </Box>
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
            <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.3, textWrap: "pretty", overflowWrap: "anywhere"}}>
              {name}
            </Box>
            <Box
              component="button"
              type="button"
              onClick={start}
              disabled={!name}
              sx={{...buttonBase, height: 44, flex: "none", display: "flex", alignItems: "center", gap: "6px", px: "14px", border: "1.5px solid rgba(60,74,103,.2)", borderRadius: "12px", background: color.card, color: color.navy, fontSize: 14, fontWeight: 600, "& svg": {fontSize: 20}}}
            >
              <EditRoundedIcon />
              Rename
            </Box>
          </Box>
          <Box role="status" sx={{display: "contents"}}>
            {saved && (
              <Box sx={{fontSize: 13, fontWeight: 600, color: color.green, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
                <CheckCircleRoundedIcon />
                Name saved
              </Box>
            )}
          </Box>
        </>
      )}
    </Card>
  );
}
