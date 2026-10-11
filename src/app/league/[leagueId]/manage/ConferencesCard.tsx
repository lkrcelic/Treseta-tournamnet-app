"use client";

import {saveLeagueConferencesAPI} from "@/app/_fetchers/league/conferences";
import useConferences, {setCachedConferences} from "@/app/_hooks/useConferences";
import {LeagueConferences} from "@/app/_interfaces/league";
import {Conference, conferencesError} from "@/app/_lib/conferences";
import {plural} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {ConferenceDraft, conferenceDraft, ConferenceEditor, startingDrafts} from "@/app/_ui/league/ConferenceEditor";
import {buttonBase, Card, ErrorNote, LoadingRows, OutlineButton, PrimaryButton} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import {useEffect, useState} from "react";

const toDrafts = (list: Conference[]) => list.map((c) => conferenceDraft({conference_id: c.id, name: c.name, color: c.color}));
const shape = (list: {conference_id?: number; name: string; color: string}[]) =>
  JSON.stringify(list.map((c) => [c.conference_id ?? null, c.name.trim(), c.color.toUpperCase()]));

// Manage League: the league's conferences, their names and colors. Adding the first ones gives the league conferences,
// removing them all takes them away. Save replaces the whole list; a conference taken out leaves its teams without
// one, which is asked first. teamCounts: how many of the league's teams each conference has.
export default function ConferencesCard({
  leagueId,
  teamCounts,
  onSaved,
}: {
  leagueId: number;
  teamCounts: Map<number, number>;
  onSaved?: (data: LeagueConferences) => void;
}) {
  const saved = useConferences(leagueId);
  // the list being edited; null until the saved one has loaded
  const [drafts, setDrafts] = useState<ConferenceDraft[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (saved.ready && drafts == null) setDrafts(toDrafts(saved.conferences));
  }, [saved.ready, saved.conferences, drafts]);

  const list = drafts ?? [];
  const dirty = drafts != null && shape(list) !== shape(saved.conferences.map((c) => ({conference_id: c.id, name: c.name, color: c.color})));
  const invalid = conferencesError(list);
  // the saved conferences left out, and how many teams that leaves without one
  const removed = saved.conferences.filter((c) => !list.some((d) => d.conference_id === c.id));
  const orphaned = removed.reduce((n, c) => n + (teamCounts.get(c.id) ?? 0), 0);

  const edit = (next: ConferenceDraft[]) => {
    setDrafts(next);
    setConfirming(false);
    setDone(false);
    setError(null);
  };
  const discard = () => edit(toDrafts(saved.conferences));

  const save = async () => {
    if (!dirty || invalid || saving) return;
    if (orphaned > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await saveLeagueConferencesAPI(
        leagueId,
        list.map((d) => ({conference_id: d.conference_id, name: d.name.trim(), color: d.color}))
      );
      setCachedConferences(leagueId, data);
      setDrafts(data.conferences.map((c) => conferenceDraft(c)));
      setConfirming(false);
      setDone(true);
      onSaved?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konferencije nisu spremljene.");
    }
    setSaving(false);
  };

  return (
    <Card component="section" aria-labelledby="conf-card" sx={{p: "22px", display: "flex", flexDirection: "column", gap: "14px", borderRadius: "24px"}}>
      <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px"}}>
        <Box component="h2" id="conf-card" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
          Conferences
        </Box>
        {list.length > 0 && (
          <Box
            component="button"
            type="button"
            onClick={() => edit([])}
            disabled={saving}
            sx={{...buttonBase, fontSize: 14, fontWeight: 600, color: color.red, borderRadius: "8px", px: "4px", "&:hover": {textDecoration: "underline"}}}
          >
            Remove all
          </Box>
        )}
      </Box>
      <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.inkSoft}}>
        Groups of teams, each with a color: a dot before the team&apos;s name, and its own table on Daily and League Standings.
      </Box>
      {drafts == null ? (
        <LoadingRows rows={2} height={56} />
      ) : list.length === 0 ? (
        <OutlineButton height={50} onClick={() => edit(startingDrafts())} sx={{borderWidth: "1.5px", borderColor: "rgba(60,74,103,.25)", fontSize: 15}}>
          <AddRoundedIcon sx={{fontSize: 22}} />
          Add conferences
        </OutlineButton>
      ) : (
        <ConferenceEditor value={list} onChange={edit} disabled={saving} />
      )}
      {dirty && invalid && list.some((d) => d.name.trim()) && (
        <Box role="alert" sx={{fontSize: 14, fontWeight: 600, color: color.red, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
          <ErrorRoundedIcon />
          {invalid}
        </Box>
      )}
      {confirming && (
        <Box role="alert" sx={{p: "12px 14px", borderRadius: "14px", background: "rgba(188,71,73,.07)", display: "flex", gap: "10px", "& > svg": {fontSize: 22, color: color.red, flex: "none"}}}>
          <WarningRoundedIcon />
          <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.ink}}>
            {removed.map((c) => c.name).join(", ")} {removed.length === 1 ? "has" : "have"} {orphaned} {plural(orphaned, "team", "teams", "teams")}. They will be left
            without a conference. Save again to go ahead.
          </Box>
        </Box>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {(dirty || done) && (
        <Box sx={{display: "flex", gap: "10px"}}>
          <OutlineButton height={52} onClick={discard} disabled={!dirty || saving} sx={{flex: 1, fontSize: 15, border: "1.5px solid rgba(60,74,103,.25)", "&:disabled": {opacity: 0.4}}}>
            Discard
          </OutlineButton>
          <PrimaryButton onClick={save} disabled={!dirty || !!invalid} loading={saving} height={52} sx={{flex: 1, fontSize: 16}}>
            {!dirty && done ? "Saved ✓" : confirming ? "Save anyway" : "Save"}
          </PrimaryButton>
        </Box>
      )}
    </Card>
  );
}
