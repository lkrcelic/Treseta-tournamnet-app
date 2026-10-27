"use client";

import useBurza from "@/app/_hooks/useBurza";
import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useAdminViewStore from "@/app/_store/adminViewStore";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useMySchedule from "@/app/_hooks/useMySchedule";
import useOpenTable from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {currentLeagueHref} from "@/app/_lib/league";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import {BurzaHomeCard, HomeTile, NextNightCard, NextNightPlaceholder, nextNight} from "@/app/_ui/home/HomeCards";
import {StartCard} from "@/app/_ui/home/StartCard";
import HomeSponsors from "@/app/_ui/home/HomeSponsors";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {buttonBase, ErrorNote, IconCircleButton, InitialsAvatar, Screen, visuallyHidden} from "@/app/_ui/sp";
import useAuthStore from "@/app/_store/authStore";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import {Box} from "@mui/material";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useMyRating} from "@/app/_hooks/useRatings";

// under 400 px the header holds the brand (with its logo) next to an admin's Admin button only as an icon
const narrowPhone = "@media (max-width: 399.98px)";
// the wordmark inside Brand (its logo, then the name's column)
const BRAND_NAME = "& > div > div > div:last-of-type";

// Početna on the phone, the only Home (handoff §2; Claude Design "Burza v2" screen "home"): the top card, the Burza
// igrača card, the 2×2 tiles and the league's sponsors. Nothing is edited here. An admin sees it after "Prikaz igrača" on Večer lige
// (admin-mobile 04), with an Admin button next to Moj profil that switches back.
export default function PhoneHome() {
  const router = useTransitionRouter();
  // the profile button shows the player's photo, when there is one
  const me = useAuthStore((s) => s.user);
  const leagueId = useSelectedLeagueId();
  const {table: openTable, loading: openTableLoading} = useOpenTable();
  const {start, starting, error} = useStartGame();
  const {schedule, error: scheduleError} = useMySchedule();
  const next = nextNight(schedule);
  const {posts} = useBurza();
  const isAdmin = useIsAdmin();
  const setAdminView = useAdminViewStore((st) => st.setView);
  const {me: myRating} = useMyRating();

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

      {/* the table to play tonight; the rest of the week, the team's next night. While the open round loads, the
          neutral frame (named like the Start card, so the scoreboard still shrinks into it on the way back) */}
      {openTable ? (
        <StartCard table={openTable} starting={starting} onStart={start} errorId={error ? "start-error" : undefined} />
      ) : openTableLoading ? (
        <Box sx={{flex: "none", borderRadius: "24px", viewTransitionName: "table"}}>
          <NextNightPlaceholder />
        </Box>
      ) : next ? (
        <NextNightCard league={next.league} night={next.night} today={schedule!.today} />
      ) : schedule || scheduleError ? (
        <NoRoundCard />
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

      <InstallSheet />
    </Screen>
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

// No open round for the player: the game can't start until an admin creates the round
function NoRoundCard() {
  return (
    <Box
      aria-disabled="true"
      sx={{
        height: 200,
        flex: "none",
        boxSizing: "border-box",
        borderRadius: "24px",
        background: color.lineFill,
        border: `1.5px dashed ${tint.navy[22]}`,
        color: color.faint,
        p: "20px 20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "not-allowed",
      }}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}>Nema otvorene runde</Box>
          <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.muted, textWrap: "pretty"}}>Igra se otvara kad admin pokrene rundu.</Box>
        </Box>
        <Box
          component="span"
          aria-hidden
          sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: tint.navy[10], color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 28}}}
        >
          <LockRoundedIcon />
        </Box>
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1}}>
        Započni igru
      </Box>
    </Box>
  );
}
