"use client";

import useBurza from "@/app/_hooks/useBurza";
import useAdminViewStore from "@/app/_store/adminViewStore";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useMySchedule from "@/app/_hooks/useMySchedule";
import useOpenTable from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {currentLeagueHref} from "@/app/_lib/league";
import {color, shadow} from "@/app/_styles/tokens";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import {BurzaHomeCard, HomeTile, NextNightCard, NextNightPlaceholder, nextNight} from "@/app/_ui/home/HomeCards";
import {StartCard} from "@/app/_ui/home/StartCard";
import {ByeCard, NextTableCard, NoNightCard} from "@/app/_ui/home/TonightCards";
import {homeCard} from "@/app/_lib/homeCard";
import {MyLeague} from "@/app/_interfaces/burza";
import {NightLocation} from "@/app/_lib/nights";
import {useNow} from "@/app/_ui/home/LeagueArrival";
import {LeaveRow} from "@/app/_ui/home/LeaveParts";
import {leagueArrivalAPI} from "@/app/_fetchers/league/arrival";
import {leagueArrivalPhase} from "@/app/_lib/leagueArrival";
import HomeSponsors from "@/app/_ui/home/HomeSponsors";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {buttonBase, ErrorNote, IconCircleButton, InitialsAvatar, Screen, Segmented, tabPanelProps, visuallyHidden} from "@/app/_ui/sp";
import useAuthStore from "@/app/_store/authStore";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import {Box} from "@mui/material";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useMyRating} from "@/app/_hooks/useRatings";
import {useManages} from "@/app/_hooks/useCan";
import {useTournaments} from "@/app/_hooks/useTournaments";
import TournamentsOverview, {playingToday} from "@/app/_ui/tournaments/TournamentsOverview";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import {useState} from "react";

// under 400 px the header holds the brand (with its logo) next to an admin's Admin button only as an icon
const narrowPhone = "@media (max-width: 399.98px)";
// the wordmark inside Brand (its logo, then the name's column)
const BRAND_NAME = "& > div > div > div:last-of-type";

// Početna on the phone, the only Home (handoff §2; Claude Design "Burza v2" screen "home", and "Natjecanja" S1–S4):
// the header with the rating chip, the switch Turniri · Liga (remembered on the phone), and under it the league's Home
// (the top card, the Burza igrača card, the 2×2 tiles and the league's sponsors) or the tournaments'
// (TournamentsOverview). Nothing is edited here. An admin sees it after "Prikaz igrača" on Večer lige (admin-mobile
// 04), with an Admin button next to Moj profil that switches back.
export default function PhoneHome() {
  const router = useTransitionRouter();
  // the profile button shows the player's photo, when there is one
  const me = useAuthStore((s) => s.user);
  const isAdmin = useManages();
  const setAdminView = useAdminViewStore((st) => st.setView);
  const {me: myRating} = useMyRating();
  const {schedule} = useMySchedule();
  const {tournaments} = useTournaments();
  const [tab, setTab] = useState<HomeTab | null>(readHomeTab);
  const playing = playingToday(tournaments);
  // the first time: Liga, or Turniri for a player in no league or whose tournament is being played today
  const shown: HomeTab = tab ?? (playing || (schedule != null && schedule.leagues.length === 0) ? "turniri" : "liga");
  const pick = (t: HomeTab) => {
    setTab(t);
    saveHomeTab(t);
  };

  return (
    <Screen gap={12}>
      {/* 4 px more under the header than between the cards, as designed */}
      <Box component="header" sx={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px", pb: "4px"}}>
        {/* minWidth 0: on a narrow phone the brand's logo gives way to the buttons. Next to the rating chip the name
            takes two lines (one word each), and under 400 px a smaller logo and name, so it still fits by an admin's
            Admin button */}
        <Box
          component="h1"
          sx={{
            m: 0,
            fontWeight: "inherit",
            minWidth: 0,
            [BRAND_NAME]: {fontSize: 30, whiteSpace: "normal", width: "min-content"},
            [narrowPhone]: {"& > div": {gap: "8px"}, "& img": {width: 36, height: 36}, [BRAND_NAME]: {fontSize: 22}},
          }}
        >
          <Brand variant="home" />
        </Box>
        <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "8px"}}>
          {isAdmin && (
            <Box
              component="button"
              type="button"
              onClick={() => setAdminView("admin")}
              title="Natrag na admin"
              sx={{
                ...buttonBase,
                height: 44,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                p: "0 14px 0 11px",
                borderRadius: "22px",
                background: color.navy,
                color: color.white,
                fontSize: 14,
                fontWeight: 700,
                boxShadow: shadow.raised,
                "& svg": {fontSize: 20},
                // a phone under 400 px has no room for the label next to the brand's logo: the icon alone
                [narrowPhone]: {width: 44, p: 0, justifyContent: "center"},
              }}
            >
              <AdminPanelSettingsRoundedIcon aria-hidden />
              <Box component="span" sx={{[narrowPhone]: visuallyHidden}}>
                Admin
              </Box>
            </Box>
          )}
          {myRating && <RatingChip rating={myRating.rating} />}
          <IconCircleButton label="Moj profil" onClick={() => router.push("/profile")}>
            {me?.photo_url ? <InitialsAvatar name={me.username} src={me.photo_url} size={40} variant="navy" /> : <AccountCircleRoundedIcon />}
          </IconCircleButton>
        </Box>
      </Box>

      <Segmented<HomeTab>
        items={[
          {
            key: "turniri",
            label: (
              <>
                <MilitaryTechRoundedIcon aria-hidden sx={{fontSize: 20}} />
                Turniri
              </>
            ),
            live: shown === "liga" && playing,
          },
          {
            key: "liga",
            label: (
              <>
                <EventRepeatRoundedIcon aria-hidden sx={{fontSize: 20}} />
                Liga
              </>
            ),
          },
        ]}
        value={shown}
        onChange={pick}
        label="Početna"
        variant="track"
        size={48}
        idPrefix="home"
      />

      <Box {...tabPanelProps("home", shown)} sx={{display: "flex", flexDirection: "column", gap: "12px"}}>
        {shown === "liga" ? <LeagueHome /> : <TournamentsOverview withBurza />}
      </Box>

      <InstallSheet />
    </Screen>
  );
}

