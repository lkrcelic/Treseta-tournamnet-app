"use client";

import {searchPlayersAPI} from "@/app/_fetchers/player/search";
import {fullName, MTPlayer, MTTeam, playerCount, playerRole, teamSubtitle} from "@/app/_lib/ui/manageTeam";
import {color, font, shadow} from "@/app/_styles/tokens";
import {
  buttonBase,
  Card,
  ellipsis,
  EmptyState,
  ErrorNote,
  GhostIconButton,
  InitialsAvatar,
  LoadingRows,
  LoadMoreButton,
  OutlineButton,
  SearchInput,
  SolidButton,
  Spinner,
  TextField,
  TextInput,
} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useEffect, useId, useRef, useState} from "react";

const cardSx = {borderRadius: "24px", p: {xs: "20px", lg: "24px"}, display: "flex", flexDirection: "column", gap: "14px"} as const;
const cardTitleSx = {m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800} as const;

// Left column: search, "New team" and every team
export function TeamList({
  teams,
  error,
  onRetry,
  query,
  onQuery,
  selectedId,
  isNew,
  onSelect,
  onNew,
  sx,
}: {
  teams: MTTeam[] | null;
  error: string | null;
  onRetry: () => void;
  query: string;
  onQuery: (q: string) => void;
  selectedId: number | null;
  isNew: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  sx?: SxProps<Theme>;
}) {
  // 12 teams at a time; a new search starts from the first 12, and the selected team is always in view
  const [pages, setPages] = useState(1);
  useEffect(() => setPages(1), [query]);
  const selectedAt = teams && !isNew && selectedId != null ? teams.findIndex((t) => t.id === selectedId) : -1;
  const shown = teams?.slice(0, Math.max(12 * pages, selectedAt + 1)) ?? [];
  const left = (teams?.length ?? 0) - shown.length;

  return (
    <Card component="section" aria-label="Ekipe" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px", ...sx}}>
      <Box sx={{flex: "none", p: "14px", borderBottom: `1px solid rgba(60,74,103,.1)`, display: "flex", flexDirection: "column", gap: "10px"}}>
        <SearchInput soft height={46} placeholder="Search teams or players" aria-label="Traži ekipe ili igrače" value={query} onChange={(e) => onQuery(e.target.value)} />
        <Box
          component="button"
          type="button"
          onClick={onNew}
          aria-pressed={isNew}
          sx={{
            ...buttonBase,
            height: 48,
            borderRadius: "14px",
            background: isNew ? color.navy : color.paper,
            color: isNew ? "#FFFFFF" : color.navy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: 15,
            fontWeight: 600,
            "& svg": {fontSize: 22},
          }}
        >
          <GroupAddRoundedIcon />
          New team
        </Box>
      </Box>
      {error ? (
        <ErrorNote onRetry={onRetry} sx={{m: "14px"}}>
          {error}
        </ErrorNote>
      ) : teams == null ? (
        <LoadingRows rows={8} height={60} />
      ) : teams.length === 0 ? (
        <EmptyState>{query ? "Nijedna ekipa ne odgovara pretrazi." : "Još nema ekipa."}</EmptyState>
      ) : (
        <Box component="ul" sx={{listStyle: "none", m: 0, flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable", p: "6px"}}>
          {shown.map((t) => {
            const on = !isNew && t.id === selectedId;
            return (
              <li key={t.id}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-current={on ? "true" : undefined}
                  sx={{
                    ...buttonBase,
                    width: "100%",
                    height: 60,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    px: "12px",
                    borderRadius: "14px",
                    background: on ? color.paper : "transparent",
                    textAlign: "left",
                    "&:hover": {background: color.paper},
                  }}
                >
                  <Box
                    component="span"
                    aria-hidden
                    sx={{width: 38, height: 38, flex: "none", borderRadius: "12px", background: on ? color.navy : color.cream, color: on ? "#FFFFFF" : color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 20}}}
                  >
                    <GroupsRoundedIcon />
                  </Box>
                  <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                    <Box component="span" sx={{fontSize: 15, fontWeight: 600, color: color.ink, ...ellipsis}}>
                      {t.name}
                    </Box>
                    <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                      {teamSubtitle(t)}
                    </Box>
                  </Box>
                </Box>
              </li>
            );
          })}
          {left > 0 && (
            <Box component="li" sx={{pt: "6px"}}>
              <LoadMoreButton left={left} noun={["team", "teams"]} onClick={() => setPages(Math.ceil(shown.length / 12) + 1)} sx={{borderRadius: "14px"}} />
            </Box>
          )}
        </Box>
      )}
    </Card>
  );
}

// Name of the selected team (rename) or of the new team (create), and the leagues the team plays in
export function NameCard({
  isNew,
  name,
  onName,
  nameError,
  canCancel,
  canSave,
  saveLabel,
  saving,
  onCancel,
  onSave,
  team,
  error,
}: {
  isNew: boolean;
  name: string;
  onName: (v: string) => void;
  nameError: string;
  canCancel: boolean;
  canSave: boolean;
  saveLabel: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  team: MTTeam | null;
  error: string | null;
}) {
  const titleId = useId();
  return (
    <Card component="section" aria-labelledby={titleId} sx={cardSx}>
      <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
        <Box component="h2" id={titleId} sx={cardTitleSx}>
          {isNew ? "New team" : "Team name"}
        </Box>
        {isNew && (
          <Box component="span" sx={{height: 24, px: "10px", borderRadius: "12px", background: color.cream, color: color.navy, fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", display: "flex", alignItems: "center"}}>
            New
          </Box>
        )}
      </Box>
      <Box
        component="form"
        noValidate
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          if (canSave && !saving) onSave();
        }}
        sx={{display: "flex", flexDirection: "column", gap: "14px"}}
      >
        <TextField
          label="Name"
          placeholder="Enter team name"
          soft
          value={name}
          onChange={(e) => onName(e.target.value)}
          error={nameError || undefined}
          maxLength={100}
          autoComplete="off"
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Box sx={{display: "flex", gap: "10px"}}>
          <OutlineButton height={52} onClick={onCancel} disabled={!canCancel || saving} sx={{flex: 1, fontSize: 16, border: `1.5px solid rgba(60,74,103,.25)`}}>
            Cancel
          </OutlineButton>
          <SolidButton type="submit" height={52} disabled={!canSave} loading={saving} sx={{flex: 1, fontSize: 16}}>
            {saveLabel}
          </SolidButton>
        </Box>
      </Box>
      {team && (
        <Box sx={{display: "flex", flexDirection: "column", gap: "8px", pt: "6px", borderTop: `1px solid rgba(60,74,103,.1)`}}>
          <Box component="h3" sx={{m: 0, p: "8px 4px 0", fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
            Leagues
          </Box>
          {team.leagues.length === 0 ? (
            <Box sx={{px: "4px", fontSize: 14, color: color.muted}}>Not in any league yet. Add it in Manage League.</Box>
          ) : (
            <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: "8px"}}>
              {team.leagues.map((l) => (
                <Box component="li" key={l.id} sx={{height: 34, display: "flex", alignItems: "center", gap: "8px", px: "12px", borderRadius: "17px", background: color.paper, fontSize: 14, fontWeight: 600}}>
                  {l.name}
                  <Box component="span" sx={{fontSize: 12, fontWeight: 700, color: l.active ? color.green : color.faint}}>
                    {l.active ? "Active" : "Inactive"}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Card>
  );
}

// The team's players, with remove buttons, and the search that adds new ones
export function TeammatesCard({
  team,
  players,
  highlight,
  busyId,
  onAdd,
  onRemove,
  error,
}: {
  team: {founders: number[]};
  players: MTPlayer[];
  highlight: number | null;
  busyId: number | null;
  onAdd: (p: MTPlayer) => void;
  onRemove: (p: MTPlayer) => void;
  error: string | null;
}) {
  const titleId = useId();
  return (
    <Card component="section" aria-labelledby={titleId} sx={cardSx}>
      <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px"}}>
        <Box component="h2" id={titleId} sx={cardTitleSx}>
          Teammates
        </Box>
        <Box sx={{fontSize: 14, color: color.muted}}>{playerCount(players.length)}</Box>
      </Box>
      {players.length === 0 ? (
        <Box sx={{p: "18px 16px", borderRadius: "16px", border: `1.5px dashed rgba(60,74,103,.22)`, fontSize: 14, color: color.muted}}>
          No teammates yet. Search below to add players.
        </Box>
      ) : (
        <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", border: `1px solid rgba(60,74,103,.1)`, borderRadius: "16px", overflow: "hidden"}}>
          {players.map((p, i) => {
            const name = fullName(p);
            return (
              <Box
                component="li"
                key={p.id}
                sx={{
                  minHeight: 60,
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  p: "0 8px 0 14px",
                  borderTop: i ? `1px solid rgba(60,74,103,.07)` : "none",
                  background: p.id === highlight ? color.creamSoft : "transparent",
                  transition: "background 600ms ease",
                }}
              >
                <InitialsAvatar name={name || p.username} size={38} />
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                  <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
                    {p.username}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {playerRole(team, p.id)}
                    {name && ` · ${name}`}
                  </Box>
                </Box>
                <GhostIconButton
                  label={`Ukloni ${p.username} iz ekipe`}
                  onClick={() => onRemove(p)}
                  disabled={busyId === p.id}
                  sx={{borderRadius: "12px", color: color.muted, "&:hover": {background: color.paper, color: color.red}}}
                >
                  {busyId === p.id ? <Spinner size={20} /> : <PersonRemoveRoundedIcon />}
                </GhostIconButton>
              </Box>
            );
          })}
        </Box>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <TeammateSearch exclude={players.map((p) => p.id)} onAdd={onAdd} />
    </Card>
  );
}

// "Add teammate": search as you type, every hit has an add button
function TeammateSearch({exclude, onAdd}: {exclude: number[]; onAdd: (p: MTPlayer) => void}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MTPlayer[] | null>(null);
  const [failed, setFailed] = useState(false);
  // hits are shown 4 at a time; a new search starts from the first 4
  const [pages, setPages] = useState(1);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const q = query.trim();

  useEffect(() => {
    setPages(1);
    if (!q) {
      // a search still on its way must not fill the list under the empty box
      reqId.current++;
      setHits(null);
      return;
    }
    const rid = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchPlayersAPI(q);
        if (rid !== reqId.current) return;
        setHits(found as MTPlayer[]);
        setFailed(false);
      } catch {
        if (rid === reqId.current) setFailed(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const available = (hits ?? []).filter((p) => !exclude.includes(p.id));
  const shown = available.slice(0, 4 * pages);
  const left = available.length - shown.length;
  const add = (p: MTPlayer) => {
    onAdd(p);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "6px", pt: "4px"}}>
      <Box component="label" htmlFor={inputId} sx={{fontSize: 14, fontWeight: 600, color: color.inkSoft, pl: "4px"}}>
        Add teammate
      </Box>
      <Box sx={{position: "relative"}}>
        <PersonSearchRoundedIcon aria-hidden sx={{position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: 24, color: color.muted, pointerEvents: "none"}} />
        <TextInput
          ref={inputRef}
          id={inputId}
          type="search"
          soft
          placeholder="Search players"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the only hit
            if (e.key === "Enter" && shown.length === 1) {
              e.preventDefault();
              add(shown[0]);
            }
          }}
          sx={{height: 52, pl: "48px", fontSize: 16}}
        />
      </Box>
      {q && (
        <Box role="region" aria-live="polite" aria-label="Pronađeni igrači" sx={{display: "flex", flexDirection: "column", border: `1px solid rgba(60,74,103,.12)`, borderRadius: "16px", overflow: "hidden", boxShadow: shadow.popover}}>
          {failed ? (
            <Box sx={{p: "16px 14px", fontSize: 14, color: color.red}}>Igrače nije moguće dohvatiti.</Box>
          ) : hits == null ? (
            <Box sx={{p: "14px", display: "flex", justifyContent: "center"}}>
              <Spinner size={20} label="Tražim igrače" />
            </Box>
          ) : shown.length === 0 ? (
            <Box sx={{p: "16px 14px", fontSize: 14, color: color.muted}}>No players found.</Box>
          ) : (
            shown.map((p, i) => {
              const name = fullName(p);
              return (
                <Box key={p.id} sx={{minHeight: 56, display: "flex", alignItems: "center", gap: "12px", p: "0 8px 0 14px", borderTop: i ? `1px solid rgba(60,74,103,.07)` : "none", background: color.card}}>
                  <InitialsAvatar name={name || p.username} size={34} />
                  <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                    <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
                      {p.username}
                    </Box>
                    {name && (
                      <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                        {name}
                      </Box>
                    )}
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Dodaj ${p.username} u ekipu`}
                    onClick={() => add(p)}
                    sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", background: color.navy, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 24}}}
                  >
                    <AddRoundedIcon />
                  </Box>
                </Box>
              );
            })
          )}
          {!failed && left > 0 && (
            <LoadMoreButton left={left} noun={["player", "players"]} onClick={() => setPages((n) => n + 1)} sx={{borderTop: `1px solid rgba(60,74,103,.07)`}} />
          )}
        </Box>
      )}
    </Box>
  );
}
