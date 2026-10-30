"use client";

import {BurzaPost, MyLeague, MySchedule} from "@/app/_interfaces/burza";
import {gatheringLabel, isSafeUrl, nextNightIndex, NightLocation, nightLabel, nightTimeLabel} from "@/app/_lib/nights";
import {adCount, namesAndMore, teamsAsking, teamsLooking} from "@/app/_lib/ui/burza";
import {initials} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {mapLinkProps} from "@/app/_ui/gathering/Gathering";
import {buttonBase, ellipsis, InitialsAvatar} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {Box, Skeleton} from "@mui/material";
import React from "react";
import {LeagueArrival} from "./LeagueArrival";

// Početna's Burza igrača cards (Claude Design "Burza igrača · spojeno", Početna)

// The player's next league night: the soonest one of a league where their team is active, else of one where it is
// inactive (an admin can still switch an inactive team on for a night, so it keeps its league's nights)
export function nextNight(schedule: MySchedule | null): {league: MyLeague; night: string} | null {
  const leagues = schedule?.leagues ?? [];
  for (const league of [...leagues.filter((l) => l.active), ...leagues.filter((l) => !l.active)]) {
    const i = nextNightIndex(league.nights, schedule!.today);
    if (i >= 0) return {league, night: league.nights[i]};
  }
  return null;
}

// Where the night gathers, on the navy card: a pin, "19:30 · Caffe bar Kartaš", the address, and Karta when the place
// has a link (it opens Google Maps in a new tab or the Maps app)
export function GatheringRow({time, place}: {time: string | null | undefined; place: NightLocation}) {
  const map = place.url && isSafeUrl(place.url) ? place.url : null;
  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "10px", p: "10px 10px 10px 12px", borderRadius: "14px", background: tint.creamOnNavy[16]}}>
      <PlaceRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.cream}} />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere"}}>
          {gatheringLabel(time, place)}
        </Box>
        {place.address && (
          <Box component="span" sx={{fontSize: 13, lineHeight: 1.3, color: color.cream, overflowWrap: "anywhere"}}>
            {place.address}
          </Box>
        )}
      </Box>
      {map && (
        <Box
          component="a"
          {...mapLinkProps(map)}
          aria-label={`Karta: ${place.name}`}
          sx={{...buttonBase, flex: "none", height: 44, display: "flex", alignItems: "center", gap: "6px", px: "14px", borderRadius: "22px", background: color.white, color: color.navy, fontSize: 14, fontWeight: 700, textDecoration: "none", "& svg": {fontSize: 20}}}
        >
          <MapRoundedIcon aria-hidden />
          Karta
        </Box>
      )}
    </Box>
  );
}

// Sljedeća večer: the team, its players, where and when it gathers, and the night (opening Raspored); Nađi zamjenu
// opens the substitute form. Tonight it holds Potvrda dolaska (Tu smo) when the night has a start time;
// onArrivalChanged: a button there changed it (the schedule is asked again).
export function NextNightCard({league, night, today, onArrivalChanged}: {league: MyLeague; night: string; today: string; onArrivalChanged?: () => void}) {
  const tonight = night === today;
  const arrival = league.arrival?.night === night ? league.arrival : null;
  const time = league.times[night];
  const place = league.places?.[night];
  // "sri 14. 10. · 19:00", or only the date when the night has no start time; with a place, the time is in its row
  const when = place ? nightLabel(night) : nightTimeLabel(night, time);
  return (
    <Box
      component="section"
      aria-label={tonight ? "Večeras" : "Sljedeća večer"}
      sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.hero}}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
        <Box component="h2" sx={{m: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream, whiteSpace: "nowrap"}}>
          {tonight ? "Večeras" : "Sljedeća večer"}
        </Box>
        <Box
          component={TransitionLink}
          href={`/raspored?league=${league.league_id}`}
          aria-label={`Raspored, ${when}`}
          sx={{...buttonBase, height: 32, display: "flex", alignItems: "center", gap: "6px", px: "10px", borderRadius: "10px", background: color.cream, color: color.navy, fontSize: 13, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", "& svg": {fontSize: 18}}}
        >
          <EventRoundedIcon aria-hidden />
          {when}
        </Box>
      </Box>
      <Box sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1, overflowWrap: "anywhere"}}>{league.team_name}</Box>
      <Box component="ul" aria-label="Igrači" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "8px"}}>
        {league.players.map((p) => (
          <Box component="li" key={p.id} sx={{display: "flex", alignItems: "center", gap: "10px", fontSize: 15, minWidth: 0}}>
            <InitialsAvatar name={p.name} src={p.photo_url} size={32} sx={{fontSize: 11}} />
            <Box component="span" sx={ellipsis}>
              {p.name}
            </Box>
            {p.me && (
              <Box component="span" sx={{color: color.cream, flex: "none"}}>
                (ti)
              </Box>
            )}
          </Box>
        ))}
      </Box>
      {place && <GatheringRow time={time} place={place} />}
      {arrival && <LeagueArrival leagueId={league.league_id} teamId={league.team_id} initial={arrival} onChanged={onArrivalChanged} />}
      <Box
        component={TransitionLink}
        href={`/burza/novi/zamjena?from=home&league=${league.league_id}&night=${night}`}
        sx={{
          ...buttonBase,
          height: 52,
          borderRadius: "14px",
          background: tint.creamOnNavy[16],
          color: color.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          px: "14px",
          fontSize: 15,
          fontWeight: 600,
          textDecoration: "none",
          transition: "background 160ms ease",
          "&:hover": {background: tint.creamOnNavy[24]},
          "& svg": {fontSize: 22, color: color.cream},
        }}
      >
        <PersonSearchRoundedIcon aria-hidden />
        Nađi zamjenu
      </Box>
    </Box>
  );
}

