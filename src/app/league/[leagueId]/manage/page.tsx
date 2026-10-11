"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagues from "@/app/_hooks/useLeagues";
import useLeagueTeams from "@/app/_hooks/useLeagueTeams";
import {useLeagueStandings} from "@/app/_hooks/useStandings";
import {matchesQuery} from "@/app/_lib/ui/text";
import {addTeamToLeagueAPI, removeTeamFromLeagueAPI, setLeagueTeamActiveAPI} from "@/app/_fetchers/league/leagues";
import {color, font} from "@/app/_styles/tokens";
import {
  buttonBase,
  Card,
  DesktopShell,
  ellipsis,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  InfoNote,
  LeagueEyebrowButton,
  LeagueMenuButton,
  LoadMoreButton,
  LoadingRows,
  OutlineButton,
  PlayerChip,
  Screen,
  ScreenTitle,
  SearchInput,
  Segmented,
  Spinner,
  SwitchTrack,
} from "@/app/_ui/sp";
import {searchTeams, TeamOption} from "@/app/_ui/teams/teamSearch";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import LeagueDetailsView from "./LeagueDetailsView";
import LeagueNameCard from "./LeagueNameCard";
import RoundsView, {useLeagueRounds} from "./RoundsView";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {CreateRoundView} from "@/app/_ui/round/CreateRound";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";

type Filter = "all" | "active" | "inactive";
type View = "create" | "teams" | "rounds" | "details";
const VIEWS: View[] = ["create", "teams", "rounds", "details"];
type Row = {id: number; name: string; players: string[]; played: number | null; active: boolean};
type Team = NonNullable<ReturnType<typeof useLeagueTeams>["teams"]>[number];
// a team taken out of the league waits this long for Undo before the delete is sent
type PendingRemoval = {team: Team; index: number; timer: number};

const UNDO_MS = 8000;
const TEAM_GRID = "minmax(0,1.1fr) minmax(0,1.4fr) 80px 170px 44px";

function removalNote(played: number | null): string {
  const stay = "The team itself and its players stay in the app.";
  if (played == null) return `Removes the team from this league's standings. ${stay}`;
  if (played === 0) return `The team has no played rounds. ${stay}`;
  return `Removes the team and its ${played} played ${played === 1 ? "round" : "rounds"} from this league's standings. ${stay}`;
}

