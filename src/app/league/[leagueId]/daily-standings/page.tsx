"use client";

import {ScrollMemory, useScrollMemory} from "@/app/_hooks/useBackRestore";
import useAdminPhone from "@/app/_hooks/useAdminPhone";
import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useElementHeight from "@/app/_hooks/useElementHeight";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagueTeams from "@/app/_hooks/useLeagueTeams";
import useLeagues from "@/app/_hooks/useLeagues";
import useMyTeams from "@/app/_hooks/useMyTeams";
import useConferences from "@/app/_hooks/useConferences";
import useConferenceFilter from "@/app/_hooks/useConferenceFilter";
import useNavStack from "@/app/_hooks/useNavStack";
import useOpenTable, {OpenTable} from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {useLeagueSponsors} from "@/app/_hooks/useSponsors";
import LiveRoundSponsors from "@/app/_ui/sponsors/LiveRoundSponsors";
import useAuthStore from "@/app/_store/authStore";
import {useDailyData, useRoundDates} from "@/app/_hooks/useStandings";
import {leagueNightString} from "@/app/_lib/dates";
import {ConferenceOf} from "@/app/_lib/conferences";
import {highlightParam, inConference, splitPodium, standingsTeamHref, toStandingsRows} from "@/app/_lib/ui/standings";
import {filterTables, liveCount, splitColumns, TableFilter, tableColumns, TableRow, toTableRows} from "@/app/_lib/ui/tables";
import {ConferenceFilter} from "@/app/_ui/league/ConferenceFilter";
import {count, displayDate, NOUN} from "@/app/_lib/ui/text";
import {color, font, shadow} from "@/app/_styles/tokens";
import {
  Card,
  ConfirmSheet,
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
  scrollIntoMiddle,
  Segmented,
  StackTopBar,
  StandingsGrid,
  StandingsRows,
  TabItem,
  tabPanelProps,
} from "@/app/_ui/sp";
import {BackPill} from "@/app/_ui/sp/BackPill";
import {DesktopTableRow, PhoneRoundTables, TABLE_ROW_HEIGHT, TableTarget} from "@/app/league/[leagueId]/daily-standings/ui/RoundTables";
import {ConfirmRemove, EditToggle, NewTableButton, PairDialog, PairSheet, RoundAdmin, RowActions, useTableEdits} from "@/app/league/[leagueId]/daily-standings/ui/RoundEditing";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import {replaceAddress, useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useEffect, useMemo, useRef, useState} from "react";

