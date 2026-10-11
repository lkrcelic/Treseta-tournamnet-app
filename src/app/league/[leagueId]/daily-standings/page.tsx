"use client";

import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useElementHeight from "@/app/_hooks/useElementHeight";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagueTeams from "@/app/_hooks/useLeagueTeams";
import {addTableAPI, removeTableAPI, setTablePairAPI} from "@/app/_fetchers/admin/daily";
import useLeagues from "@/app/_hooks/useLeagues";
import useMyTeams from "@/app/_hooks/useMyTeams";
import {useDailyData, useRoundDates} from "@/app/_hooks/useStandings";
import {leagueDateString} from "@/app/_lib/dates";
import {splitPodium, toStandingsRows} from "@/app/_lib/ui/standings";
import {filterTables, liveCount, splitColumns, TableFilter, tableColumns, toTableRows} from "@/app/_lib/ui/tables";
import {displayDate, plural} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {
  Card,
  DesktopShell,
  Display,
  EmptyState,
  ErrorNote,
  IconCircleButton,
  LeagueEyebrowButton,
  LeagueMenuButton,
  LoadingRows,
  PillTabs,
  Podium,
  PrimaryButton,
  Screen,
  ScrollArea,
  ScrollCard,
  SearchInput,
  Segmented,
  StandingsGrid,
  StandingsRows,
  tabPanelProps,
} from "@/app/_ui/sp";
import {DesktopTableRow, PhoneRoundTables, TABLE_ROW_HEIGHT} from "@/app/league/[leagueId]/daily-standings/ui/RoundTables";
import {ConfirmRemove, EditToggle, NewTableButton, PairDialog, PairTarget, RowActions} from "@/app/league/[leagueId]/daily-standings/ui/RoundEditing";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useEffect, useMemo, useState} from "react";