// While the player's leagues load: the card's frame, so Početna doesn't jump
export function NextNightPlaceholder() {
  const bar = {bgcolor: tint.creamOnNavy[16]};
  return (
    <Box role="status" aria-label="Učitavanje" sx={{flex: "none", minHeight: 200, boxSizing: "border-box", borderRadius: "24px", background: color.navy, p: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.hero}}>
      <Skeleton variant="text" width={140} height={20} sx={bar} />
      <Skeleton variant="text" width={190} height={40} sx={bar} />
      <Skeleton variant="text" width={220} height={24} sx={bar} />
      <Skeleton variant="rounded" height={52} sx={{...bar, borderRadius: "14px", mt: "auto"}} />
    </Box>
  );
}

// Burza igrača: how many teams need a player (opening Burza on Zamjene), and how many ads there are in all
export function BurzaHomeCard({posts}: {posts: BurzaPost[] | null}) {
  // other teams' requests, one per team
  const teams = teamsAsking(posts ?? []).map((t) => t.name);
  const asking = teams.length > 0;
  const shown = teams.slice(0, 2);
  const more = teams.length - shown.length;
  return (
    <Box
      component={TransitionLink}
      href="/burza?tab=zamjene"
      sx={{
        ...buttonBase,
        flex: "none",
        width: "100%",
        boxSizing: "border-box",
        borderRadius: "22px",
        background: color.white,
        color: color.ink,
        p: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        textAlign: "left",
        textDecoration: "none",
        boxShadow: shadow.card,
        transition: "transform 120ms ease",
        "&:active": {transform: "scale(.98)"},
      }}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy, whiteSpace: "nowrap", "& svg": {fontSize: 20}}}>
          <GroupsRoundedIcon aria-hidden />
          Burza igrača
        </Box>
        {posts && (
          <Box component="span" sx={{fontSize: 13, fontWeight: 600, color: color.navy}}>
            {adCount(posts.length)}
          </Box>
        )}
      </Box>
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        {asking && (
          <Box aria-hidden sx={{display: "flex", flex: "none"}}>
            {shown.map((name, i) => (
              <Bubble key={name} bg={i === 0 ? color.cream : color.hairline} ring={i > 0}>
                {initials(name)}
              </Bubble>
            ))}
            {more > 0 && (
              <Bubble bg={color.paper} ring>
                +{more}
              </Bubble>
            )}
          </Box>
        )}
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 19, fontWeight: 800, lineHeight: 1.15, color: color.ink}}>
            {posts == null ? <Skeleton width={180} /> : asking ? teamsLooking(teams.length) : "Nitko ne traži zamjenu"}
          </Box>
          {/* who is asking; with nobody asking there is nothing to list (the card opens the empty Zamjene tab) */}
          {(posts == null || asking) && (
            <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
              {posts == null ? <Skeleton width={140} /> : namesAndMore(teams)}
            </Box>
          )}
        </Box>
        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26, color: color.navy}} />
      </Box>
      <Box component="span" sx={{fontSize: 15, lineHeight: 1.4, color: color.ink}}>
        {asking || posts == null ? "Možeš li uskočiti ili znaš nekoga tko može?" : "Objavi oglas kad tebi zatreba igrač ili partner."}
      </Box>
    </Box>
  );
}

function Bubble({bg, ring, children}: {bg: string; ring: boolean; children: React.ReactNode}) {
  return (
    <Box component="span" sx={{ml: ring ? "-9px" : 0, display: "flex", borderRadius: "50%", boxShadow: ring ? `0 0 0 2.5px ${color.white}` : "none"}}>
      <Box component="span" sx={{width: 34, height: 34, flex: "none", borderRadius: "50%", background: bg, color: color.navy, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}>
        {children}
      </Box>
    </Box>
  );
}

// One of the 2×2 tiles under the cards (Raspored, Dnevni poredak, Ukupni poredak, Rejting)
export function HomeTile({href, icon, label}: {href: string; icon: React.ReactNode; label: string}) {
  return (
    <Box
      component={TransitionLink}
      href={href}
      sx={{
        ...buttonBase,
        height: 64,
        boxSizing: "border-box",
        borderRadius: "18px",
        background: color.white,
        color: color.ink,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        px: "14px",
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1.2,
        textAlign: "left",
        textDecoration: "none",
        boxShadow: shadow.card,
        transition: "transform 120ms ease",
        "&:active": {transform: "scale(.98)"},
        "& > svg": {fontSize: 24, color: color.navy, flex: "none"},
      }}
    >
      {icon}
      {label}
    </Box>
  );
}