export default function DailyStandings() {
  const params = useParams<{leagueId: string}>();
  const leagueId = Number(params.leagueId);
  const router = useTransitionRouter();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const isAdmin = useIsAdmin();
  // the admin's phone (admin-mobile 18–22): Back, Osvježi, editing the round's tables, and the tables open
  const adminPhone = useAdminPhone();
  const leagues = useLeagues(leagueId);
  const {teams} = useMyTeams();
  const myTeamNames = useMemo(() => teams.map((t) => t.team_name), [teams]);
  // the night's table and a round's tables: Back from a team's or a table's page finds them where they were left
  const scroller = useScrollMemory("daily");
  const roundScroller = useScrollMemory("daily-round");
  // signed in: tables and team names open (signed out, nothing does)
  const signedIn = useAuthStore((s) => s.user != null);
  // the player's own table still to be played opens straight into the game (Nastavi igru / Započni igru)
  const {table: openTable} = useOpenTable();
  const game = useStartGame();

  // the night shown: ?date= when it is one the league played, otherwise the latest one
  const {dates, error: datesError, reload: reloadDates} = useRoundDates(leagueId);
  const dateParam = searchParams.get("date");
  const date = dates == null ? null : dateParam && dates.includes(dateParam) ? dateParam : dates[dates.length - 1] ?? "";
  const index = date && dates ? dates.indexOf(date) : -1;
  const prevDate = index > 0 ? dates[index - 1] : null;
  const nextDate = dates && index >= 0 && index < dates.length - 1 ? dates[index + 1] : null;
  // opened from a Team page's Zadnje večeri (?team=<id>): that team highlighted and scrolled to, and the page is a page
  // of the stack (Back to the team, and Home on the phone); the team stays in the address on another date or tab
  const highlightTeamId = highlightParam(searchParams.get("team"));
  const teamQuery = highlightTeamId != null ? `&team=${highlightTeamId}` : "";
  const goDate = (d: string | null) => d && router.router.replace(`/league/${leagueId}/daily-standings?date=${d}${teamQuery}`);

  const daily = useDailyData(leagueId, date || null);
  // tonight's night lasts until 06:00, so a night that runs past midnight is still "večeras" with no medals yet
  const today = leagueNightString();
  const isToday = date === today;

  // the league's conferences: the dots, and the conference picked for the night's table (null: every team). The round
  // tabs always show every table.
  const conferences = useConferences(leagueId);
  const [conf, setConf] = useConferenceFilter(leagueId, conferences.conferences);
  const confName = conferences.conferences.find((c) => c.id === conf)?.name;
  const allStandings = useMemo(
    () => toStandingsRows(daily.data?.standings, {myTeamNames, highlightTeamId, conferenceOf: conferences.of}),
    [daily.data, myTeamNames, highlightTeamId, conferences]
  );
  const standings = useMemo(() => inConference(allStandings, conf), [allStandings, conf]);
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
    // the tab is in the address, so Back from a table (or a team) comes back to it
    if (date) replaceAddress(`/league/${leagueId}/daily-standings?date=${date}${k ? `&round=${k}` : ""}${teamQuery}`);
  };
  // the name a Team or table page opened from here shows on its back pill: "‹ Kolo 3" from a round's tab
  const nav = useNavStack(tab ? `Kolo ${tab}` : "Dnevni poredak");
  // the admin's phone keeps its own top row (Back, Osvježi, editing)
  const fromTeam = highlightTeamId != null && signedIn && !adminPhone;
  const tabs: TabItem<number>[] = [{key: 0, label: "Tablica okupljanja"}, ...roundNumbers.map((n) => ({key: n, label: `Kolo ${n}`, live: roundsLive(n)}))];
  const roundRows = useMemo(
    () => toTableRows((daily.data?.rounds ?? []).filter((r) => r.round_number === tab), myTeamNames, conferences.of),
    [daily.data, tab, myTeamNames, conferences]
  );

  // the league's sponsors slide along the bottom of a round's tab on the admin's computer (the bar's screen); never on
  // the night's table or anywhere on the phone
  const sponsors = useLeagueSponsors(isDesktop && isAdmin ? leagueId : null);

  const changeLeague = (id: number) => router.router.push(`/league/${id}/daily-standings`);
  const noNights = dates != null && dates.length === 0;
  // before the league's first night there is no date to show
  const dateTitle = date ? displayDate(date) : noNights ? "Dnevni poredak" : "—";
  const loadError = datesError ?? daily.error;

  // the highlighted team in view once the night's table is there (a row of the podium shows itself); Back to the page
  // finds the list where it was left instead
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (highlightTeamId == null || tab !== 0 || standings.length === 0) return;
    const key = `${leagueId}:${date}:${highlightTeamId}:${isDesktop}`;
    const box = scroller.element();
    if (scrolledTo.current === key || !box) return;
    scrolledTo.current = key;
    const row = box.querySelector<HTMLElement>("[data-highlight]");
    const pinned = box.querySelector<HTMLElement>("[data-pinned]");
    if (scroller.restored() || !row || pinned?.contains(row)) return;
    scrollIntoMiddle(row, box, pinned?.offsetHeight ?? 0);
  }, [highlightTeamId, leagueId, date, isDesktop, tab, standings, scroller]);

  const phoneEdit = usePhoneEdit(adminPhone ? {leagueId, date: date || "", roundNumber: tab, onChanged: daily.refresh} : null, tab);
  const removeRow = roundRows.find((r) => r.id === phoneEdit.edits.confirmId) ?? null;

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
        lead={fromTeam ? <BackPill nav={nav} sx={{alignSelf: "center", maxWidth: 320}} /> : undefined}
        eyebrow={isToday ? "Okupljanje · večeras" : "Okupljanje"}
        title={dateTitle}
        right={
          <>
            <LeagueMenuButton leagues={leagues} value={leagueId} onChange={changeLeague} />
            {tabs.length > 1 && <HeaderTabs items={tabs} value={tab} onChange={pickTab} />}
            {arrows}
          </>
        }
        footer={isAdmin && tab > 0 && sponsors?.length ? <LiveRoundSponsors leagueId={leagueId} sponsors={sponsors} /> : undefined}
      >
        <Box {...tabPanelProps("daily", tab)} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "20px"}}>
          {tab === 0 && !loadError && !noNights && <ConferenceFilter conferences={conferences.conferences} value={conf} onChange={setConf} sx={{flex: "none"}} />}
          {loadError ? (
            <ErrorNote onRetry={datesError ? reloadDates : daily.reload}>{loadError}</ErrorNote>
          ) : noNights ? (
            <Card>
              <EmptyState>Ova liga još nema odigranih okupljanja.</EmptyState>
            </Card>
          ) : (daily.loading && !daily.data) || !conferences.ready ? (
            <Card sx={{flex: 1, overflow: "hidden"}}>
              <LoadingRows rows={10} height={56} />
            </Card>
          ) : tab === 0 ? (
            <DesktopNightTable rows={standings} date={confName ? `${dateTitle} · ${confName}` : dateTitle} scroller={scroller} />
          ) : (
            <DesktopRound
              title={`Kolo ${tab}`}
              rows={roundRows}
              admin={isAdmin ? {leagueId, date: date || "", roundNumber: tab, onChanged: daily.refresh} : null}
              conferenceOf={conferences.of}
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
      {fromTeam && <StackTopBar eyebrow="Okupljanje" nav={nav} />}
      {adminPhone && (
        <AdminTopRow
          onBack={nav.back}
          refreshedAt={daily.data}
          onRefresh={daily.refresh}
          editing={tab > 0 ? phoneEdit.editing : null}
          onEdit={phoneEdit.toggle}
        />
      )}
      <Box component="header" sx={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <LeagueEyebrowButton leagues={leagues} value={leagueId} onChange={changeLeague} />
          {/* the date shares the row with the two arrows: on a phone under 360 px wide it is smaller, so it ends before them */}
          <Display size={36} sx={{lineHeight: 1, fontVariantNumeric: "tabular-nums", "@media (max-width: 359.98px)": {fontSize: 30}}}>
            {dateTitle}
          </Display>
        </Box>
        {arrows}
      </Box>
      {tabs.length > 1 && <PillTabs items={tabs} value={tab} onChange={pickTab} label="Prikaz" idPrefix="daily" />}
      {tab === 0 && !loadError && !noNights && <ConferenceFilter conferences={conferences.conferences} value={conf} onChange={setConf} sx={{flex: "none"}} />}

      <Box {...tabPanelProps("daily", tab)} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
        {loadError ? (
          <ErrorNote onRetry={datesError ? reloadDates : daily.reload}>{loadError}</ErrorNote>
        ) : noNights ? (
          <Card>
            <EmptyState>Ova liga još nema odigranih okupljanja.</EmptyState>
          </Card>
        ) : (daily.loading && !daily.data) || !conferences.ready ? (
          <ScrollCard>
            <LoadingRows rows={8} />
          </ScrollCard>
        ) : tab === 0 ? (
          <ScrollCard ref={scroller.ref} aria-label={`Poredak okupljanja ${dateTitle}${confName ? ` · ${confName}` : ""}`}>
            {standings.length === 0 ? (
              <EmptyState>Nema rezultata za ovaj datum.</EmptyState>
            ) : (
              <StandingsRows rows={showPodium ? rest : standings} podium={showPodium ? podium : undefined} rowHref={standingsTeamHref} />
            )}
          </ScrollCard>
        ) : (
          <ScrollArea ref={roundScroller.ref} bleed sx={{gap: "10px"}}>
            {phoneEdit.edits.actionError && <ErrorNote>{phoneEdit.edits.actionError}</ErrorNote>}
            {game.error && <ErrorNote>{game.error}</ErrorNote>}
            <PhoneRoundTables
              title={adminPhone ? `Kolo ${tab} · ${count(roundRows.length, NOUN.stol)}` : `Kolo ${tab}`}
              rows={roundRows}
              tableTarget={signedIn ? (t) => phoneTableTarget(t, {leagueId, adminPhone, openTable, startGame: game.start}) : undefined}
              teamHref={signedIn ? (id) => `/teams/${id}` : undefined}
              fresh={phoneEdit.editing ? phoneEdit.edits.freshTable : null}
              edit={
                adminPhone && phoneEdit.editing
                  ? {
                      onPair: (t) => phoneEdit.edits.setPair({kind: "edit", row: t}),
                      onRemove: (t) => phoneEdit.edits.setConfirmId(t.id),
                      onAdd: () => phoneEdit.edits.setPair({kind: "new", tableNumber: roundRows.reduce((m, r) => Math.max(m, r.table), 0) + 1}),
                    }
                  : undefined
              }
            />
          </ScrollArea>
        )}
      </Box>

      {/* the admin goes back with the arrow at the top, as on every admin screen (no button that only closes) */}
      {!adminPhone && !fromTeam && (
        <PrimaryButton icon={<HomeRoundedIcon />} onClick={() => router.push("/", "back")}>
          Početni zaslon
        </PrimaryButton>
      )}

      {adminPhone && phoneEdit.edits.pair && (
        <PairSheet target={phoneEdit.edits.pair} rows={roundRows} teams={phoneEdit.teams ?? []} onClose={() => phoneEdit.edits.setPair(null)} onSave={phoneEdit.edits.savePair} conferenceOf={conferences.of} />
      )}
      {adminPhone && (
        <ConfirmSheet
          open={removeRow != null}
          onClose={() => phoneEdit.edits.setConfirmId(null)}
          onConfirm={() => removeRow && phoneEdit.edits.remove(removeRow.id)}
          title="Ukloniti stol?"
          text={removeRow ? `Stol ${removeRow.table} miče se iz ovog kola, a upisane igre za taj stol se brišu.` : ""}
          action="Ukloni stol"
          icon={<DeleteRoundedIcon />}
          busy={phoneEdit.edits.removing}
          error={removeRow ? phoneEdit.edits.actionError : null}
        />
      )}
    </Screen>
  );
}

// The admin's top row on the phone Dnevni poredak: Back, when the tables last came in with Osvježi, and on a round's
// tab the pencil that starts editing its tables (a check while editing)
function AdminTopRow({
  onBack,
  refreshedAt,
  onRefresh,
  editing,
  onEdit,
}: {
  onBack: () => void;
  // the data, which changes on every load
  refreshedAt: unknown;
  onRefresh: () => void;
  editing: boolean | null;
  onEdit: () => void;
}) {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    if (!refreshedAt) return;
    const d = new Date();
    setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  }, [refreshedAt]);
  return (
    <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "8px", mx: "-6px"}}>
      <IconCircleButton label="Natrag" size={44} onClick={onBack} sx={{"& svg": {fontSize: 26}}}>
        <ChevronLeftRoundedIcon />
      </IconCircleButton>
      <Box sx={{flex: 1}} />
      {time && (
        <Box component="span" sx={{fontSize: 13, color: color.muted, whiteSpace: "nowrap"}}>
          Osvježeno {time}
        </Box>
      )}
      <IconCircleButton label="Osvježi" size={44} onClick={onRefresh} sx={{"& svg": {fontSize: 22}}}>
        <RefreshRoundedIcon />
      </IconCircleButton>
      {editing != null && (
        <IconCircleButton
          label={editing ? "Završi uređivanje stolova" : "Uredi stolove"}
          aria-pressed={editing}
          size={44}
          onClick={onEdit}
          sx={{...(editing && {background: color.navy, color: color.white}), "& svg": {fontSize: 22}}}
        >
          {editing ? <CheckRoundedIcon /> : <EditRoundedIcon />}
        </IconCircleButton>
      )}
    </Box>
  );
}

