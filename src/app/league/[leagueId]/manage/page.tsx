"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagues from "@/app/_hooks/useLeagues";
import useLeagueNights from "@/app/_hooks/useLeagueNights";
import useLeagueTeams from "@/app/_hooks/useLeagueTeams";
import {useLeagueStandings} from "@/app/_hooks/useStandings";
import {count, matchesQuery, NOUN, plural} from "@/app/_lib/ui/text";
import {addTeamToLeagueAPI, removeTeamFromLeagueAPI, setLeagueTeamActiveAPI, setLeagueTeamConferenceAPI} from "@/app/_fetchers/league/leagues";
import {setTeamConferencesAPI} from "@/app/_fetchers/league/conferences";
import useConferences, {setCachedConferences, setCachedTeamConference} from "@/app/_hooks/useConferences";
import {LeagueConferences} from "@/app/_interfaces/league";
import ConferencesCard from "./ConferencesCard";
import {ConferencePicker, DistributeCard} from "./ConferenceParts";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
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
import DatesView from "./DatesView";
import RoundsView, {useLeagueRounds} from "./RoundsView";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {CreateRoundView} from "@/app/_ui/round/CreateRound";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";

type Filter = "all" | "active" | "inactive";
type View = "create" | "teams" | "rounds" | "dates" | "details";
const VIEWS: View[] = ["create", "teams", "rounds", "dates", "details"];
type Row = {id: number; name: string; players: string[]; played: number | null; active: boolean; conferenceId: number | null};
// the conference filter of the team list: every team, one conference's (its id), or the teams without one
const ALL_CONFERENCES = 0;
const NO_CONFERENCE = -1;
type Team = NonNullable<ReturnType<typeof useLeagueTeams>["teams"]>[number];
// a team taken out of the league waits this long for Undo before the delete is sent
type PendingRemoval = {team: Team; index: number; timer: number};

const UNDO_MS = 8000;
const TEAM_GRID = "minmax(0,1.1fr) minmax(0,1.4fr) 80px 170px 44px";