export default function DailyStandings() {
  const params = useParams<{leagueId: string}>();
  const leagueId = Number(params.leagueId);
  const router = useTransitionRouter();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const isAdmin = useIsAdmin();
  const leagues = useLeagues(leagueId);
  const {teams} = useMyTeams();
  const myTeamNames = useMemo(() => teams.map((t) => t.team_name), [teams]);

  // the night shown: ?date= when it is one the league played, otherwise the latest one
  const {dates, error: datesError, reload: reloadDates} = useRoundDates(leagueId);
  const dateParam = searchParams.get("date");
  const date = dates == null ? null : dateParam && dates.includes(dateParam) ? dateParam : dates[dates.length - 1] ?? "";
  const index = date && dates ? dates.indexOf(date) : -1;
  const prevDate = index > 0 ? dates[index - 1] : null;
  const nextDate = dates && index >= 0 && index < dates.length - 1 ? dates[index + 1] : null;
  const goDate = (d: string | null) => d && router.router.replace(`/league/${leagueId}/daily-standings?date=${d}`);

  const daily = useDailyData(leagueId, date || null);
  const today = leagueDateString();
  const isToday = date === today;

  const standings = useMemo(() => toStandingsRows(daily.data?.standings, myTeamNames), [daily.data, myTeamNames]);
  const roundNumbers = daily.data?.roundNumbers ?? [];
  const roundsLive = (n: number) => (daily.data?.rounds ?? []).some((r) => r.round_number === n && r.active);

  // tab 0 is the night's table, then one tab per round; the desktop opens on the round being played,
  // or on ?round= (coming back from a table's scorepad)
  const roundParam = Number(searchParams.get("round")) || 0;
  const [tab, setTab] = useState(roundParam);
  const [tabTouched, setTabTouched] = useState(roundParam > 0);
  useEffect(() => {
    setTab(roundParam);
    setTabTouched(roundParam > 0);
  }, [date, leagueId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isDesktop || tabTouched || !daily.data) return;
    const live = [...roundNumbers].reverse().find((n) => roundsLive(n));
    if (live) setTab(live);
  }, [isDesktop, tabTouched, daily.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickTab = (k: number) => {
    setTab(k);
    setTabTouched(true);
  };
  const tabs = [{key: 0, label: "Tablica okupljanja"}, ...roundNumbers.map((n) => ({key: n, label: `Round ${n}`, live: roundsLive(n)}))];
  const roundRows = useMemo(
    () => toTableRows((daily.data?.rounds ?? []).filter((r) => r.round_number === tab), myTeamNames),
    [daily.data, tab, myTeamNames]
  );

  const changeLeague = (id: number) => router.router.push(`/league/${id}/daily-standings`);
  const noNights = dates != null && dates.length === 0;
  // before the league's first night there is no date to show
  const dateTitle = date ? displayDate(date) : noNights ? "Dnevni poredak" : "—";
  const loadError = datesError ?? daily.error;

  const arrows = (
    <Box sx={{display: "flex", gap: "8px", flex: "none"}}>
      <IconCircleButton label="Prethodni datum" onClick={() => goDate(prevDate)} disabled={!prevDate}>
        <ChevronLeftRoundedIcon />
      </IconCircleButton>
      <IconCircleButton label="Sljedeći datum" onClick={() => goDate(nextDate)} disabled={!nextDate}>
        <ChevronRightRoundedIcon />
      </IconCircleButton>
    </Box>
  );

  if (isDesktop) {
    return (
      <DesktopShell
        active="daily"
        eyebrow={isToday ? "Okupljanje · večeras" : "Okupljanje"}
        title={dateTitle}
        right={
          <>
            <LeagueMenuButton leagues={leagues} value={leagueId} onChange={changeLeague} />
            {/* a long night (many rounds) scrolls sideways instead of squeezing the date */}
            {tabs.length > 1 && (
              <Segmented
                items={tabs}
                value={tab}
                onChange={pickTab}
                label="Prikaz"
                idPrefix="daily"
                sx={{flex: "0 1 auto", minWidth: 0, overflowX: "auto", scrollbarWidth: "none"}}
              />
            )}
            {arrows}
          </>
        }
      >
        <Box {...tabPanelProps("daily", tab)} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "20px"}}>
          {loadError ? (
            <ErrorNote onRetry={datesError ? reloadDates : daily.reload}>{loadError}</ErrorNote>
          ) : noNights ? (
            <Card>
              <EmptyState>Ova liga još nema odigranih okupljanja.</EmptyState>
            </Card>
          ) : daily.loading && !daily.data ? (
            <Card sx={{flex: 1, overflow: "hidden"}}>
              <LoadingRows rows={10} height={56} />
            </Card>
          ) : tab === 0 ? (
            <DesktopNightTable rows={standings} date={dateTitle} />
          ) : (
            <DesktopRound
              title={`Round ${tab}`}
              rows={roundRows}
              admin={isAdmin ? {leagueId, date: date || "", roundNumber: tab, onChanged: daily.refresh} : null}
            />
          )}
        </Box>
      </DesktopShell>
    );
  }

  // the medals go up once the night is over: an earlier night, or tonight once every table is closed
  const {podium, rest} = splitPodium(standings);
  const tables = daily.data?.rounds ?? [];
  const nightDone = !isToday || (tables.length > 0 && tables.every((r) => r.open === false));
  const showPodium = nightDone && podium.length > 0;

  return (
    <Screen fill>
      <Box component="header" sx={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={changeLeague} />
          <Display size={36} sx={{lineHeight: 1, fontVariantNumeric: "tabular-nums"}}>
            {dateTitle}
          </Display>
        </Box>
        {arrows}
      </Box>
      {tabs.length > 1 && <PillTabs items={tabs} value={tab} onChange={pickTab} label="Prikaz" idPrefix="daily" />}

      <Box {...tabPanelProps("daily", tab)} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
        {loadError ? (
          <ErrorNote onRetry={datesError ? reloadDates : daily.reload}>{loadError}</ErrorNote>
        ) : noNights ? (
          <Card>
            <EmptyState>Ova liga još nema odigranih okupljanja.</EmptyState>
          </Card>
        ) : daily.loading && !daily.data ? (
          <ScrollCard>
            <LoadingRows rows={8} />
          </ScrollCard>
        ) : tab === 0 ? (
          <ScrollCard aria-label={`Poredak okupljanja ${dateTitle}`}>
            {standings.length === 0 ? (
              <EmptyState>Nema rezultata za ovaj datum.</EmptyState>
            ) : (
              <StandingsRows rows={showPodium ? rest : standings} podium={showPodium ? podium : undefined} />
            )}
          </ScrollCard>
        ) : (
          <ScrollArea bleed sx={{gap: "10px"}}>
            <PhoneRoundTables title={`Round ${tab}`} rows={roundRows} />
          </ScrollArea>
        )}
      </Box>

      <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
        Početni zaslon
      </PrimaryButton>
    </Screen>
  );
}

