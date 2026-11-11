"use client";

import {MyMatch, MyResult, TournamentCard, TournamentDetail, TournamentEntryView, TournamentPrizeView, TournamentWinner} from "@/app/_interfaces/tournament";
import useAuthStore from "@/app/_store/authStore";
import {isSafeUrl, nightLabel} from "@/app/_lib/nights";
import {daysUntilLabel, feeLabel, formatLabel, prizeSummary, rulesLabel} from "@/app/_lib/tournaments";
import {teamInitial} from "@/app/_lib/ui/profiles";
import {formatChange} from "@/app/_lib/ui/ratings";
import {count, NOUN, plural} from "@/app/_lib/ui/text";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {GatheringRow} from "@/app/_ui/home/HomeCards";
import {mapLinkProps} from "@/app/_ui/gathering/Gathering";
import {buttonBase, Card, ellipsis, InitialsAvatar, LiveDot, mergeSx} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SentimentSatisfiedRoundedIcon from "@mui/icons-material/SentimentSatisfiedRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useState} from "react";
import {DateTile} from "./TournamentParts";
import {ArrivalAction, BannedSignUp, HomeArrival} from "./DayParts";

// The player's tournament screens (Claude Design "Natjecanja"): the cards of Početna · Turniri and of a tournament's
// page, in the league's look (the navy card of Sljedeća večer, white cards with icon rows, the standings' rows).