export type HomeTab = "turniri" | "liga";
const HOME_TAB_KEY = "treseta.homeTab";

// the tab picked last on this phone (none the first time, or where storage isn't available)
export function readHomeTab(): HomeTab | null {
  try {
    const v = window.localStorage.getItem(HOME_TAB_KEY);
    return v === "turniri" || v === "liga" ? v : null;
  } catch {
    return null;
  }
}

export function saveHomeTab(t: HomeTab) {
  try {
    window.localStorage.setItem(HOME_TAB_KEY, t);
  } catch {
    // not remembered: the next visit picks the tab again
  }
}

// Početna · Liga: the league's Home as it was before the tournaments (only a league's table on the top card)
function LeagueHome() {
  const leagueId = useSelectedLeagueId();
  const {table: openTable, loading: openTableLoading} = useOpenTable("league");
  const {start, starting, error} = useStartGame({scope: "league"});
  const {schedule, error: scheduleError, reload: reloadSchedule} = useMySchedule();
  const next = nextNight(schedule);
  const {posts} = useBurza();
  const now = useNow();
  // the team at the table tonight that is here (Tu smo): Odlazimo under Započni igru
  const here = schedule?.leagues.find((l) => l.arrival?.night === schedule.today && l.arrival.arrival?.here && leagueArrivalPhase(l.arrival, now) !== "over");
  // which card is on top (LOCATIONS_PLAN.md, decisions 20–21): the table, Kraj večeri, Pauza, Sljedeći stol, the
  // night's card or Nema zakazane večeri. The team's evening counts while its night is the day's (until midnight).
  const evening = next && next.league.tonight?.night === next.night ? next.league.tonight : null;
  const arrival = next && next.league.arrival?.night === next.night ? next.league.arrival : null;
  const card = homeCard({
    openTable: openTable != null,
    tonight: evening
      ? {
          // without Potvrda dolaska (no start time) the night is on once its place has a Kolo, and every team is here
          started: arrival ? leagueArrivalPhase(arrival, now) === "started" : evening.kola > 0,
          here: arrival ? arrival.arrival?.here === true : true,
          lastTable: evening.lastTable && {kolo: evening.lastTable.kolo, bye: evening.lastTable.bye},
          lastKoloOut: evening.lastKoloOut,
        }
      : null,
    nextNight: next != null,
  });
  // the team's place on a two-place night (Pauza says where the number of teams is odd)
  const placeName = next?.league.secondPlaces[next.night] ? placeOfTeam(next.league, next.night)?.name ?? null : null;
  const leave = here && (
    <LeaveRow
      title="Odlazite?"
      text="Ekipa ne ulazi u iduće novo kolo. Kola koja su već objavljena ostaju kakva jesu."
      onLeave={async () => {
        await leagueArrivalAPI(here.league_id, here.team_id, "leave");
        reloadSchedule();
      }}
    />
  );

  return (
    <>
      {/* the table to play tonight; the rest of the week, the team's next night. While the open round loads, the
          neutral frame (named like the Start card, so the scoreboard still shrinks into it on the way back) */}
      {openTable ? (
        <>
          <StartCard table={openTable} starting={starting} onStart={start} errorId={error ? "start-error" : undefined} />
          {leave}
        </>
      ) : openTableLoading ? (
        <Box sx={{flex: "none", borderRadius: "24px", viewTransitionName: "table"}}>
          <NextNightPlaceholder />
        </Box>
      ) : next && evening && card === "end" ? (
        <NextNightCard league={next.league} night={next.night} today={schedule!.today} end={{kola: evening.kola, next: next.league.nights.find((n) => n > next.night) ?? null}} />
      ) : next && evening?.lastTable && card === "bye" ? (
        <>
          <ByeCard kolo={evening.lastTable.kolo} place={placeName} />
          {leave}
        </>
      ) : next && evening?.lastTable && card === "next" ? (
        <>
          <NextTableCard league={next.league} last={evening.lastTable} />
          {leave}
        </>
      ) : next ? (
        <NextNightCard league={next.league} night={next.night} today={schedule!.today} onArrivalChanged={reloadSchedule} />
      ) : schedule || scheduleError ? (
        <NoNightCard />
      ) : (
        <NextNightPlaceholder />
      )}
      {error && (
        <Box id="start-error">
          <ErrorNote>{error}</ErrorNote>
        </Box>
      )}

      <BurzaHomeCard posts={posts} />

      <Box component="nav" aria-label="Izbornik" sx={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "8px"}}>
        <HomeTile href={next ? `/raspored?league=${next.league.league_id}` : "/raspored"} icon={<EventRoundedIcon />} label="Raspored" />
        <HomeTile href={currentLeagueHref("daily-standings", leagueId)} icon={<CalendarMonthRoundedIcon />} label="Dnevni poredak" />
        <HomeTile href={currentLeagueHref("standings", leagueId)} icon={<EmojiEventsRoundedIcon />} label="Ukupni poredak" />
        <HomeTile href="/ratings" icon={<LeaderboardRoundedIcon />} label="Rejting" />
      </Box>

      <HomeSponsors leagueId={leagueId} />
    </>
  );
}

// The rating next to the profile (as chess apps have it): opens Rejting
function RatingChip({rating}: {rating: number}) {
  return (
    <Box
      component={TransitionLink}
      href="/ratings"
      aria-label={`Rejting ${rating}`}
      sx={{...buttonBase, height: 40, display: "flex", alignItems: "center", gap: "5px", pl: "10px", pr: "12px", borderRadius: "20px", background: color.white, color: color.ink, fontSize: 16, fontWeight: 800, textDecoration: "none", boxShadow: shadow.pill, fontVariantNumeric: "tabular-nums", "& svg": {fontSize: 19, color: color.navy}}}
    >
      <LeaderboardRoundedIcon aria-hidden />
      {rating}
    </Box>
  );
}

// The team's place on a night: on a two-place night the one Podjela put it at (null before that), else the night's
function placeOfTeam(league: MyLeague, night: string): NightLocation | null {
  const second = league.secondPlaces[night];
  if (!second) return league.places[night] ?? null;
  const slot = league.slots[night];
  return slot === 2 ? second : slot === 1 ? (league.places[night] ?? null) : null;
}