function removalNote(played: number | null): string {
  const stay = "Ekipa i igrači ostaju u aplikaciji.";
  if (played == null) return `Uklanja ekipu iz poretka ove lige. ${stay}`;
  if (played === 0) return `Ekipa nema odigranih kola. ${stay}`;
  // "njezino 1 odigrano kolo", "njezina 2 odigrana kola", "njezinih 12 odigranih kola"
  return `Uklanja ekipu i ${plural(played, "njezino", "njezina", "njezinih")} ${count(played, NOUN.odigranoKolo)} iz poretka ove lige. ${stay}`;
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
  // desktop: create a round (the first view), the league's teams, its rounds (delete a round), its nights or its details;
  // ?view= opens another
  const viewParam = useSearchParams().get("view") as View | null;
  const [view, setView] = useState<View>(viewParam && VIEWS.includes(viewParam) ? viewParam : "create");
  const leagueRounds = useLeagueRounds(leagueId);
  const leagueNights = useLeagueNights(isDesktop ? leagueId : null);
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

  // conferences: a picker on every team, a filter, and the teams per conference with "Distribute evenly"
  const conferences = useConferences(leagueId);
  const confList = conferences.conferences;
  const hasConferences = confList.length > 0;
  const inConference = (r: Row) => confList.some((c) => c.id === r.conferenceId);
  const [confFilterPicked, setConfFilter] = useState(ALL_CONFERENCES);
  // a conference deleted since (or another league's) counts as every team
  const confFilter = confFilterPicked === NO_CONFERENCE || confList.some((c) => c.id === confFilterPicked) ? confFilterPicked : ALL_CONFERENCES;
  const unassigned = rows.filter((r) => !inConference(r)).length;
  const teamCounts = useMemo(() => {
    const counts = new Map<number, number>();
    (teams ?? []).forEach((t) => t.conferenceId != null && counts.set(t.conferenceId, (counts.get(t.conferenceId) ?? 0) + 1));
    return counts;
  }, [teams]);
  // the teams in league-table order (the ones without a row yet by name), for "Distribute evenly"
  const tableOrder = useMemo(() => {
    const pos = new Map((standings ?? []).map((s, i) => [Number(s.team_id), i]));
    return [...rows]
      .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "hr"))
      .map((r) => r.id);
  }, [rows, standings]);

  const visible = rows.filter(
    (r) =>
      (filter === "all" || (filter === "active") === r.active) &&
      (!hasConferences || confFilter === ALL_CONFERENCES || (confFilter === NO_CONFERENCE ? !inConference(r) : r.conferenceId === confFilter)) &&
      matchesQuery(`${r.name} ${r.players.join(" ")}`, query)
  );
  const filters = [
    {key: "all" as Filter, label: "Sve", count: rows.length},
    {key: "active" as Filter, label: "Aktivne", count: rows.filter((r) => r.active).length},
    {key: "inactive" as Filter, label: "Neaktivne", count: rows.filter((r) => !r.active).length},
  ];
  const confFilters = [
    {key: ALL_CONFERENCES, label: "Sve", count: rows.length},
    ...confList.map((c) => ({key: c.id, label: c.name, dot: c.color, count: rows.filter((r) => r.conferenceId === c.id).length})),
    // shown while some team has no conference (or while picked)
    ...(unassigned > 0 || confFilter === NO_CONFERENCE ? [{key: NO_CONFERENCE, label: "Bez konferencije", dot: null, count: unassigned, alert: unassigned > 0}] : []),
  ];
  const leagueName = leagues.find((l) => l.id === leagueId)?.name ?? "";

  // optimistic, like the Active switch
  const setConference = async (r: Row, conferenceId: number | null) => {
    setActionError(null);
    const before = r.conferenceId;
    setTeams((prev) => prev?.map((t) => (t.id === r.id ? {...t, conferenceId} : t)) ?? prev);
    try {
      await setLeagueTeamConferenceAPI(leagueId, r.id, conferenceId);
      setCachedTeamConference(leagueId, r.id, conferenceId);
    } catch (e) {
      setTeams((prev) => prev?.map((t) => (t.id === r.id ? {...t, conferenceId: before} : t)) ?? prev);
      setActionError(e instanceof Error ? e.message : "Konferencija ekipe nije spremljena.");
    }
  };

  const distribute = async (assignments: {team_id: number; conference_id: number}[]) => {
    const data = await setTeamConferencesAPI(leagueId, assignments);
    setCachedConferences(leagueId, data);
    const byTeam = new Map(assignments.map((a) => [a.team_id, a.conference_id]));
    setTeams((prev) => prev?.map((t) => (byTeam.has(t.id) ? {...t, conferenceId: byTeam.get(t.id)!} : t)) ?? prev);
  };

  // conferences saved in the editor: the teams of a deleted one have none now
  const conferencesSaved = (data: LeagueConferences) => {
    const kept = new Set(data.conferences.map((c) => c.conference_id));
    setTeams((prev) => prev?.map((t) => (t.conferenceId != null && !kept.has(t.conferenceId) ? {...t, conferenceId: null} : t)) ?? prev);
  };

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
      setTeams((prev) => [...(prev ?? []), {id: t.id, name: t.title, players: t.players, active: true, conferenceId: null}]);
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
    <Box sx={{flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", p: "14px", borderBottom: `1px solid ${tint.navy[10]}`}}>
      <Segmented<Filter> items={filters} value={filter} onChange={setFilter} label="Status ekipa" variant="soft" asTabs={false} />
      {hasConferences && (
        <Segmented<number>
          items={confFilters}
          value={confFilter}
          onChange={setConfFilter}
          label="Konferencija ekipa"
          variant="soft"
          asTabs={false}
          sx={{maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none"}}
        />
      )}
      <SearchInput
        soft
        height={46}
        placeholder="Traži ekipe ili igrače"
        aria-label="Traži ekipe ili igrače"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // wide enough for the whole placeholder; a narrow card puts the search under the filters
        sx={{flex: 1, minWidth: 250}}
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
        color: r.active ? color.green : color.muted,
        "&:hover": {background: color.paper},
      }}
    >
      {r.active ? "Aktivna" : "Neaktivna"}
      <SwitchTrack on={r.active} onColor={color.green} />
    </Box>
  );

  // keyed by league (so switching league starts from the saved list), apart from the league name card next to it
  const conferencesCard = <ConferencesCard key={`conferences-${leagueId}`} leagueId={leagueId} teamCounts={teamCounts} onSaved={conferencesSaved} />;

  // the desktop renames the league and edits its conferences in the Podaci view
  const sidePanel = (
    <Box sx={{minHeight: 0, overflowY: isDesktop ? "auto" : undefined, display: "flex", flexDirection: "column", gap: "16px"}}>
      {!isDesktop && <LeagueNameCard key={leagueId} leagueId={leagueId} leagues={leagues} />}
      {!isDesktop && conferencesCard}
      {hasConferences && teams && <DistributeCard conferences={confList} teams={rows} order={tableOrder} onDistribute={distribute} />}
      <AddTeamCard exclude={rows.map((r) => r.id)} onAdd={onAdd} onCreate={() => router.push(`/teams/new?league=${leagueId}`)} />
      <InfoNote icon={<InfoRoundedIcon />}>
        Neaktivne ekipe ostaju u ligi i poretku, ali se ne uključuju automatski kad kreiraš kolo.
      </InfoNote>
    </Box>
  );

  if (isDesktop) {
    return (
      <DesktopShell
        active="manageLeague"
        eyebrow="Admin"
        title="Upravljanje ligom"
        right={<LeagueMenuButton leagues={leagues} value={leagueId} onChange={(id) => router.router.push(`/league/${id}/manage?view=${view}`)} />}
      >
        <ViewSwitch view={view} onChange={setView} teams={rows.length} rounds={leagueRounds.rounds?.length ?? null} nights={leagueNights.nights?.length ?? null} />
        {view === "create" ? (
          <CreateRoundView
            leagueId={leagueId}
            defaultRounds={leagues.find((l) => l.id === leagueId)?.roundsPerNight}
            defaultSmokingTables={leagues.find((l) => l.id === leagueId)?.smokingTables}
          />
        ) : view === "details" ? (
          <LeagueDetailsView key={leagueId} leagueId={leagueId} leagues={leagues} aside={conferencesCard} />
        ) : view === "rounds" ? (
          <RoundsView leagueId={leagueId} data={leagueRounds} />
        ) : view === "dates" ? (
          <DatesView leagueId={leagueId} data={leagueNights} />
        ) : (
          <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: "20px"}}>
            <Card component="section" aria-label={`Ekipe lige ${leagueName}`} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
              {toolbar}
              {actionError && <ErrorNote sx={{m: "12px 14px 0"}}>{actionError}</ErrorNote>}
              <Box
                aria-hidden
                sx={{flex: "none", height: 40, display: "grid", gridTemplateColumns: TEAM_GRID, gap: "12px", alignItems: "center", px: "20px", background: color.paper2, borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
              >
                <span>Ekipa</span>
                <span>Igrači</span>
                <Box component="span" sx={{textAlign: "center"}}>
                  Odigrano
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
                        borderBottom: `1px solid ${color.divider}`,
                        background: confirmDelete === r.id ? tint.red[6] : r.id === justAdded ? color.cream2 : "transparent",
                        animation: r.id === justAdded ? "spRowIn 420ms cubic-bezier(.2,.8,.2,1) both" : "none",
                      }}
                    >
                      <Box sx={{display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, py: hasConferences ? "8px" : 0}}>
                        <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: r.active ? color.ink : color.muted, ...ellipsis}}>
                          {r.name}
                        </Box>
                        {hasConferences && <ConferencePicker teamName={r.name} value={r.conferenceId} conferences={confList} onPick={(id) => setConference(r, id)} />}
                      </Box>
                      <Box component="span" sx={{display: "flex", gap: "6px", minWidth: 0, overflow: "hidden", opacity: r.active ? 1 : 0.55}}>
                        {r.players.map((p) => (
                          <PlayerChip key={p} name={p} size="sm" />
                        ))}
                      </Box>
                      <Box component="span" sx={{textAlign: "center", fontSize: 15, color: color.ink2, fontVariantNumeric: "tabular-nums"}}>
                        {r.played ?? "—"}
                      </Box>
                      {statusToggle(r)}
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setConfirmDelete(confirmDelete === r.id ? null : r.id)}
                        aria-label={`Ukloni ${r.name} iz lige`}
                        aria-expanded={confirmDelete === r.id}
                        title="Ukloni iz lige"
                        sx={{
                          ...buttonBase,
                          width: 44,
                          height: 44,
                          borderRadius: "12px",
                          color: confirmDelete === r.id ? color.red : color.faint,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          "& svg": {fontSize: 22},
                          "&:hover": {background: tint.red[10], color: color.red},
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
                            background: tint.red[8],
                            borderTop: `1px solid ${tint.red[20]}`,
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            "& > svg": {fontSize: 24, color: color.red, flex: "none"},
                          }}
                        >
                          <WarningRoundedIcon />
                          <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                            <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.ink}}>
                              Ukloniti {r.name} iz ove lige?
                            </Box>
                            <Box component="span" sx={{fontSize: 13, color: color.ink2}}>
                              {removalNote(r.played)}
                            </Box>
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            sx={{...buttonBase, flex: "none", height: 42, px: "16px", border: `1.5px solid ${color.borderControl}`, borderRadius: "12px", background: color.white, color: color.navy, fontSize: 14, fontWeight: 600}}
                          >
                            Odustani
                          </Box>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => removeTeam(r)}
                            sx={{...buttonBase, flex: "none", height: 42, px: "16px", borderRadius: "12px", background: color.red, color: color.white, display: "flex", alignItems: "center", gap: "6px", fontSize: 14, fontWeight: 600, "& svg": {fontSize: 18}}}
                          >
                            <DeleteRoundedIcon />
                            Obriši ekipu
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
                        color: color.white,
                        fontSize: 14,
                        boxShadow: shadow.tooltip,
                      }}
                    >
                      <span>{pending.team.name} uklonjena iz lige</span>
                      <Box
                        component="button"
                        type="button"
                        onClick={undoRemoval}
                        sx={{...buttonBase, height: 36, px: "12px", borderRadius: "10px", background: tint.white[14], color: color.white, fontSize: 14, fontWeight: 600}}
                      >
                        Poništi
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
          <ScreenTitle title="Upravljanje ligom" sx={{px: 0}} />
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
                sx={{display: "flex", alignItems: "center", gap: "10px", p: "12px 10px 12px 16px", borderBottom: `1px solid ${color.line}`, background: r.id === justAdded ? color.cream2 : "transparent"}}
              >
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: r.active ? color.ink : color.muted, ...ellipsis}}>
                    {r.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
                    {r.players.join(" · ") || "—"}
                    {r.played != null && ` · ${r.played} OK`}
                  </Box>
                  {hasConferences && <ConferencePicker teamName={r.name} value={r.conferenceId} conferences={confList} onPick={(id) => setConference(r, id)} />}
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
        Dodaj ekipu
      </Box>
      <SearchInput
        soft
        height={50}
        placeholder="Traži postojeće ekipe"
        aria-label="Traži postojeće ekipe"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {hits != null && (
        <Box aria-live="polite" sx={{display: "flex", flexDirection: "column", border: `1px solid ${tint.navy[10]}`, borderRadius: "16px", overflow: "hidden"}}>
          {loading ? (
            <Box sx={{p: "16px 14px", display: "flex", gap: "10px", alignItems: "center", fontSize: 14, color: color.muted}}>
              <Spinner size={18} /> Tražim…
            </Box>
          ) : shown.length === 0 ? (
            <Box sx={{p: "18px 14px", fontSize: 14, color: color.muted}}>Nema ekipa izvan ove lige.</Box>
          ) : (
            shown.map((h) => (
              <Box key={h.id} sx={{minHeight: 58, display: "flex", alignItems: "center", gap: "10px", pl: "14px", pr: "8px", borderBottom: `1px solid ${color.divider}`}}>
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
                  sx={{borderRadius: "12px", background: color.navy, color: color.white, boxShadow: "none", "& svg": {fontSize: 24}}}
                >
                  {adding === h.id ? <Spinner size={20} tone="white" /> : <AddRoundedIcon />}
                </IconCircleButton>
              </Box>
            ))
          )}
          {!loading && left > 0 && <LoadMoreButton left={left} noun={NOUN.ekipa} onClick={() => setPages((n) => n + 1)} />}
        </Box>
      )}
      <OutlineButton onClick={onCreate} height={50} tone={color.navy} sx={{borderWidth: "1.5px", borderColor: tint.navy[25], fontSize: 15}}>
        <GroupAddRoundedIcon sx={{fontSize: 22}} />
        Nova ekipa
      </OutlineButton>
    </Card>
  );
}

function ViewSwitch({
  view,
  onChange,
  teams,
  rounds,
  nights,
}: {
  view: View;
  onChange: (v: View) => void;
  teams: number;
  rounds: number | null;
  nights: number | null;
}) {
  const items: {key: View; label: string; icon: ReactNode; count: number | null}[] = [
    {key: "create", label: "Novo kolo", icon: <AddCircleRoundedIcon />, count: null},
    {key: "teams", label: "Ekipe", icon: <GroupsRoundedIcon />, count: teams},
    {key: "rounds", label: "Kola", icon: <EventNoteRoundedIcon />, count: rounds},
    {key: "dates", label: "Datumi", icon: <CalendarMonthRoundedIcon />, count: nights},
    {key: "details", label: "Podaci", icon: <TuneRoundedIcon />, count: null},
  ];
  return (
    <Box role="tablist" aria-label="Prikaz" sx={{flex: "none", alignSelf: "flex-start", display: "flex", gap: "4px", p: "4px", borderRadius: "16px", background: color.white, boxShadow: shadow.card}}>
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
              color: on ? color.white : color.ink,
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
              <Box component="span" sx={{fontSize: 12, fontWeight: 700, color: on ? color.cream : color.faint}}>
                {it.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
