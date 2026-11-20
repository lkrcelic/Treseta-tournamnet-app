"use client";

import {BurzaPost, MyLeague, MySchedule} from "@/app/_interfaces/burza";
import {gatheringLabel, isSafeUrl, nextNightIndex, NightLocation, nightLabel, nightTimeLabel} from "@/app/_lib/nights";
import {adCount, namesAndMore, teamsAsking, teamsLooking} from "@/app/_lib/ui/burza";
import {asksAdmin, leagueArrivalPhase} from "@/app/_lib/leagueArrival";
import {initials} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {mapLinkProps} from "@/app/_ui/gathering/Gathering";
import {buttonBase, ellipsis, InitialsAvatar} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import {Box, Skeleton} from "@mui/material";
import React from "react";
import {LeagueArrival, useNow} from "./LeagueArrival";

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
// gathering: Okupljanje, "HH:MM", said under the time and place with the address. stacked: the address on its own line
// (Početna · Liga). label: over the row, "Vaša lokacija" on a two-place night. orPlace: a two-place night whose team
// Podjela hasn't placed yet: "19:30 · Kartaš ili Lanterna" and "Još niste raspoređeni.", without a map.
export function GatheringRow({
  time,
  gathering,
  place,
  stacked = false,
  label,
  orPlace = null,
}: {
  time: string | null | undefined;
  gathering?: string | null;
  place: NightLocation;
  stacked?: boolean;
  label?: string;
  orPlace?: NightLocation | null;
}) {
  const okupljanje = gathering ? `Okupljanje od ${gathering}` : null;
  const lines = orPlace
    ? [okupljanje, "Još niste raspoređeni."]
    : stacked
      ? [okupljanje, place.address]
      : [[okupljanje, place.address].filter(Boolean).join(" · ")];
  const title = orPlace ? `${gatheringLabel(time, place)} ili ${orPlace.name}` : gatheringLabel(time, place);
  const map = !orPlace && place.url && isSafeUrl(place.url) ? place.url : null;
  const row = (
    <Box sx={{display: "flex", alignItems: "center", gap: "10px", p: "10px 10px 10px 12px", borderRadius: "14px", background: tint.creamOnNavy[16]}}>
      <PlaceRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.cream}} />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere"}}>
          {title}
        </Box>
        {lines.filter(Boolean).map((line) => (
          <Box key={line} component="span" sx={{fontSize: 13, lineHeight: 1.3, color: color.cream, overflowWrap: "anywhere"}}>
            {line}
          </Box>
        ))}
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
  if (!label) return row;
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
      <Box component="span" sx={{fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream}}>
        {label}
      </Box>
      {row}
    </Box>
  );
}

// Sljedeća večer: the team, its players, where and when it gathers, and the night (opening Raspored); Nađi zamjenu
// opens the substitute form until Tu smo opens (then the night is under way and the button goes). Tonight it holds
// Potvrda dolaska (Tu smo) when the night has a start time; onArrivalChanged: a button there changed it (the schedule is asked again).
// On a two-place night (Claude Design 01 A) the row is the team's own place under "Vaša lokacija", or both places and
// "Još niste raspoređeni." before Podjela; tonight a team without a place sees Javi se adminu instead of the row.
// end: Kraj večeri (card 16), the place's last Kolo is played: its box in place of the place, Tu smo and Nađi zamjenu.
export function NextNightCard({
  league,
  night,
  today,
  onArrivalChanged,
  end = null,
}: {
  league: MyLeague;
  night: string;
  today: string;
  onArrivalChanged?: () => void;
  end?: {kola: number; next: string | null} | null;
}) {
  const tonight = night === today;
  const arrival = end ? null : league.arrival?.night === night ? league.arrival : null;
  const now = useNow();
  const findSub = !end && (!arrival || leagueArrivalPhase(arrival, now) === "before");
  const time = league.times[night];
  const gathering = league.gatherings?.[night];
  const first = league.places?.[night];
  const second = league.secondPlaces?.[night];
  const slot = league.slots?.[night];
  const twoPlaces = first != null && second != null;
  // the team's place (on a two-place night only once Podjela put it there)
  const place = twoPlaces ? (slot ? (slot === 1 ? first : second) : null) : first;
  const unplaced = twoPlaces && !slot && !(arrival && asksAdmin(arrival.two_places, arrival.slot));
  const row = end ? null : place ? (
    <GatheringRow time={time} gathering={gathering} place={place} stacked label={twoPlaces ? "Vaša lokacija" : undefined} />
  ) : unplaced ? (
    <GatheringRow time={time} gathering={gathering} place={first!} orPlace={second} stacked />
  ) : null;
  // "sri 14. 10. · 19:00", or only the date when the night has no start time; with a place, the time is in its row
  const when = row ? nightLabel(night) : nightTimeLabel(night, time);
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
            {/* the name and, under it, the handle: the username is public (#88) */}
            <Box sx={{minWidth: 0, display: "flex", flexDirection: "column"}}>
              <Box component="span" sx={ellipsis}>
                {p.name}
              </Box>
              <Box component="span" sx={{fontSize: 12.5, color: tint.creamOnNavy[55], ...ellipsis}}>
                @{p.username}
              </Box>
            </Box>
            {p.me && (
              <Box component="span" sx={{color: color.cream, flex: "none"}}>
                (ti)
              </Box>
            )}
          </Box>
        ))}
      </Box>
      {row}
      {arrival && <LeagueArrival leagueId={league.league_id} teamId={league.team_id} initial={arrival} onChanged={onArrivalChanged} />}
      {end && <EndOfNight leagueId={league.league_id} night={night} kola={end.kola} next={end.next} />}
      {findSub && (
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
      )}
    </Box>
  );
}

// Kraj večeri (card 16): every Kolo of the team's place is played; the next night, and the night's Dnevni poredak
function EndOfNight({leagueId, night, kola, next}: {leagueId: number; night: string; kola: number; next: string | null}) {
  return (
    <Box component="section" aria-label="Kraj večeri" sx={{display: "flex", flexDirection: "column", gap: "10px", p: "14px", borderRadius: "18px", background: tint.creamOnNavy[16]}}>
      <Box component="h3" sx={{m: 0, display: "flex", alignItems: "center", gap: "6px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.cream, "& svg": {fontSize: 18}}}>
        <CheckCircleRoundedIcon aria-hidden />
        Kraj večeri
      </Box>
      <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>
        {kola === 1 ? "Odigrano je jedino kolo večeras." : kola < 5 ? `Odigrana su sva ${kola} kola večeras.` : `Odigrano je svih ${kola} kola večeras.`} Hvala na igri!
        {next && (
          <>
            <br />
            {/* the date ends in its own full stop ("čet 26. 11.") */}
            Sljedeća večer je {nightLabel(next)}
          </>
        )}
      </Box>
      <Box
        component={TransitionLink}
        href={`/league/${leagueId}/daily-standings?date=${night}`}
        sx={{...buttonBase, height: 50, borderRadius: "16px", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 16, fontWeight: 700, textDecoration: "none", "& svg": {fontSize: 22}}}
      >
        <EmojiEventsRoundedIcon aria-hidden />
        Dnevni poredak
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