const eyebrowSx = {fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase"} as const;

export const tournamentHref = (id: number) => `/turniri/${id}`;

// "10:00 · Hotel Panorama" (or what there is of it)
export const whenWhere = (t: Pick<TournamentCard, "start_time" | "location">) => [t.start_time, t.location.name].filter(Boolean).join(" · ");

// The page's head: the date tile, the name and how far off it is (or that it is over)
export function TournamentHead({t, today}: {t: TournamentCard; today: string}) {
  const over = t.phase === "finished" || t.phase === "cancelled";
  const sub =
    t.phase === "cancelled"
      ? "Turnir je otkazan"
      : t.phase === "finished"
        ? `Završeno ${nightLabel(t.date)} · ${count(t.teams, NOUN.ekipa)}`
        : t.phase === "active"
          ? `Danas · ${count(t.teams, NOUN.ekipa)}`
          : daysUntilLabel(t.date, today);
  return (
    <Box component="header" sx={{display: "flex", alignItems: "center", gap: "14px", px: "2px"}}>
      {!over && <DateTile date={t.date} size={56} />}
      <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.01em", overflowWrap: "anywhere"}}>
          {t.name}
        </Box>
        {sub && (
          <Box component="span" sx={{fontSize: 14, color: t.phase === "cancelled" ? color.red : color.ink2, fontWeight: t.phase === "cancelled" ? 700 : 500}}>
            {sub}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// The bubbles of a few players and "12 ekipa" (on navy or on a light band): the teams signed up, not their players,
// since a team can have more than two players
// max: at most that many photos (a card row that shares the line with a button)
export function TeamsCount({t, onNavy = false, max}: {t: Pick<TournamentCard, "avatars" | "teams">; onNavy?: boolean; max?: number}) {
  const avatars = max == null ? t.avatars : t.avatars.slice(0, max);
  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "10px", minWidth: 0}}>
      {avatars.length > 0 && (
        <Box aria-hidden sx={{display: "flex", flex: "none"}}>
          {avatars.map((a, i) => (
            <Box key={i} component="span" sx={{ml: i ? "-9px" : 0, display: "flex", borderRadius: "50%", boxShadow: `0 0 0 2.5px ${onNavy ? color.navy : color.paper2}`}}>
              <InitialsAvatar name={a.name} src={a.photo_url} size={30} sx={{fontSize: 11}} />
            </Box>
          ))}
        </Box>
      )}
      <Box component="span" sx={{fontSize: 15, color: onNavy ? color.white : color.ink, whiteSpace: "nowrap"}}>
        <Box component="span" sx={{fontFamily: font.display, fontSize: onNavy ? 26 : 17, fontWeight: 800}}>
          {t.teams}
        </Box>{" "}
        {plural(t.teams, ...NOUN.ekipa)}
      </Box>
    </Box>
  );
}

// the viewer first among a team's players, as the sign-up sheet lists them
function meFirst<P extends {id: number}>(players: P[], meId: number | null): P[] {
  return meId == null ? players : [...players].sort((a, b) => Number(b.id === meId) - Number(a.id === meId));
}

// The team and its players on the navy card (the viewer first, marked "(ti)")
function TeamOnNavy({name, players, meId}: {name: string; players: {id: number; name: string; photo_url: string | null}[]; meId: number | null}) {
  return (
    <>
      <Box sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1, overflowWrap: "anywhere"}}>{name}</Box>
      <Box component="ul" aria-label="Igrači" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "8px"}}>
        {meFirst(players, meId).map((p) => (
          <Box component="li" key={p.id} sx={{display: "flex", alignItems: "center", gap: "10px", fontSize: 15, minWidth: 0}}>
            <InitialsAvatar name={p.name} src={p.photo_url} size={32} sx={{fontSize: 11}} />
            <Box component="span" sx={ellipsis}>
              {p.name}
            </Box>
            {p.id === meId && (
              <Box component="span" sx={{color: color.cream, flex: "none"}}>
                (ti)
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </>
  );
}

// The navy card of a tournament before it starts (R1–R4), and of one with Otvorene prijave while it is played
// (DECISIONS #88): signed up (the team, its players, where and when), on the waiting list, open for sign-ups
// (Prijavi se), or closed
export function SignUpCard({t, meId, onSignUp, signedIn}: {t: TournamentDetail; meId: number | null; onSignUp: () => void; signedIn: boolean}) {
  const router = useTransitionRouter();
  const card = {flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.hero} as const;
  const place = t.location.name ? {name: t.location.name, address: t.location.address, url: t.location.url} : null;
  if (t.me) {
    const waiting = t.me.status === "WAITING";
    return (
      <Box component="section" aria-label={waiting ? "Na listi čekanja" : "Prijavljen si"} sx={card}>
        <Box component="h2" sx={{m: 0, ...eyebrowSx, color: color.cream, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
          {waiting ? <HourglassTopRoundedIcon aria-hidden /> : <CheckCircleRoundedIcon aria-hidden />}
          {waiting ? `Na listi čekanja · ${t.me.position}.` : "Prijavljen si"}
        </Box>
        <TeamOnNavy name={t.me.team_name} players={t.me.players} meId={meId} />
        {waiting ? (
          <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>Ulaziš sam kad se neka ekipa odjavi, bez obavijesti. Provjeri ovdje prije turnira.</Box>
        ) : (
          place && <GatheringRow time={t.start_time} place={place} />
        )}
      </Box>
    );
  }
  const full = t.max_teams != null && t.teams >= t.max_teams;
  const open = t.signups_open_now;
  return (
    <Box component="section" aria-label={open ? "Prijave otvorene" : "Prijave zatvorene"} sx={card}>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
        <Box component="h2" sx={{m: 0, ...eyebrowSx, color: color.cream}}>
          {open ? "Prijave otvorene" : "Prijave zatvorene"}
        </Box>
        {open ? (
          <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 13, fontWeight: 600, color: color.white}}>
            <Box component="span" aria-hidden sx={{width: 8, height: 8, borderRadius: "50%", background: tint.green[35], boxShadow: `0 0 0 2px ${color.green}`}} />
            {full ? "lista čekanja" : "otvoreno"}
          </Box>
        ) : (
          <LockRoundedIcon aria-hidden sx={{fontSize: 20, color: color.cream}} />
        )}
      </Box>
      <TeamsCount t={t} onNavy />
      {open && signedIn && t.my_ban ? (
        <BannedSignUp until={t.my_ban.until} />
      ) : open ? (
        <>
          {full && <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>Turnir je pun: nova prijava ide na listu čekanja.</Box>}
          {/* a visitor without an account signs in first; the tournament's page is public, the sign-up isn't */}
          <Box
            component="button"
            type="button"
            onClick={signedIn ? onSignUp : () => router.push("/login")}
            sx={{...buttonBase, height: 56, borderRadius: "16px", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 17, fontWeight: 700, textDecoration: "none", "& svg": {fontSize: 22}}}
          >
            <HowToRegRoundedIcon aria-hidden />
            {full ? "Prijavi se na listu čekanja" : "Prijavi se"}
          </Box>
        </>
      ) : (
        <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>Prijave su zatvorene. Turnir možeš pratiti ovdje: poredak i rezultati bit će vidljivi od prvog kola.</Box>
      )}
    </Box>
  );
}

function InfoRow({icon, title, sub, action, last}: {icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; last?: boolean}) {
  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "12px", py: "12px", borderBottom: last ? "none" : `1px solid ${color.line}`}}>
      <Box aria-hidden sx={{flex: "none", width: 40, height: 40, borderRadius: "12px", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
        {icon}
      </Box>
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere"}}>
          {title}
        </Box>
        {sub && (
          <Box component="span" sx={{fontSize: 13, lineHeight: 1.35, color: color.muted, overflowWrap: "anywhere"}}>
            {sub}
          </Box>
        )}
      </Box>
      {action}
    </Box>
  );
}

const circleLink = {...buttonBase, flex: "none", width: 44, height: 44, borderRadius: "50%", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", "& svg": {fontSize: 22}} as const;

// The details card (R1–R4): when and the gathering, the place (unless the navy card shows it), the format, the fee and
// the rules
export function InfoCard({t, hidePlace = false}: {t: TournamentDetail; hidePlace?: boolean}) {
  const fee = feeLabel(t.entry_fee);
  const map = t.location.url && isSafeUrl(t.location.url) ? t.location.url : null;
  const rules = t.rules_url && isSafeUrl(t.rules_url) ? t.rules_url : null;
  return (
    <Card component="section" aria-label="O turniru" sx={{flex: "none", p: "4px 16px", borderRadius: "22px"}}>
      <InfoRow icon={<ScheduleRoundedIcon />} title={[nightLabel(t.date), t.start_time].filter(Boolean).join(" · ")} sub={t.gathering_time ? `Okupljanje od ${t.gathering_time}` : undefined} />
      {!hidePlace && t.location.name && (
        <InfoRow
          icon={<PlaceRoundedIcon />}
          title={t.location.name}
          sub={t.location.address ?? undefined}
          action={
            map && (
              <Box component="a" {...mapLinkProps(map)} aria-label={`Karta: ${t.location.name}`} sx={circleLink}>
                <MapRoundedIcon />
              </Box>
            )
          }
        />
      )}
      <InfoRow icon={<GridViewRoundedIcon />} title={formatLabel(t.rounds, t.matches_per_round)} sub="Igra se u parovima · jedan poredak" />
      <InfoRow icon={fee.free ? <SentimentSatisfiedRoundedIcon /> : <PaymentsRoundedIcon />} title={fee.title} sub={fee.sub} />
      <InfoRow
        icon={<MenuBookRoundedIcon />}
        title="Pravila igre"
        sub={rulesLabel(t.declarations, t.score_threshold, t.match_end)}
        last
        action={
          rules && (
            <Box component="a" href={rules} target="_blank" rel="noopener noreferrer" aria-label="Pravila igre (otvara se u novom prozoru)" sx={circleLink}>
              <OpenInNewRoundedIcon />
            </Box>
          )
        }
      />
    </Card>
  );
}

// Nagrade: a row that opens the places (closed: the summary)
export function PrizesCard({prizes, startsOpen = false}: {prizes: TournamentPrizeView[]; startsOpen?: boolean}) {
  const [open, setOpen] = useState(startsOpen);
  const summary = prizeSummary(prizes);
  if (!summary) return null;
  return (
    <Card component="section" aria-label="Nagrade" sx={{flex: "none", p: "4px 16px", borderRadius: "22px"}}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{...buttonBase, width: "100%", display: "flex", alignItems: "center", gap: "12px", py: "12px", textAlign: "left"}}
      >
        <Box aria-hidden sx={{flex: "none", width: 40, height: 40, borderRadius: "12px", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
          <EmojiEventsRoundedIcon />
        </Box>
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
          <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
            Nagrade
          </Box>
          <Box component="span" sx={{fontSize: 13, color: color.muted}}>
            {summary}
          </Box>
        </Box>
        <ExpandMoreRoundedIcon aria-hidden sx={{fontSize: 26, color: color.navy, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease"}} />
      </Box>
      {open && (
        <Box component="ol" sx={{listStyle: "none", m: 0, p: "0 0 12px", display: "flex", flexDirection: "column", gap: "6px"}}>
          {prizes.map((p, i) => (
            <Box component="li" key={p.place} sx={{display: "flex", alignItems: "center", gap: "12px", p: "8px 10px", borderRadius: "14px", background: i < 3 ? color.medalBg[i] : color.paper2}}>
              <Box component="span" sx={{flex: "none", width: 28, fontFamily: font.display, fontSize: 18, fontWeight: 800, color: i < 3 ? color.medal[i] : color.muted, textAlign: "center"}}>
                {p.place}
              </Box>
              <Box sx={{minWidth: 0, display: "flex", flexDirection: "column"}}>
                <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
                  {p.prize}
                </Box>
                {p.description && (
                  <Box component="span" sx={{fontSize: 13, color: color.ink2}}>
                    {p.description}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}

// One team of the tournament (Prijavljene ekipe): its letter, its players and their average rating
export function EntryLine({e, meId, last = false}: {e: TournamentEntryView; meId: number | null; last?: boolean}) {
  return (
    <Box
      component="li"
      aria-current={e.mine ? "true" : undefined}
      sx={{minHeight: 64, display: "flex", alignItems: "center", gap: "12px", px: "14px", borderBottom: last ? "none" : `1px solid ${color.line}`, background: e.mine ? color.cream2 : "transparent"}}
    >
      <InitialsAvatar name={e.team_name} letters={teamInitial(e.team_name)} src={e.photo_url} size={40} variant={e.mine ? "navy" : "paper"} />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700, ...ellipsis}}>
          {e.team_name}
        </Box>
        <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
          {meFirst(e.players, meId).map((p) => (p.id === meId ? `${p.name} (ti)` : p.name)).join(" · ")}
        </Box>
      </Box>
      {e.rating != null && (
        <Box component="span" aria-label={`Rejting ${e.rating}`} sx={{flex: "none", display: "flex", alignItems: "center", gap: "4px", fontSize: 14, fontWeight: 700, color: color.navy, "& svg": {fontSize: 17}}}>
          <LeaderboardRoundedIcon aria-hidden />
          {e.rating}
        </Box>
      )}
    </Box>
  );
}

// Prijavljene ekipe · 22 with the first ones and Svi ›
export function EntriesPreview({t, meId, limit = 5}: {t: TournamentDetail; meId: number | null; limit?: number}) {
  if (t.entries.length === 0) return null;
  return (
    <Box component="section" aria-label="Prijavljene ekipe" sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", px: "4px"}}>
        <Box component="h2" sx={{m: 0, ...eyebrowSx, color: color.muted}}>
          Prijavljene ekipe · {t.entries.length}
        </Box>
        {t.entries.length > limit && (
          <Box component={TransitionLink} href={`${tournamentHref(t.id)}/ekipe`} sx={{fontSize: 14, fontWeight: 700, color: color.navy, textDecoration: "none", py: "6px"}}>
            Svi ›
          </Box>
        )}
      </Box>
      <Card component="ul" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden", borderRadius: "22px"}}>
        {t.entries.slice(0, limit).map((e, i, all) => (
          <EntryLine key={e.team_id} e={e} meId={meId} last={i === all.length - 1} />
        ))}
      </Card>
    </Box>
  );
}

// Poredak i rezultati ›: the standings and every Kolo (with the live dot while one is played)
export function ResultsButton({t, sx}: {t: Pick<TournamentCard, "id" | "phase" | "live_kolo">; sx?: SxProps<Theme>}) {
  const live = t.phase === "active" && t.live_kolo != null;
  return (
    <Box
      component={TransitionLink}
      href={`${tournamentHref(t.id)}/poredak`}
      sx={mergeSx(
        {...buttonBase, flex: "none", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", px: "16px", py: "10px", borderRadius: "20px", background: color.white, color: color.ink, textDecoration: "none", boxShadow: shadow.card, "&:active": {transform: "scale(.98)"}},
        sx
      )}
    >
      <EmojiEventsRoundedIcon aria-hidden sx={{fontSize: 24, color: color.navy}} />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
          Poredak i rezultati
        </Box>
        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 13, color: live ? color.red : color.muted, fontWeight: live ? 600 : 500}}>
          {live && <LiveDot size={7} />}
          {live ? `Kolo ${t.live_kolo} uživo` : t.phase === "finished" ? "Konačni poredak i sva kola" : "Poredak i sva kola"}
        </Box>
      </Box>
      <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26, color: color.navy}} />
    </Box>
  );
}

function StatTiles({wins, draws, losses}: {wins: number; draws: number; losses: number}) {
  return (
    <Box sx={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "8px"}}>
      {(
        [
          [wins, "POB"],
          [draws, "NER"],
          [losses, "IZG"],
        ] as const
      ).map(([n, label]) => (
        <Box key={label} sx={{p: "10px 8px", borderRadius: "14px", background: tint.creamOnNavy[16], display: "flex", flexDirection: "column", alignItems: "center", gap: "2px"}}>
          <Box component="span" sx={{fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1}}>
            {n}
          </Box>
          <Box component="span" sx={{fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: color.cream}}>
            {label}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// Pobjednici (W1, G0): the winning team, who played for it and its record
export function WinnersCard({winner}: {winner: TournamentWinner}) {
  return (
    <Box component="section" aria-label="Pobjednici" sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.hero}}>
      <Box component="h2" sx={{m: 0, ...eyebrowSx, color: color.cream, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 18}}}>
        <EmojiEventsRoundedIcon aria-hidden />
        Pobjednici
      </Box>
      <Box sx={{display: "flex", alignItems: "center", gap: "14px", minWidth: 0}}>
        <InitialsAvatar name={winner.team_name} letters={teamInitial(winner.team_name)} src={winner.photo_url} size={60} sx={{fontSize: 22, boxShadow: `0 0 0 3px ${color.cream}`}} />
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1, overflowWrap: "anywhere"}}>{winner.team_name}</Box>
          <Box component="span" sx={{fontSize: 14, color: color.cream}}>
            {winner.players.join(" · ")}
          </Box>
        </Box>
      </Box>
      <StatTiles wins={winner.wins} draws={winner.draws} losses={winner.losses} />
    </Box>
  );
}

// Vaš rezultat (W1): the place, who played, the record and the rating over the day
export function MyResultCard({r}: {r: MyResult}) {
  return (
    <Box component="section" aria-label="Vaš rezultat" sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "14px", boxShadow: shadow.hero}}>
      <Box component="h2" sx={{m: 0, ...eyebrowSx, color: color.cream}}>
        Vaš rezultat
      </Box>
      <Box sx={{display: "flex", alignItems: "center", gap: "14px", minWidth: 0}}>
        <Box aria-label={`${r.place}. mjesto od ${r.of}`} sx={{flex: "none", width: 64, height: 64, borderRadius: "18px", background: color.cream, color: color.navy, fontFamily: font.display, fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center"}}>
          #{r.place}
        </Box>
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1, overflowWrap: "anywhere"}}>{r.team_name}</Box>
          <Box component="span" sx={{fontSize: 14, color: color.cream}}>
            {r.players.join(" · ")}
          </Box>
        </Box>
      </Box>
      <StatTiles wins={r.wins} draws={r.draws} losses={r.losses} />
      {r.rating && (
        <Box sx={{display: "flex", alignItems: "center", gap: "10px", p: "10px 12px", borderRadius: "14px", background: tint.creamOnNavy[16], fontSize: 15, "& svg": {fontSize: 20, color: color.cream}}}>
          <LeaderboardRoundedIcon aria-hidden />
          <Box component="span" sx={{flex: 1}}>
            Tvoj rejting
          </Box>
          <Box component="span" sx={{fontWeight: 700, fontVariantNumeric: "tabular-nums"}}>
            {r.rating.before} → {r.rating.after}
          </Box>
          <Box component="span" sx={{fontWeight: 800, color: color.cream, fontVariantNumeric: "tabular-nums"}}>
            {formatChange(r.rating.change)}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Vaši mečevi: Kolo · the opponent · the matches won, each opening its table
export function MyMatchesCard({matches, tournamentId}: {matches: MyMatch[]; tournamentId: number}) {
  if (matches.length === 0) return null;
  return (
    <Card component="section" aria-label="Vaši mečevi" sx={{flex: "none", p: "4px 0", borderRadius: "22px", overflow: "hidden"}}>
      <Box component="h2" sx={{m: 0, p: "12px 16px 6px", ...eyebrowSx, color: color.muted}}>
        Vaši mečevi
      </Box>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0}}>
        {matches.map((m, i) => {
          const row = (
            <>
              <Box component="span" sx={{flex: "none", width: 60, fontSize: 13, fontWeight: 600, color: color.muted}}>
                Kolo {m.kolo}
              </Box>
              <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: m.bye ? color.muted : color.ink, ...ellipsis}}>
                {m.opponent}
              </Box>
              <Box component="span" sx={{flex: "none", fontFamily: font.display, fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums"}}>
                {m.done || m.bye ? `${m.wins[0]} : ${m.wins[1]}` : "–"}
              </Box>
            </>
          );
          const sx = {minHeight: 52, display: "flex", alignItems: "center", gap: "10px", px: "16px", borderTop: i ? `1px solid ${color.line}` : "none", color: color.ink, textDecoration: "none"} as const;
          return (
            <Box component="li" key={m.round_id}>
              {m.bye ? (
                <Box sx={sx}>{row}</Box>
              ) : (
                <Box component={TransitionLink} href={`/turniri/${tournamentId}/stol/${m.round_id}`} sx={{...sx, "&:active": {background: color.paper2}}}>
                  {row}
                  <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.navy}} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

// ---------- Početna · Turniri ----------

// The navy card of the next tournament (S2, S3; "Potvrda dolaska" C1–C3): the whole card opens the tournament's page
// (› in its head). Signed up: the team, where and when, and Potvrda dolaska with Tu smo on the day; waiting; or how many
// have signed up and Stranica turnira across the card, for a guest too (its sign-up is on the page).
export function NextTournamentCard({t, arrival}: {t: TournamentCard; arrival?: {busy: ArrivalAction | null; onAction: (a: ArrivalAction) => void}}) {
  const router = useTransitionRouter();
  const place = t.location.name ? {name: t.location.name, address: t.location.address, url: t.location.url} : null;
  const open = () => router.push(tournamentHref(t.id));
  const signedUp = (
    <Box sx={{display: "flex", alignItems: "center", gap: "8px", fontSize: 15}}>
      <Box component="span" sx={{color: color.cream}}>
        Prijavljeno
      </Box>
      <Box component="strong" sx={{fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
        {count(t.teams, NOUN.ekipa)}
      </Box>
    </Box>
  );
  return (
    <Box
      component="section"
      role="link"
      tabIndex={0}
      aria-label={`Sljedeći turnir: ${t.name}`}
      onClick={open}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") open();
      }}
      sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: shadow.hero, cursor: "pointer", outlineOffset: "3px"}}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
        <Box component="h2" sx={{m: 0, ...eyebrowSx, color: color.cream, whiteSpace: "nowrap"}}>
          Sljedeći turnir
        </Box>
        <Box sx={{display: "flex", alignItems: "center", gap: "4px"}}>
          <Box component="span" sx={{height: 32, display: "flex", alignItems: "center", gap: "6px", px: "10px", borderRadius: "10px", background: color.cream, color: color.navy, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", "& svg": {fontSize: 18}}}>
            <EventRoundedIcon aria-hidden />
            {nightLabel(t.date)}
          </Box>
          <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26, color: color.cream}} />
        </Box>
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
        <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.cream}}>
          {formatLabel(t.rounds, t.matches_per_round)}
          {t.declarations ? "" : " · bez zvanja"}
          {t.score_threshold > 41 ? ` · do ${t.score_threshold}` : ""}
          {t.match_end === "NA_PROLAZ" ? " · na prolaz" : ""}
        </Box>
        <Box sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1.02, overflowWrap: "anywhere"}}>{t.name}</Box>
      </Box>
      {t.me ? (
        <>
          <Box sx={{display: "flex", alignItems: "center", gap: "8px", fontSize: 15, "& svg": {fontSize: 20, color: color.cream}}}>
            {t.me.status === "WAITING" ? <HourglassTopRoundedIcon aria-hidden /> : <CheckCircleRoundedIcon aria-hidden />}
            <span>
              {t.me.status === "WAITING" ? `Na listi čekanja · ${t.me.position}.` : "Prijavljeni"} ·{" "}
              <Box component="strong" sx={{fontWeight: 700}}>
                {t.me.team_name}
              </Box>
            </span>
          </Box>
          {place && t.me.status === "REGISTERED" && (
            <Box onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <GatheringRow time={t.start_time} place={place} />
            </Box>
          )}
          {arrival && <HomeArrival t={t} busy={arrival.busy} onAction={arrival.onAction} />}
        </>
      ) : (
        // under the count, Stranica turnira across the card, as SignUpCard's Prijavi se
        <>
          {signedUp}
          <Box
            component="span"
            sx={{height: 56, borderRadius: "16px", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: 17, fontWeight: 700, "& svg": {fontSize: 22}}}
          >
            Stranica turnira
            <ChevronRightRoundedIcon aria-hidden />
          </Box>
        </>
      )}
    </Box>
  );
}

// On the day, between the player's tables (S4 without a table to play): the tournament, the team and what comes next
export function TodayCard({t}: {t: TournamentCard}) {
  return (
    <Box
      component={TransitionLink}
      href={tournamentHref(t.id)}
      aria-label={`Turnir danas: ${t.name}`}
      sx={{flex: "none", borderRadius: "24px", background: color.navy, color: color.white, p: "18px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: shadow.hero, textDecoration: "none"}}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
        <Box component="span" sx={{...eyebrowSx, color: color.cream}}>
          Turnir danas
        </Box>
        {t.live_kolo && (
          <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 13, fontWeight: 700, color: color.white}}>
            <LiveDot size={7} />
            Kolo {t.live_kolo}
          </Box>
        )}
      </Box>
      <Box sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05, overflowWrap: "anywhere"}}>{t.name}</Box>
      {t.me && (
        <Box component="span" sx={{fontSize: 15}}>
          Tvoja ekipa ·{" "}
          <Box component="strong" sx={{fontWeight: 700}}>
            {t.me.team_name}
          </Box>
        </Box>
      )}
      <Box component="span" sx={{fontSize: 14, lineHeight: 1.45, color: color.cream}}>
        {todayLine(t)}
      </Box>
    </Box>
  );
}

// What the day card says under the team: out of the tournament, not playing, waiting, joining, or the next Kolo
function todayLine(t: TournamentCard): string {
  const me = t.me;
  if (me?.excluded) return "Isključeni ste iz turnira. Na stranici turnira piše zašto.";
  if (me?.status === "WAITING") return `Na listi čekanja · ${me.position}. Ulazite čim se mjesto oslobodi.`;
  if (me && !me.active) return "Ekipa ne igra: niste potvrdili dolazak ili ste otišli. Na stranici turnira možete uskočiti.";
  if (me?.plays_from) return `Igrate od Kola ${me.plays_from}. Stol se pojavi kad organizator objavi kolo.`;
  return t.live_kolo ? `Vaš stol u Kolu ${t.live_kolo} je odigran. Sljedeće kolo kreće kad svi stolovi završe.` : "Sljedeće kolo uskoro: stol će se pojaviti ovdje.";
}

// No tournament coming: what the Turniri tab says instead of the card
export function NoTournamentCard() {
  return (
    <Box sx={{flex: "none", minHeight: 160, boxSizing: "border-box", borderRadius: "24px", background: color.lineFill, border: `1.5px dashed ${tint.navy[22]}`, p: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px"}}>
      <Box sx={{...eyebrowSx, color: color.muted}}>Nema nadolazećih turnira</Box>
      <Box sx={{fontSize: 14, lineHeight: 1.45, color: color.muted}}>Kad se objavi novi turnir, ovdje se možeš prijaviti.</Box>
    </Box>
  );
}

// A tournament coming up (S2–S4, D1): the date tile, its name, time and place; under it the players
// signed up and Vidi stranicu (the page first, Prijavi se is there), or that the viewer is in it
export function UpcomingCard({t}: {t: TournamentCard}) {
  // a visitor without an account signs in first; a player's Prijavi se opens the tournament's page
  const guest = useAuthStore((s) => s.user == null);
  return (
    <Card component="li" sx={{p: "14px", display: "flex", flexDirection: "column", gap: "12px", borderRadius: "22px"}}>
      <Box component={TransitionLink} href={tournamentHref(t.id)} sx={{display: "flex", alignItems: "center", gap: "12px", color: color.ink, textDecoration: "none", minWidth: 0}}>
        <DateTile date={t.date} size={48} />
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
          <Box component="span" sx={{fontSize: 18, fontWeight: 800, lineHeight: 1.15, overflowWrap: "anywhere"}}>
            {t.name}
          </Box>
          <Box component="span" sx={{display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 10px", fontSize: 13, color: color.ink2, "& svg": {fontSize: 16, color: color.muted}}}>
            {t.start_time && (
              <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: "3px"}}>
                <ScheduleRoundedIcon aria-hidden />
                {t.start_time}
              </Box>
            )}
            {t.location.name && (
              <Box component="span" sx={{display: "inline-flex", alignItems: "center", gap: "3px"}}>
                <PlaceRoundedIcon aria-hidden />
                {t.location.name}
              </Box>
            )}
            {!t.declarations && (
              <Box component="span" sx={{height: 22, display: "inline-flex", alignItems: "center", px: "8px", borderRadius: "7px", background: color.lineFill, fontSize: 12, fontWeight: 700, color: color.ink2}}>
                Bez zvanja
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      {/* on a narrow phone Vidi stranicu goes under the teams, on the right */}
      <Box sx={{display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 10px", p: "8px 8px 8px 12px", borderRadius: "16px", background: color.paper2}}>
        <TeamsCount t={t} max={2} />
        {t.me ? (
          <Box component="span" sx={{display: "flex", alignItems: "center", gap: "5px", fontSize: 14, fontWeight: 700, color: t.me.status === "WAITING" ? color.medal[0] : color.green, "& svg": {fontSize: 19}}}>
            {t.me.status === "WAITING" ? <HourglassTopRoundedIcon aria-hidden /> : <CheckCircleRoundedIcon aria-hidden />}
            {t.me.status === "WAITING" ? "Čekaš" : "Prijavljeni"}
          </Box>
        ) : t.signups_open_now ? (
          <Box
            {...{component: TransitionLink, href: guest ? "/login" : tournamentHref(t.id)}}
            sx={{...buttonBase, flex: "none", ml: "auto", height: 44, display: "flex", alignItems: "center", gap: "2px", pl: "12px", pr: "6px", borderRadius: "12px", background: color.navy, color: color.white, fontSize: 15, fontWeight: 700, textDecoration: "none", "& svg": {fontSize: 20}}}
          >
            Prijavi se
            <ChevronRightRoundedIcon aria-hidden />
          </Box>
        ) : (
          <Box component="span" sx={{display: "flex", alignItems: "center", gap: "4px", fontSize: 13, fontWeight: 600, color: color.muted, "& svg": {fontSize: 17}}}>
            <LockRoundedIcon aria-hidden />
            Prijave zatvorene
          </Box>
        )}
      </Box>
    </Card>
  );
}

// Završeni turniri ›: the latest one and the viewer's place in it, and how many there are
export function FinishedRow({finished}: {finished: TournamentCard[]}) {
  if (finished.length === 0) return null;
  const last = finished[0];
  const sub = [last.name, last.my_place ? `vi ${last.my_place}.` : last.winner ? `pobjednik ${last.winner.team_name}` : null].filter(Boolean).join(" · ");
  return (
    <Box
      component={TransitionLink}
      href="/turniri/zavrseni"
      sx={{...buttonBase, flex: "none", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", px: "16px", py: "10px", borderRadius: "20px", background: color.white, color: color.ink, textDecoration: "none", boxShadow: shadow.card}}
    >
      <HistoryRoundedIcon aria-hidden sx={{fontSize: 24, color: color.navy}} />
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
          Završeni turniri
        </Box>
        <Box component="span" sx={{fontSize: 13, color: color.muted, ...ellipsis}}>
          {sub}
        </Box>
      </Box>
      <Box component="span" sx={{flex: "none", minWidth: 26, height: 26, px: "7px", boxSizing: "border-box", borderRadius: "13px", background: color.lineFill, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}>
        {finished.length}
      </Box>
      <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26, color: color.navy}} />
    </Box>
  );
}