// Desktop "Tablica okupljanja": podium and the full table with real columns
function DesktopNightTable({rows, date}: {rows: ReturnType<typeof toStandingsRows>; date: string}) {
  const {podium, rest} = splitPodium(rows);
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState>Nema rezultata za ovaj datum.</EmptyState>
      </Card>
    );
  }
  return (
    <>
      <Podium rows={podium} />
      <Card sx={{flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable", borderRadius: "22px", alignSelf: "stretch"}}>
        <StandingsGrid rows={podium.length ? rest : rows} caption={`Poredak okupljanja ${date}`} sx={{"& tr[role=row]": {px: "18px"}}} />
      </Card>
    </>
  );
}

// Desktop round view: every table at once, in 1–3 columns, with status filters and a search. One column while every
// table fits the height on screen, so a short round reads straight down.
type RoundAdmin = {leagueId: number; date: string; roundNumber: number; onChanged: () => void};

// admin: edit mode (re-pair, remove and add tables), and every table opens its scorepad
function DesktopRound({title, rows, admin}: {title: string; rows: ReturnType<typeof toTableRows>; admin: RoundAdmin | null}) {
  const [filter, setFilter] = useState<TableFilter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [pair, setPair] = useState<PairTarget | null>(null);
  // the number of the table added last, highlighted until editing ends
  const [freshTable, setFreshTable] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {teams: leagueTeams} = useLeagueTeams(admin && editing ? admin.leagueId : null);
  const visible = filterTables(rows, filter, query);
  const [areaRef, areaHeight] = useElementHeight<HTMLDivElement>();
  const cols = tableColumns(rows.length, areaHeight == null ? undefined : Math.floor(areaHeight / TABLE_ROW_HEIGHT));
  const columns = splitColumns(visible, cols);
  const live = liveCount(rows);
  const filters = [
    {key: "all" as TableFilter, label: "Svi", count: rows.length},
    {key: "live" as TableFilter, label: "Uživo", count: live, alert: true},
    {key: "done" as TableFilter, label: "Gotovo", count: rows.filter((r) => r.done).length},
  ];

  const toggleEdit = () => {
    setEditing((e) => !e);
    setConfirmId(null);
    setFreshTable(null);
    setActionError(null);
  };
  const remove = async (id: number) => {
    if (!admin) return;
    setRemoving(true);
    setActionError(null);
    try {
      await removeTableAPI(id);
      setConfirmId(null);
      admin.onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Stol nije uklonjen.");
    }
    setRemoving(false);
  };
  const savePair = async (team1Id: number, team2Id: number) => {
    if (!admin || !pair) return;
    if (pair.kind === "edit") await setTablePairAPI(pair.row.id, team1Id, team2Id);
    else {
      await addTableAPI(admin.leagueId, admin.date, admin.roundNumber, team1Id, team2Id);
      setFreshTable(pair.tableNumber);
    }
    setPair(null);
    admin.onChanged();
  };
  const nextTable = rows.reduce((m, r) => Math.max(m, r.table), 0) + 1;

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "12px"}}>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px"}}>
        <Box sx={{display: "flex", alignItems: "baseline", gap: "14px", minWidth: 0}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, whiteSpace: "nowrap"}}>
            {title}
          </Box>
          <Box sx={{fontSize: 16, color: color.inkSoft, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"}}>
            {rows.length} {plural(rows.length, "stol", "stola", "stolova")} · {live} uživo
          </Box>
        </Box>
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          {admin && editing && <NewTableButton onClick={() => setPair({kind: "new", tableNumber: nextTable})} />}
          {admin && <EditToggle editing={editing} onClick={toggleEdit} />}
          <SearchInput
            soft
            height={44}
            placeholder="Ekipa ili broj stola"
            aria-label="Traži ekipu ili broj stola"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{width: admin ? 220 : 260}}
          />
          <Segmented<TableFilter>
            items={filters}
            value={filter}
            onChange={setFilter}
            label="Filtriraj stolove"
            variant="panel"
            size={38}
            asTabs={false}
          />
        </Box>
      </Box>
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      <Box ref={areaRef} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
        {visible.length === 0 ? (
          <Card>
            <EmptyState>Nema stolova za ovaj filter.</EmptyState>
          </Card>
        ) : (
          <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: "16px", alignItems: "start"}}>
            {columns.map((col, i) =>
              col.length ? (
                <Card key={i} component="ul" sx={{listStyle: "none", m: 0, p: 0, maxHeight: "100%", overflowY: "auto", scrollbarGutter: "stable"}}>
                  {col.map((t) => (
                    <DesktopTableRow
                      key={t.id}
                      t={t}
                      dense={cols >= 3}
                      href={admin && !editing && !t.bye ? `/league/${admin.leagueId}/daily-standings/table/${t.id}` : undefined}
                      actions={
                        admin && editing ? (
                          <RowActions
                            t={t}
                            onEdit={() => setPair({kind: "edit", row: t})}
                            onRemove={() => {
                              setConfirmId(t.id);
                              setActionError(null);
                            }}
                          />
                        ) : undefined
                      }
                      onOpen={admin && editing ? () => setPair({kind: "edit", row: t}) : undefined}
                      fresh={editing && t.table === freshTable}
                      confirm={
                        admin && editing && confirmId === t.id ? (
                          <ConfirmRemove t={t} busy={removing} onCancel={() => setConfirmId(null)} onConfirm={() => remove(t.id)} />
                        ) : undefined
                      }
                    />
                  ))}
                </Card>
              ) : (
                <Box key={i} />
              )
            )}
          </Box>
        )}
      </Box>
      {pair && admin && (
        <PairDialog target={pair} rows={rows} teams={leagueTeams ?? []} roundLabel={title} onClose={() => setPair(null)} onSave={savePair} />
      )}
    </Box>
  );
}