export default function ManageLeague() {
  const params = useParams<{leagueId: string}>();
  const leagueId = Number(params.leagueId);
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const leagues = useLeagues(leagueId);
  const {teams, setTeams, error, loading, reload} = useLeagueTeams(leagueId);
  const {standings} = useLeagueStandings(leagueId);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // desktop: create a round (the first view), the league's teams, its rounds (delete a round) or its details; ?view= opens another
  const viewParam = useSearchParams().get("view") as View | null;
  const [view, setView] = useState<View>(viewParam && VIEWS.includes(viewParam) ? viewParam : "create");
  const leagueRounds = useLeagueRounds(leagueId);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const pendingRef = useRef<PendingRemoval | null>(null);
  pendingRef.current = pending;

  const played = useMemo(() => new Map((standings ?? []).map((s) => [Number(s.team_id), s.rounds_played])), [standings]);
  const rows: Row[] = useMemo(() => {
    const list = (teams ?? []).map((t) => ({...t, played: played.get(t.id) ?? null}));
    // a team added just now is listed first
    return justAdded == null ? list : [...list.filter((t) => t.id === justAdded), ...list.filter((t) => t.id !== justAdded)];
  }, [teams, played, justAdded]);

  const visible = rows.filter(
    (r) => (filter === "all" || (filter === "active") === r.active) && matchesQuery(`${r.name} ${r.players.join(" ")}`, query)
  );
  const filters = [
    {key: "all" as Filter, label: "All", count: rows.length},
    {key: "active" as Filter, label: "Active", count: rows.filter((r) => r.active).length},
    {key: "inactive" as Filter, label: "Inactive", count: rows.filter((r) => !r.active).length},
  ];
  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? "";

  // optimistic: the switch moves at once and goes back if the server refuses
  const setActive = async (r: Row, active: boolean) => {
    setActionError(null);
    setTeams((prev) => prev?.map((t) => (t.id === r.id ? {...t, active} : t)) ?? prev);
    try {
      await setLeagueTeamActiveAPI(leagueId, r.id, active);
    } catch (e) {
      setTeams((prev) => prev?.map((t) => (t.id === r.id ? {...t, active: !active} : t)) ?? prev);
      setActionError(e instanceof Error ? e.message : "Status ekipe nije spremljen.");
    }
  };

  const onAdd = async (t: TeamOption) => {
    setActionError(null);
    try {
      await addTeamToLeagueAPI(leagueId, t.id);
      setTeams((prev) => [...(prev ?? []), {id: t.id, name: t.title, players: t.players, active: true}]);
      setJustAdded(t.id);
      if (filter === "inactive") setFilter("all");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ekipu nije moguće dodati.");
      throw e;
    }
  };

  // the delete goes out after the undo window; if the server refuses, the team is put back where it was
  const sendRemoval = useCallback(
    async (p: PendingRemoval, keepalive = false) => {
      window.clearTimeout(p.timer);
      try {
        await removeTeamFromLeagueAPI(leagueId, p.team.id, keepalive);
      } catch (e) {
        setTeams((prev) => {
          if (!prev || prev.some((t) => t.id === p.team.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(p.index, next.length), 0, p.team);
          return next;
        });
        setActionError(e instanceof Error ? e.message : "Ekipa nije obrisana iz lige.");
      }
    },
    [leagueId, setTeams]
  );

  // leaving the page (or closing it) sends a delete that is still waiting
  useEffect(() => {
    const flush = () => {
      if (pendingRef.current) sendRemoval(pendingRef.current, true);
      pendingRef.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      setPending(null);
    };
  }, [sendRemoval]);

  const removeTeam = (r: Row) => {
    if (!teams) return;
    setActionError(null);
    setConfirmDelete(null);
    if (pending) sendRemoval(pending);
    const index = teams.findIndex((t) => t.id === r.id);
    const team = teams[index];
    if (!team) return;
    setTeams(teams.filter((t) => t.id !== r.id));
    const p: PendingRemoval = {team, index, timer: 0};
    p.timer = window.setTimeout(() => {
      setPending((cur) => (cur === p ? null : cur));
      sendRemoval(p);
    }, UNDO_MS);
    setPending(p);
  };

  const undoRemoval = () => {
    if (!pending) return;
    window.clearTimeout(pending.timer);
    setTeams((prev) => {
      const next = [...(prev ?? [])];
      next.splice(Math.min(pending.index, next.length), 0, pending.team);
      return next;
    });
    setPending(null);
  };

  const listState = error ? (
    <ErrorNote onRetry={reload} sx={{m: "14px"}}>
      {error}
    </ErrorNote>
  ) : loading ? (
    <LoadingRows rows={8} height={60} />
  ) : visible.length === 0 ? (
    <EmptyState>{rows.length ? "Nijedna ekipa ne odgovara filteru." : "Ova liga još nema ekipa."}</EmptyState>
  ) : null;

  const toolbar = (
    <Box sx={{flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", p: "14px", borderBottom: `1px solid rgba(60,74,103,.1)`}}>
      <Segmented<Filter> items={filters} value={filter} onChange={setFilter} label="Status ekipa" variant="soft" asTabs={false} />
      <SearchInput
        soft
        height={46}
        placeholder="Search teams or players"
        aria-label="Traži ekipe ili igrače"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{flex: 1, minWidth: 200}}
      />
    </Box>
  );

  const statusToggle = (r: Row) => (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={r.active}
      aria-label={`${r.name}: ${r.active ? "aktivna" : "neaktivna"}`}
      onClick={() => setActive(r, !r.active)}
      sx={{
        ...buttonBase,
        justifySelf: "end",
        height: 44,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        pl: "10px",
        pr: "4px",
        borderRadius: "12px",
        fontSize: 14,
        fontWeight: 600,
        color: r.active ? color.green : color.faint,
        "&:hover": {background: color.paper},
      }}
    >
      {r.active ? "Active" : "Inactive"}
      <SwitchTrack on={r.active} onColor={color.green} />
    </Box>
  );

  // the desktop renames the league in the Details view
  const sidePanel = (
    <Box sx={{minHeight: 0, overflowY: isDesktop ? "auto" : undefined, display: "flex", flexDirection: "column", gap: "16px"}}>
      {!isDesktop && <LeagueNameCard key={leagueId} leagueId={leagueId} leagues={leagues} />}
      <AddTeamCard exclude={rows.map((r) => r.id)} onAdd={onAdd} onCreate={() => router.push(`/teams/new?league=${leagueId}`)} />
      <InfoNote icon={<InfoRoundedIcon />}>
        Inactive teams stay in the league and its standings, but are not signed in automatically when you create a round.
      </InfoNote>
    </Box>
  );

  if (isDesktop) {
    return (
      <DesktopShell
        active="manageLeague"
        eyebrow="Admin"
        title="Manage League"
        right={<LeagueMenuButton leagues={leagues} value={leagueId} onChange={(id) => router.router.push(`/league/${id}/manage?view=${view}`)} />}
      >
        <ViewSwitch view={view} onChange={setView} teams={rows.length} rounds={leagueRounds.rounds?.length ?? null} />
        {view === "create" ? (
          <CreateRoundView leagueId={leagueId} defaultRounds={leagues.find((l) => l.id === leagueId)?.roundsPerNight} />
        ) : view === "details" ? (
          <LeagueDetailsView key={leagueId} leagueId={leagueId} leagues={leagues} />
        ) : view === "rounds" ? (
          <RoundsView leagueId={leagueId} data={leagueRounds} />
        ) : (
          <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: "20px"}}>
            <Card component="section" aria-label={`Ekipe lige ${leagueName}`} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
              {toolbar}
              {actionError && <ErrorNote sx={{m: "12px 14px 0"}}>{actionError}</ErrorNote>}
              <Box
                aria-hidden
                sx={{flex: "none", height: 40, display: "grid", gridTemplateColumns: TEAM_GRID, gap: "12px", alignItems: "center", px: "20px", background: color.tableHead, borderBottom: `1px solid rgba(60,74,103,.1)`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
              >
                <span>Team</span>
                <span>Players</span>
                <Box component="span" sx={{textAlign: "center"}}>
                  Played
                </Box>
                <Box component="span" sx={{textAlign: "right"}}>
                  Status
                </Box>
                <span />
              </Box>
              {listState ?? (
                <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable"}}>
                <Box component="ul" sx={{listStyle: "none", m: 0, p: 0}}>
                  {visible.map((r) => (
                    <Box
                      component="li"
                      key={r.id}
                      sx={{
                        minHeight: 60,
                        display: "grid",
                        gridTemplateColumns: TEAM_GRID,
                        gap: "0 12px",
                        alignItems: "center",
                        px: "20px",
                        borderBottom: `1px solid rgba(60,74,103,.07)`,
                        background: confirmDelete === r.id ? "rgba(188,71,73,.04)" : r.id === justAdded ? color.creamSoft : "transparent",
                        animation: r.id === justAdded ? "spRowIn 420ms cubic-bezier(.2,.8,.2,1) both" : "none",
                      }}
                    >
                      <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: r.active ? color.ink : color.faint, ...ellipsis}}>
                        {r.name}
                      </Box>
                      <Box component="span" sx={{display: "flex", gap: "6px", minWidth: 0, overflow: "hidden", opacity: r.active ? 1 : 0.55}}>
                        {r.players.map((p) => (
                          <PlayerChip key={p} name={p} size="sm" />
                        ))}
                      </Box>
                      <Box component="span" sx={{textAlign: "center", fontSize: 15, color: color.inkSoft, fontVariantNumeric: "tabular-nums"}}>
                        {r.played ?? "—"}
                      </Box>
                      {statusToggle(r)}
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setConfirmDelete(confirmDelete === r.id ? null : r.id)}
                        aria-label={`Delete ${r.name} from the league`}
                        aria-expanded={confirmDelete === r.id}
                        title="Delete from league"
                        sx={{
                          ...buttonBase,
                          width: 44,
                          height: 44,
                          borderRadius: "12px",
                          color: confirmDelete === r.id ? color.red : color.placeholder,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          "& svg": {fontSize: 22},
                          "&:hover": {background: "rgba(188,71,73,.1)", color: color.red},
                        }}
                      >
                        <DeleteRoundedIcon />
                      </Box>
                      {confirmDelete === r.id && (
                        <Box
                          role="alert"
                          sx={{
                            gridColumn: "1 / -1",
                            mx: "-20px",
                            p: "14px 20px",
                            background: "rgba(188,71,73,.07)",
                            borderTop: "1px solid rgba(188,71,73,.2)",
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            "& > svg": {fontSize: 24, color: color.red, flex: "none"},
                          }}
                        >
                          <WarningRoundedIcon />
                          <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                            <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
                              Delete {r.name} from this league?
                            </Box>
                            <Box component="span" sx={{fontSize: 13, color: color.inkSoft}}>
                              {removalNote(r.played)}
                            </Box>
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            sx={{...buttonBase, flex: "none", height: 42, px: "16px", border: "1.5px solid rgba(60,74,103,.2)", borderRadius: "12px", background: color.card, color: color.navy, fontSize: 14, fontWeight: 600}}
                          >
                            Cancel
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => removeTeam(r)}
                            sx={{...buttonBase, flex: "none", height: 42, px: "16px", borderRadius: "12px", background: color.red, color: "#FFFFFF", display: "flex", alignItems: "center", gap: "6px", fontSize: 14, fontWeight: 600, "& svg": {fontSize: 18}}}
                          >
                            <DeleteRoundedIcon />
                            Delete team
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
                <Box role="status" sx={{display: "contents"}}>
                  {pending && (
                    <Box
                      sx={{
                        position: "sticky",
                        bottom: "12px",
                        m: "12px auto",
                        width: "max-content",
                        maxWidth: "90%",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        p: "8px 8px 8px 16px",
                        borderRadius: "14px",
                        background: color.ink,
                        color: "#FFFFFF",
                        fontSize: 14,
                        boxShadow: "0 10px 30px rgba(21,24,31,.25)",
                      }}
                    >
                      <span>{pending.team.name} deleted from the league</span>
                      <Box
                        component="button"
                        type="button"
                        onClick={undoRemoval}
                        sx={{...buttonBase, height: 36, px: "12px", borderRadius: "10px", background: "rgba(255,255,255,.14)", color: "#FFFFFF", fontSize: 14, fontWeight: 600}}
                      >
                        Undo
                      </Box>
                    </Box>
                  )}
                </Box>
                </Box>
              )}
            </Card>
            {sidePanel}
          </Box>
        )}
      </DesktopShell>
    );
  }

  return (
    <Screen>
      <Box sx={{display: "flex", alignItems: "flex-start", gap: "12px"}}>
        <IconCircleButton label="Nazad" onClick={() => router.push("/", "back")}>
          <ArrowBackRoundedIcon />
        </IconCircleButton>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, pt: "2px"}}>
          <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={(id) => router.router.push(`/league/${id}/manage`)} />
          <ScreenTitle title="Manage League" sx={{px: 0}} />
        </Box>
      </Box>
      <Card sx={{overflow: "hidden"}}>
        {toolbar}
        {actionError && <ErrorNote sx={{m: "12px 14px 0"}}>{actionError}</ErrorNote>}
        {listState ?? (
          <Box component="ul" sx={{listStyle: "none", m: 0, p: 0}}>
            {visible.map((r) => (
              <Box
                component="li"
                key={r.id}
                sx={{display: "flex", alignItems: "center", gap: "10px", p: "12px 10px 12px 16px", borderBottom: `1px solid ${color.line}`, background: r.id === justAdded ? color.creamSoft : "transparent"}}
              >
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: r.active ? color.ink : color.faint, ...ellipsis}}>
                    {r.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {r.players.join(" · ") || "—"}
                    {r.played != null && ` · ${r.played} OK`}
                  </Box>
                </Box>
                {statusToggle(r)}
              </Box>
            ))}
          </Box>
        )}
      </Card>
      {sidePanel}
    </Screen>
  );
}

