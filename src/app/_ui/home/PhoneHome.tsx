"use client";

import useBurza from "@/app/_hooks/useBurza";
import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useAdminViewStore from "@/app/_store/adminViewStore";
import {useSelectedLeagueId} from "@/app/_hooks/useLeagues";
import useMySchedule from "@/app/_hooks/useMySchedule";
import useOpenTable, {OpenTable} from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {currentLeagueHref} from "@/app/_lib/league";
import {color, font, shadow, teamOnNavy, tint} from "@/app/_styles/tokens";
import {Brand} from "@/app/_ui/auth/AuthFrame";
import {BurzaHomeCard, HomeTile, NextNightCard, NextNightPlaceholder, nextNight} from "@/app/_ui/home/HomeCards";
import HomeSponsors from "@/app/_ui/home/HomeSponsors";
import InstallSheet from "@/app/_ui/install/InstallSheet";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import {buttonBase, ellipsis, ErrorNote, IconCircleButton, Screen, Spinner, TeamDot, visuallyHidden} from "@/app/_ui/sp";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {Box} from "@mui/material";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";

// under 400 px the header holds the brand (with its logo) next to an admin's Admin button only as an icon
const narrowPhone = "@media (max-width: 399.98px)";

// Početna on the phone, the only Home (handoff §2; Claude Design "Burza v2" screen "home"): the top card, the Burza
// igrača card, the 2×2 tiles and the league's sponsors. Nothing is edited here. An admin sees it after "Prikaz igrača" on Večer lige
// (admin-mobile 04), with an Admin button next to Moj profil that switches back.
export default function PhoneHome() {
  const router = useTransitionRouter();
  const leagueId = useSelectedLeagueId();
  const {table: openTable, loading: openTableLoading} = useOpenTable();
  const {start, starting, error} = useStartGame();
  const {schedule, error: scheduleError} = useMySchedule();
  const next = nextNight(schedule);
  const {posts} = useBurza();
  const isAdmin = useIsAdmin();
  const setAdminView = useAdminViewStore((st) => st.setView);

  return (
    <Screen gap={12}>
      {/* 4 px more under the header than between the cards, as designed */}
      <Box component="header" sx={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px", pb: "4px"}}>
        {/* minWidth 0: on a narrow phone the brand's logo gives way to the buttons */}
        <Box component="h1" sx={{m: 0, fontWeight: "inherit", minWidth: 0}}>
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
          <IconCircleButton label="Moj profil" onClick={() => router.push("/profile")}>
            <AccountCircleRoundedIcon />
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

// Započni igru: the player's table of the open round (table number, the smoking mark, both teams, and the score once
// a match is running, when it reads Nastavi igru)
function StartCard({table, starting, onStart, errorId}: {table: OpenTable; starting: boolean; onStart: () => void; errorId?: string}) {
  const live = table.score != null;
  return (
    <Box
      component="button"
      type="button"
      onClick={onStart}
      disabled={starting}
      aria-busy={starting || undefined}
      aria-describedby={errorId}
      sx={{
        ...buttonBase,
        position: "relative",
        minHeight: 200,
        flex: "none",
        borderRadius: "24px",
        background: color.navy,
        color: color.white,
        p: "20px 20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "stretch",
        gap: "14px",
        textAlign: "left",
        boxShadow: shadow.hero,
        // grows into the scoreboard on Započni igru (the board's root has the same name)
        viewTransitionName: "table",
        transition: "transform 120ms ease",
        "&:active:not(:disabled)": {transform: "scale(.98)"},
      }}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "8px", minWidth: 0}}>
          <Box sx={{display: "flex", alignItems: "center", gap: "8px"}}>
            <Box component="span" sx={{height: 28, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: color.cream, color: color.navy, fontSize: 13, fontWeight: 800, letterSpacing: ".08em"}}>
              STOL {table.table ?? "–"}
            </Box>
            {table.smoking && <SmokingMark variant="onNavy" />}
            {live && (
              <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.cream, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums"}}>
                {table.score![0]} : {table.score![1]}
              </Box>
            )}
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.2}}>
            {[table.myTeam, table.opponent].map((name, k) => (
              <TeamName key={k} name={name} side={k} conferences={table.conferences} />
            ))}
          </Box>
        </Box>
        <Box
          component="span"
          aria-hidden
          sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center"}}
        >
          {starting ? <Spinner size={22} /> : <PlayArrowRoundedIcon sx={{fontSize: 32}} />}
        </Box>
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, whiteSpace: "nowrap"}}>
        {live ? "Nastavi igru" : "Započni igru"}
      </Box>
    </Box>
  );
}

// side 0 is the player's own team. In a league with conferences the dot is the team's conference (with a white ring,
// as those colors are dark), otherwise the side's color.
function TeamName({name, side, conferences}: {name: string; side: number; conferences: OpenTable["conferences"]}) {
  const conference = conferences?.[side];
  return (
    <Box component="span" sx={{display: "flex", alignItems: "center", gap: "8px", minWidth: 0}}>
      {conferences ? (
        <TeamDot color={conference?.color ?? null} ring onNavy label={conference?.name} />
      ) : (
        <TeamDot color={teamOnNavy[side]} />
      )}
      <Box component="span" sx={ellipsis}>
        {name}
      </Box>
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
