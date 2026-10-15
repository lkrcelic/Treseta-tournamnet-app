"use client";

import {getLeagueNotesAPI, saveLeagueNotesAPI} from "@/app/_fetchers/league/leagues";
import {color, shadow} from "@/app/_styles/tokens";
import {mergeSx, SectionLabel} from "@/app/_ui/sp";
import CloudDoneRoundedIcon from "@mui/icons-material/CloudDoneRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import {Box, SxProps, Theme} from "@mui/material";
import {useEffect, useId, useRef, useState} from "react";

const SAVE_DELAY_MS = 600;

// loadError: the notes couldn't be read, so the box stays locked (typing would overwrite notes it never saw)
type Status = "loading" | "loadError" | "saved" | "saving" | "error";

// Novo kolo · Bilješke: the admins' notes for a league (who's away next week, table changes, reminders). Saved on
// their own a moment after typing stops; whatever is still waiting goes out when the view closes. The phone's Večer
// lige and Novo kolo call them "Bilješke lige" and give the box its own height (sx).
export default function LeagueNotes({leagueId, label = "Bilješke", sx}: {leagueId: number; label?: string; sx?: SxProps<Theme>}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const labelId = useId();
  const timer = useRef<number | undefined>(undefined);
  const unsaved = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeagueNotesAPI(leagueId)
      .then((notes) => {
        if (cancelled) return;
        setText(notes);
        setStatus("saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("loadError");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const save = async (value: string, keepalive = false) => {
    unsaved.current = null;
    try {
      await saveLeagueNotesAPI(leagueId, value, keepalive);
      // a newer edit may be waiting; its own save sets the status
      if (unsaved.current == null) setStatus("saved");
    } catch {
      if (unsaved.current == null) setStatus("error");
    }
  };

  useEffect(() => {
    const flush = () => {
      window.clearTimeout(timer.current);
      if (unsaved.current != null) save(unsaved.current, true);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const onChange = (value: string) => {
    setText(value);
    setStatus("saving");
    unsaved.current = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(value), SAVE_DELAY_MS);
  };

  const state = {
    loading: {icon: <SyncRoundedIcon />, label: "Učitavam…", ink: color.muted},
    loadError: {icon: <CloudOffRoundedIcon />, label: "Nije učitano", ink: color.red},
    saving: {icon: <SyncRoundedIcon />, label: "Spremam…", ink: color.muted},
    saved: {icon: <CloudDoneRoundedIcon />, label: "Spremljeno", ink: color.green},
    error: {icon: <CloudOffRoundedIcon />, label: "Nije spremljeno", ink: color.red},
  }[status];

  return (
    <Box component="section" aria-labelledby={labelId} sx={mergeSx({flex: 1, minHeight: 150, display: "flex", flexDirection: "column", gap: "8px"}, sx)}>
      <Box sx={{px: "6px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px"}}>
        <SectionLabel id={labelId} sx={{px: 0}}>
          {label}
        </SectionLabel>
        <Box component="span" role="status" sx={{display: "flex", alignItems: "center", gap: "4px", fontSize: 12, fontWeight: 600, color: state.ink, "& svg": {fontSize: 16}}}>
          {state.icon}
          {state.label}
        </Box>
      </Box>
      <Box
        component="textarea"
        aria-labelledby={labelId}
        value={text}
        disabled={status === "loading" || status === "loadError"}
        maxLength={5000}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        placeholder="Bilješke za ovu ligu: tko ne dolazi idući tjedan, promjene stolova, podsjetnici…"
        sx={{
          flex: 1,
          minHeight: 0,
          resize: "none",
          border: "1.5px solid transparent",
          borderRadius: "18px",
          background: color.white,
          p: "14px 16px",
          fontFamily: "inherit",
          fontSize: 15,
          lineHeight: 1.5,
          color: color.ink,
          outline: "none",
          boxSizing: "border-box",
          boxShadow: shadow.card,
          "&:focus": {borderColor: color.navy},
          "&::placeholder": {color: color.faint},
        }}
      />
    </Box>
  );
}