// The desktop header's tabs. A long night (many rounds) scrolls sideways instead of squeezing the date: the side that
// has more tabs fades out, a vertical mouse wheel scrolls the strip, and the open tab is kept clear of the fade. The
// white pill is drawn by the wrapper, so the fade takes only the tabs (a mask also cuts the strip's own shadow).
const TAB_FADE = 40;

function HeaderTabs({items, value, onChange}: {items: TabItem<number>[]; value: number; onChange: (k: number) => void}) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({left: false, right: false});
  const shape = items.map((t) => `${t.key}${t.live ? "*" : ""}`).join();

  // which sides have tabs out of view: on a scroll, and when the strip or a tab changes size (a narrower window,
  // a new round, a live dot)
  useEffect(() => {
    const strip = ref.current?.querySelector<HTMLElement>("[role=tablist]");
    if (!strip) return;
    const update = () => {
      const left = strip.scrollLeft > 1;
      const right = strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1;
      setMore((m) => (m.left === left && m.right === right ? m : {left, right}));
    };
    // a mouse wheel turns up and down: move the strip sideways instead (a trackpad's sideways swipe already does),
    // and let the page have the wheel once the strip is at its end
    const onWheel = (e: WheelEvent) => {
      if (strip.scrollWidth <= strip.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? strip.clientWidth : 1;
      const before = strip.scrollLeft;
      strip.scrollLeft += e.deltaY * unit;
      if (strip.scrollLeft !== before) e.preventDefault();
    };
    update();
    const sizes = new ResizeObserver(update);
    sizes.observe(strip);
    Array.from(strip.children).forEach((tab) => sizes.observe(tab));
    strip.addEventListener("scroll", update, {passive: true});
    strip.addEventListener("wheel", onWheel, {passive: false});
    return () => {
      sizes.disconnect();
      strip.removeEventListener("scroll", update);
      strip.removeEventListener("wheel", onWheel);
    };
  }, [shape]);

  // keep the open tab in view and out of the fade, and a tab reached with the keyboard (Tab into the strip); not on a
  // click's focus, which would move the strip between press and release and lose the click
  useEffect(() => {
    const strip = ref.current?.querySelector<HTMLElement>("[role=tablist]");
    revealTab(strip, strip?.querySelector<HTMLElement>("[aria-selected=true]"));
  }, [value, items.length]);
  const onFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (e.target.matches("[role=tab]:focus-visible")) revealTab(ref.current?.querySelector<HTMLElement>("[role=tablist]"), e.target);
  };

  // only the mask's alpha counts: the tabs show where it is opaque and fade out towards a clear end
  const end = (fade: boolean) => (fade ? "transparent" : color.ink);
  const mask = more.left || more.right ? `linear-gradient(to right, ${end(more.left)}, ${color.ink} ${TAB_FADE}px, ${color.ink} calc(100% - ${TAB_FADE}px), ${end(more.right)})` : "none";
  return (
    <Box ref={ref} onFocus={onFocus} sx={{flex: "0 1 auto", minWidth: 0, display: "flex", borderRadius: "24px", background: color.white, boxShadow: shadow.card}}>
      <Segmented
        items={items}
        value={value}
        onChange={onChange}
        label="Prikaz"
        idPrefix="daily"
        sx={{flex: "1 1 auto", minWidth: 0, overflowX: "auto", scrollbarWidth: "none", boxShadow: "none", maskImage: mask}}
      />
    </Box>
  );
}

