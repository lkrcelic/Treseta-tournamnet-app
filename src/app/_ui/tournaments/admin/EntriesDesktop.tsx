"use client";

import {addTournamentTeamAPI, admitTournamentTeamAPI, candidateTeamsAPI, removeTournamentTeamAPI} from "@/app/_fetchers/tournament";
import {AdminTournament, CandidateTeam, TournamentEntryView} from "@/app/_interfaces/tournament";
import {publishedTimeLabel} from "@/app/_lib/roundStatus";
import {dayMonth} from "@/app/_lib/ui/burza";
import {matchesQuery} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ellipsis, EmptyState, ErrorNote, IconCircleButton, InfoNote, NARROW_DESKTOP, OutlineButton, PlayerChip, SearchInput, Spinner} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";
import {FillBar} from "../TournamentParts";

// Upravljanje turnirom · Prijave and Lista čekanja (Claude Design "Turniri admin" A3, A4): the teams in (or waiting) in
// a table on the left, Dodaj ekipu on the right. Makni ekipu asks first and sends no notice; the first team waiting
// comes in by itself. Ubaci u turnir lets a waiting team in and grows the limit by one. Once the tournament has
// started the lists don't change any more.

type Props = {t: AdminTournament; waiting: boolean; onChanged: (t: AdminTournament) => void};

const signedUp = (iso: string, withTime: boolean) => (withTime ? `${dayMonth(iso)} ${publishedTimeLabel(iso)}` : dayMonth(iso));