// Teams that are not in the league, listed as soon as the card shows; the search narrows them
function AddTeamCard({exclude, onAdd, onCreate}: {exclude: number[]; onAdd: (t: TeamOption) => Promise<void>; onCreate: () => void}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<number | null>(null);
  const [hits, setHits] = useState<TeamOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  // results are shown 4 at a time; a new search starts from the first 4
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const q = query.trim();
    setPages(1);
    let cancelled = false;
    setLoading(true);
    // the whole list loads at once; typing waits for a pause
    const t = setTimeout(() => {
      searchTeams(q)
        .then((found) => {
          if (!cancelled) setHits(found);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, q ? 220 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const outside = (hits ?? []).filter((h) => !exclude.includes(h.id));
  const shown = outside.slice(0, 4 * pages);
  const left = outside.length - shown.length;

  return (
    <Card component="section" aria-labelledby="add-team" sx={{p: "20px", display: "flex", flexDirection: "column", gap: "12px", borderRadius: "24px"}}>
      <Box component="h2" id="add-team" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
        Add team
      </Box>
      <SearchInput
        soft
        height={50}
        placeholder="Search existing teams"
        aria-label="Traži postojeće ekipe"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {hits != null && (
        <Box aria-live="polite" sx={{display: "flex", flexDirection: "column", border: `1px solid rgba(60,74,103,.1)`, borderRadius: "16px", overflow: "hidden"}}>
          {loading ? (
            <Box sx={{p: "16px 14px", display: "flex", gap: "10px", alignItems: "center", fontSize: 14, color: color.muted}}>
              <Spinner size={18} /> Tražim…
            </Box>
          ) : shown.length === 0 ? (
            <Box sx={{p: "18px 14px", fontSize: 14, color: color.muted}}>No teams found outside this league.</Box>
          ) : (
            shown.map((h) => (
              <Box key={h.id} sx={{minHeight: 58, display: "flex", alignItems: "center", gap: "10px", pl: "14px", pr: "8px", borderBottom: `1px solid rgba(60,74,103,.07)`}}>
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
                  <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
                    {h.title}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {h.subtitle ?? "—"}
                  </Box>
                </Box>
                <IconCircleButton
                  label={`Dodaj ${h.title} u ligu`}
                  size={44}
                  disabled={adding != null}
                  onClick={async () => {
                    setAdding(h.id);
                    await onAdd(h).catch(() => undefined);
                    setAdding(null);
                  }}
                  sx={{borderRadius: "12px", background: color.navy, color: "#FFFFFF", boxShadow: "none", "& svg": {fontSize: 24}}}
                >
                  {adding === h.id ? <Spinner size={20} color="#FFFFFF" /> : <AddRoundedIcon />}
                </IconCircleButton>
              </Box>
            ))
          )}
          {!loading && left > 0 && <LoadMoreButton left={left} noun={["team", "teams"]} onClick={() => setPages((n) => n + 1)} />}
        </Box>
      )}
      <OutlineButton onClick={onCreate} height={50} tone={color.navy} sx={{borderWidth: "1.5px", borderColor: "rgba(60,74,103,.25)", fontSize: 15}}>
        <GroupAddRoundedIcon sx={{fontSize: 22}} />
        Create new team
      </OutlineButton>
    </Card>
  );
}

function ViewSwitch({
  view,
  onChange,
  teams,
  rounds,
}: {
  view: View;
  onChange: (v: View) => void;
  teams: number;
  rounds: number | null;
}) {
  const items: {key: View; label: string; icon: ReactNode; count: number | null}[] = [
    {key: "create", label: "Create round", icon: <AddCircleRoundedIcon />, count: null},
    {key: "teams", label: "Teams", icon: <GroupsRoundedIcon />, count: teams},
    {key: "rounds", label: "Rounds", icon: <EventNoteRoundedIcon />, count: rounds},
    {key: "details", label: "Details", icon: <TuneRoundedIcon />, count: null},
  ];
  return (
    <Box role="tablist" aria-label="Prikaz" sx={{flex: "none", alignSelf: "flex-start", display: "flex", gap: "4px", p: "4px", borderRadius: "16px", background: color.card, boxShadow: "0 1px 3px rgba(31,36,51,.06)"}}>
      {items.map((it) => {
        const on = it.key === view;
        return (
          <Box
            key={it.key}
            component="button"
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            sx={{
              ...buttonBase,
              height: 42,
              px: "18px",
              borderRadius: "12px",
              background: on ? color.navy : "transparent",
              color: on ? "#FFFFFF" : color.ink,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: 15,
              fontWeight: 600,
              transition: "background 160ms ease",
              "& svg": {fontSize: 20},
            }}
          >
            {it.icon}
            {it.label}
            {it.count != null && (
              <Box component="span" sx={{fontSize: 12, fontWeight: 700, color: on ? color.cream : color.placeholder}}>
                {it.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