// Scrolls the strip (only the strip, not the page) so the tab is whole and clear of the fade at either end
function revealTab(strip: HTMLElement | null | undefined, tab: HTMLElement | null | undefined) {
  if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
  const box = strip.getBoundingClientRect();
  const r = tab.getBoundingClientRect();
  if (r.left < box.left + TAB_FADE) strip.scrollLeft -= box.left + TAB_FADE - r.left;
  else if (r.right > box.right - TAB_FADE) strip.scrollLeft += r.right - (box.right - TAB_FADE);
}

// Desktop "Tablica okupljanja": podium and the full table with real columns. Teams still playing are marked red on
// the podium too, so a live night reads the same from 1st place down.
function DesktopNightTable({rows, date, scroller}: {rows: ReturnType<typeof toStandingsRows>; date: string; scroller: ScrollMemory}) {
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
      <Podium rows={podium} showLive rowHref={standingsTeamHref} />
      <Card ref={scroller.ref} sx={{flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable", borderRadius: "22px", alignSelf: "stretch"}}>
        <StandingsGrid rows={podium.length ? rest : rows} caption={`Poredak okupljanja ${date}`} sx={{"& tr[role=row]": {px: "18px"}}} rowHref={standingsTeamHref} />
      </Card>
    </>
  );
}

// Desktop round view: every table at once, in 1–3 columns, with status filters and a search. One column while every
// table fits the height on screen, so a short round reads straight down.
// admin: edit mode (re-pair, remove and add tables), and every table opens its scorepad. conferenceOf: the league's
// conferences, for the dots in the pair dialog's team lists
function DesktopRound({title, rows, admin, conferenceOf}: {title: string; rows: ReturnType<typeof toTableRows>; admin: RoundAdmin | null; conferenceOf: ConferenceOf}) {
  const [filter, setFilter] = useState<TableFilter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const {pair, setPair, confirmId, setConfirmId, removing, remove, savePair, freshTable, actionError, setActionError, reset} = useTableEdits(admin);
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
    reset();
  };
  const nextTable = rows.reduce((m, r) => Math.max(m, r.table), 0) + 1;

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "12px"}}>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px"}}>
        <Box sx={{display: "flex", alignItems: "baseline", gap: "14px", minWidth: 0}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, whiteSpace: "nowrap"}}>
            {title}
          </Box>
          <Box sx={{fontSize: 16, color: color.ink2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"}}>
            {count(rows.length, NOUN.stol)} · {live} uživo
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
        <PairDialog target={pair} rows={rows} teams={leagueTeams ?? []} roundLabel={title} onClose={() => setPair(null)} onSave={savePair} conferenceOf={conferenceOf} />
      )}
    </Box>
  );
}

// Editing a round's tables on the admin's phone: on while the pencil is pressed, off again on another tab
function usePhoneEdit(admin: RoundAdmin | null, tab: number) {
  const [editing, setEditing] = useState(false);
  const edits = useTableEdits(admin);
  const {teams} = useLeagueTeams(admin && editing ? admin.leagueId : null);
  useEffect(() => {
    setEditing(false);
    edits.reset();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    setEditing((e) => !e);
    edits.reset();
  };
  return {editing: admin != null && editing, toggle, edits, teams};
}

// Where a table card on the phone goes: the admin's scorepad of the table, or for a player their own table still to
// be played straight into the game (the table Početna offers), and any other table its Pregled stola
function phoneTableTarget(
  t: TableRow,
  {leagueId, adminPhone, openTable, startGame}: {leagueId: number; adminPhone: boolean; openTable: OpenTable | null; startGame: () => void}
): TableTarget {
  if (!adminPhone && openTable?.roundId === t.id && !t.done) {
    return {cue: t.started ? "Nastavi igru" : "Započni igru", onClick: startGame};
  }
  return {href: `/league/${leagueId}/daily-standings/table/${t.id}`};
}