export default function EntriesDesktop({t, waiting, onChanged}: Props) {
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Dodaj ekipu: before the start, and all through a tournament with Otvorene prijave, where the team comes straight
  // in (or onto the waiting list) and plays from the next Kolo (DECISIONS #88)
  const editable = t.phase === "upcoming" || (t.phase === "active" && t.signups_open_now);
  const list = (waiting ? t.waiting_list : t.entries).filter((e) => matchesQuery(`${e.team_name} ${e.players.map((p) => `${p.name} ${p.username ?? ""}`).join(" ")}`, query));
  const next = t.waiting_list[0];
  const cols = waiting ? "36px minmax(0,1fr) minmax(0,1.3fr) 120px 150px 44px" : "minmax(0,1fr) minmax(0,1.4fr) 110px 44px";

  const act = async (teamId: number, call: () => Promise<AdminTournament>) => {
    setBusy(teamId);
    setError(null);
    try {
      onChanged(await call());
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije uspjelo.");
    }
    setBusy(null);
  };

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 330px"}, gap: "20px"}}>
      <Card component="section" aria-label={waiting ? "Lista čekanja" : "Prijavljene ekipe"} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "16px", p: "14px", borderBottom: `1px solid ${tint.navy[10]}`}}>
          <SearchInput soft height={46} placeholder="Traži ekipe ili igrače" aria-label="Traži ekipe ili igrače" value={query} onChange={(e) => setQuery(e.target.value)} sx={{flex: 1, minWidth: 200}} />
          <Box sx={{flex: "none", width: 190, display: "flex", flexDirection: "column", gap: "6px"}}>
            <Box component="span" sx={{fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums"}}>
              {t.max_teams != null ? `${t.teams} / ${t.max_teams} ekipa${t.teams >= t.max_teams ? " · pun" : ""}` : `${t.teams} ekipa`}
            </Box>
            <FillBar registered={t.teams} max={t.max_teams} />
          </Box>
        </Box>
        {error && <ErrorNote sx={{m: "12px 14px 0"}}>{error}</ErrorNote>}
        <Box
          aria-hidden
          sx={{flex: "none", height: 40, display: "grid", gridTemplateColumns: cols, gap: "12px", alignItems: "center", px: "20px", background: color.paper2, borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
        >
          {waiting && <span>#</span>}
          <span>Ekipa</span>
          <span>Igrači</span>
          <Box component="span" sx={{textAlign: "right"}}>
            Prijavljeno
          </Box>
          {waiting && <span />}
          <span />
        </Box>
        {list.length === 0 ? (
          <EmptyState>{query ? "Nijedna ekipa ne odgovara pretrazi." : waiting ? "Nitko ne čeka." : "Još nema prijavljenih ekipa."}</EmptyState>
        ) : (
          <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto"}}>
            {list.map((e) => (
              <EntryRow
                key={e.team_id}
                e={e}
                cols={cols}
                waiting={waiting}
                editable={editable}
                confirming={confirm === e.team_id}
                busy={busy === e.team_id}
                comesIn={!waiting && next ? next.team_name : null}
                onAsk={() => setConfirm(confirm === e.team_id ? null : e.team_id)}
                onCancel={() => setConfirm(null)}
                onRemove={() => act(e.team_id, () => removeTournamentTeamAPI(t.id, e.team_id))}
                onAdmit={() => act(e.team_id, () => admitTournamentTeamAPI(t.id, e.team_id))}
              />
            ))}
          </Box>
        )}
      </Card>
      <Box sx={{minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px"}}>
        {editable ? (
          <AddTeamCard t={t} onAdded={onChanged} />
        ) : (
          <InfoNote icon={<InfoRoundedIcon />}>
            {t.phase === "cancelled"
              ? "Turnir je otkazan: prijave se ne mijenjaju. Vrati turnir pa se prijave ponovo otvaraju."
              : "Turnir je počeo: prijave se više ne mijenjaju. Ekipe za stolovima mijenjaš u tabu Kola."}
          </InfoNote>
        )}
        {editable && (
          <InfoNote icon={<InfoRoundedIcon />}>
            {t.phase === "active"
              ? "Prijave su otvorene cijeli turnir: dodana ekipa odmah je u turniru (ili na listi čekanja) i igra od idućeg kola."
              : waiting
                ? "Kad se ekipa odjavi, prva s liste ulazi automatski, bez obavijesti. „Ubaci u turnir” je ručno i povećava broj ekipa za jedan."
                : "Ekipa se može dodati samo ako bar dva igrača imaju račun. Micanje ekipe je bez obavijesti; prva s liste čekanja ulazi automatski."}
          </InfoNote>
        )}
      </Box>
    </Box>
  );
}

function EntryRow({
  e,
  cols,
  waiting,
  editable,
  confirming,
  busy,
  comesIn,
  onAsk,
  onCancel,
  onRemove,
  onAdmit,
}: {
  e: TournamentEntryView;
  cols: string;
  waiting: boolean;
  editable: boolean;
  confirming: boolean;
  busy: boolean;
  comesIn: string | null;
  onAsk: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onAdmit: () => void;
}) {
  const small = {...buttonBase, flex: "none", height: 42, px: "16px", borderRadius: "12px", fontSize: 14, fontWeight: 600} as const;
  return (
    <Box component="li" sx={{minHeight: 60, display: "grid", gridTemplateColumns: cols, gap: "0 12px", alignItems: "center", px: "20px", borderBottom: `1px solid ${color.divider}`, background: confirming ? tint.red[6] : "transparent"}}>
      {waiting && (
        <Box component="span" sx={{fontFamily: font.display, fontSize: 18, fontWeight: 800, color: color.navy}}>
          {e.position}
        </Box>
      )}
      <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
        {e.team_name}
      </Box>
      <Box component="span" sx={{display: "flex", flexWrap: "wrap", gap: "6px", py: "8px", minWidth: 0}}>
        {e.players.map((p) => (
          <PlayerChip key={p.id} name={p.username ?? p.name} fullName={p.name} src={p.photo_url} size="sm" />
        ))}
      </Box>
      <Box component="span" sx={{textAlign: "right", fontSize: 14, color: color.ink2, fontVariantNumeric: "tabular-nums"}}>
        {signedUp(e.registered_at, waiting)}
      </Box>
      {waiting && (
        <Box sx={{display: "flex", justifyContent: "flex-end"}}>
          {editable && (
            <Box
              component="button"
              type="button"
              onClick={onAdmit}
              disabled={busy}
              sx={{...buttonBase, height: 40, display: "flex", alignItems: "center", gap: "6px", px: "12px", borderRadius: "12px", background: color.navy, color: color.white, fontSize: 14, fontWeight: 600, "& svg": {fontSize: 18}}}
            >
              {busy ? <Spinner size={16} tone="white" /> : <LoginRoundedIcon aria-hidden />}
              Ubaci u turnir
            </Box>
          )}
        </Box>
      )}
      {editable ? (
        <Box
          component="button"
          type="button"
          onClick={onAsk}
          aria-label={`Makni ${e.team_name} s turnira`}
          aria-expanded={confirming}
          sx={{...buttonBase, width: 44, height: 44, borderRadius: "12px", color: confirming ? color.red : color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: tint.red[10], color: color.red}}}
        >
          <DeleteRoundedIcon />
        </Box>
      ) : (
        <span />
      )}
      {confirming && (
        <Box role="alert" sx={{gridColumn: "1 / -1", mx: "-20px", p: "14px 20px", background: tint.red[8], borderTop: `1px solid ${tint.red[20]}`, display: "flex", alignItems: "center", gap: "14px", "& > svg": {fontSize: 24, color: color.red, flex: "none"}}}>
          <WarningRoundedIcon />
          <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
              {waiting ? `Maknuti ${e.team_name} s liste čekanja?` : `Maknuti ${e.team_name} s turnira?`}
            </Box>
            <Box component="span" sx={{fontSize: 13, color: color.ink2}}>
              Ekipa neće dobiti obavijest.{comesIn ? ` Prva ekipa s liste čekanja (${comesIn}) ulazi u turnir.` : ""}
            </Box>
          </Box>
          <Box component="button" type="button" onClick={onCancel} sx={{...small, border: `1.5px solid ${color.borderControl}`, background: color.white, color: color.navy}}>
            Odustani
          </Box>
          <Box
            component="button"
            type="button"
            onClick={onRemove}
            disabled={busy}
            sx={{...small, background: color.red, color: color.white, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}
          >
            {busy ? <Spinner size={16} tone="white" /> : <DeleteRoundedIcon />}
            Makni ekipu
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Dodaj ekipu's search, on the computer's card and the phone's sheet: teams not signed up yet by name or a player's
// name or username (from 2 letters), each with why it can't be added; add() signs one up and drops it from the hits
export function useCandidateSearch(t: AdminTournament, onAdded: (t: AdminTournament) => void) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CandidateTeam[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      candidateTeamsAPI(t.id, q)
        .then((found) => {
          if (!cancelled) setHits(found);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, t.id]);

  const add = async (team: CandidateTeam) => {
    setAdding(team.team_id);
    setError(null);
    try {
      onAdded(await addTournamentTeamAPI(t.id, team.team_id));
      setHits((h) => h?.filter((x) => x.team_id !== team.team_id) ?? h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekipa nije dodana.");
    }
    setAdding(null);
  };
  return {query, setQuery, hits, loading, adding, error, add};
}

// Dodaj ekipu on the computer; Nova ekipa goes to the league's Nova ekipa
function AddTeamCard({t, onAdded}: {t: AdminTournament; onAdded: (t: AdminTournament) => void}) {
  const router = useTransitionRouter();
  const {query, setQuery, hits, loading, adding, error, add} = useCandidateSearch(t, onAdded);

  const full = t.max_teams != null && t.teams >= t.max_teams;
  return (
    <Card component="section" aria-labelledby="add-entry" sx={{flex: "none", p: "20px", display: "flex", flexDirection: "column", gap: "12px", borderRadius: "24px"}}>
      <Box component="h2" id="add-entry" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
        Dodaj ekipu
      </Box>
      <SearchInput soft height={50} placeholder="Traži postojeće ekipe" aria-label="Traži postojeće ekipe" value={query} onChange={(e) => setQuery(e.target.value)} />
      {full && (
        <Box sx={{fontSize: 13, lineHeight: 1.45, color: color.ink2}}>Turnir je pun: dodana ekipa ide na listu čekanja.</Box>
      )}
      {hits != null && (
        <Box aria-live="polite" sx={{display: "flex", flexDirection: "column", border: `1px solid ${tint.navy[10]}`, borderRadius: "16px", overflow: "hidden"}}>
          {loading && hits.length === 0 ? (
            <Box sx={{p: "16px 14px", display: "flex", gap: "10px", alignItems: "center", fontSize: 14, color: color.muted}}>
              <Spinner size={18} /> Tražim…
            </Box>
          ) : hits.length === 0 ? (
            <Box sx={{p: "18px 14px", fontSize: 14, color: color.muted}}>Nema takvih ekipa izvan turnira.</Box>
          ) : (
            hits.map((h) => (
              <Box key={h.team_id} sx={{minHeight: 58, display: "flex", alignItems: "center", gap: "10px", pl: "14px", pr: "8px", py: "6px", borderBottom: `1px solid ${color.divider}`}}>
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                  <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
                    {h.team_name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: h.reason ? color.red : color.muted, ...ellipsis}}>
                    {h.reason ?? (h.players.map((p) => p.username ?? p.name).join(" · ") || "—")}
                  </Box>
                </Box>
                <IconCircleButton
                  label={`Dodaj ${h.team_name} na turnir`}
                  size={44}
                  disabled={adding != null || h.reason != null}
                  onClick={() => add(h)}
                  sx={{borderRadius: "12px", background: h.reason ? color.lineFill : color.navy, color: h.reason ? color.faint : color.white, boxShadow: "none", "& svg": {fontSize: 24}}}
                >
                  {adding === h.team_id ? <Spinner size={20} tone="white" /> : <AddRoundedIcon />}
                </IconCircleButton>
              </Box>
            ))
          )}
        </Box>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <OutlineButton onClick={() => router.push("/teams?new=1")} height={50} tone={color.navy} sx={{borderWidth: "1.5px", borderColor: tint.navy[25], fontSize: 15}}>
        <GroupAddRoundedIcon sx={{fontSize: 22}} />
        Nova ekipa
      </OutlineButton>
    </Card>
  );
}
