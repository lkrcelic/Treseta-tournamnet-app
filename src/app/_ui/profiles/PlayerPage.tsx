"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import usePlayerOverview from "@/app/_hooks/usePlayerOverview";
import type {PlayerOverview} from "@/app/_interfaces/profiles";
import type {RatingNight} from "@/app/_interfaces/ratings";
import {playerTeamLeagues, playerTiles, teamInitial} from "@/app/_lib/ui/profiles";
import {formatChange, shortDate} from "@/app/_lib/ui/ratings";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color} from "@/app/_styles/tokens";
import {changeInk, ColumnCard, ColumnHead, ellipsis, EmptyState, InitialsAvatar, ResultPill, tabular, Tag} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import {DesktopFrame, HeaderRating, HeroCard, PageStatus, PhoneFrame, PLAYER_GRID, RowChevron, stretchedLink, stretchedRow, useShortWindow} from "./PageParts";
import {PersonalDataCard} from "./PersonalDataCard";
import {ProfileHero} from "./ProfileHero";
import {TeamCards} from "./TeamCards";

// The Player page (/players/[playerId], handoff §6, frames 13c, 13g, 13l): the player's name and rating (to the rating's
// detail), Osobni podaci (first and last name for everyone, everything for the player and admins: the server sends
// nothing else), their teams and, on the desktop, their last nights. Read-only; the admin's controls come with the
// Igrači directory.

const NO_TEAMS = "Igrač još nije ni u jednoj ekipi.";

// a player who isn't on Rejting has no rating detail (it would say "Igrač ne postoji")
const ratingHref = (p: PlayerOverview) => (p.rating.rank != null ? `/ratings/${p.player.id}` : null);

// ---------- phone ----------

// The phone Player page (13c): laid out like Moj profil
export function PlayerPagePhone({playerId}: {playerId: number}) {
  const overview = usePlayerOverview(playerId);
  const data = overview.data;
  const nav = useNavStack(data?.player.name ?? null);
  return (
    <PhoneFrame eyebrow="Igrač" nav={nav}>
      {data ? (
        <>
          <ProfileHero
            name={data.player.name}
            avatarName={data.player.name}
            rating={data.rating}
            ratingHref={ratingHref(data)}
            tag={data.player.active ? undefined : <Tag variant="inactive" size="sm" />}
          />
          <PersonalDataCard player={data.player} full={data.full} />
          <TeamCards title="Ekipe" empty={NO_TEAMS} emptyIcon teams={data.teams} />
        </>
      ) : (
        <PageStatus kind="player" overview={overview} nav={nav} />
      )}
    </PhoneFrame>
  );
}

// ---------- desktop ----------

const NIGHTS_GRID = "52px minmax(0,1fr) 44px 48px";

// The desktop Player page (13g). embedded: inside the admin's Igrači directory (13j), which brings its own frame.
export function PlayerPageDesktop({playerId, embedded = false}: {playerId: number; embedded?: boolean}) {
  const overview = usePlayerOverview(playerId);
  const data = overview.data;
  const nav = useNavStack(data?.player.name ?? null);
  const short = useShortWindow();
  return (
    <DesktopFrame embedded={embedded} short={short} nav={nav}>
      {data ? (
        <>
          <HeroCard
            desktop
            short={short}
            avatarName={data.player.name}
            title={data.player.name}
            nameTag={data.player.active ? undefined : <Tag variant="inactive" />}
            aside={<HeaderRating rating={data.rating.rating} provisional={data.rating.provisional} href={ratingHref(data)} short={short} />}
            tiles={playerTiles(data.rating, data.teams)}
          />
          <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: PLAYER_GRID, gridTemplateRows: "minmax(0,1fr)", gap: "18px"}}>
            <DesktopTeams teams={data.teams} />
            <PersonalDataCard player={data.player} full={data.full} desktop />
            <DesktopNights nights={data.nights} />
          </Box>
        </>
      ) : (
        <PageStatus kind="player" overview={overview} nav={nav} desktop template={PLAYER_GRID} />
      )}
    </DesktopFrame>
  );
}

// Ekipe (P:274-297): each team with its leagues, to the team's page
function DesktopTeams({teams}: {teams: PlayerOverview["teams"]}) {
  return (
    <ColumnCard title="Ekipe" empty={teams.length === 0 && <EmptyState icon>{NO_TEAMS}</EmptyState>}>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0}}>
        {teams.map((t) => (
          <Box
            component="li"
            key={t.team_id}
            sx={{
              ...stretchedRow,
              minHeight: 66,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              p: "10px 12px 10px 20px",
              borderBottom: `1px solid ${color.divider}`,
              transition: "background 150ms ease",
              "&:hover": {background: color.paper2},
            }}
          >
            <Box component={TransitionLink} href={`/teams/${t.team_id}`} sx={{...stretchedLink, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px"}}>
              <InitialsAvatar name={t.team_name} letters={teamInitial(t.team_name)} size={40} variant="paper" />
              <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: color.ink, overflowWrap: "anywhere"}}>
                  {t.team_name}
                </Box>
                {/* league names differ at their end ("… Proljeće 25/26"): they wrap instead of being cut */}
                <Box component="span" sx={{fontSize: 13, lineHeight: 1.3, color: color.muted, overflowWrap: "anywhere"}}>
                  {playerTeamLeagues(t.leagues)}
                </Box>
              </Box>
            </Box>
            <Box sx={{width: 36, height: 36, flex: "none", display: "flex", alignItems: "center", justifyContent: "center"}}>
              <RowChevron />
            </Box>
          </Box>
        ))}
      </Box>
    </ColumnCard>
  );
}

// Zadnje večeri (P:307-316): the last five nights with who they played, the matches won:lost and the rating change
function DesktopNights({nights}: {nights: RatingNight[]}) {
  return (
    <ColumnCard
      title="Zadnje večeri"
      header={
        <ColumnHead grid={NIGHTS_GRID}>
          <span>Datum</span>
          <span>Protivnik</span>
          <span>Rez.</span>
          <Box component="span" sx={{textAlign: "right"}}>
            Rejt.
          </Box>
        </ColumnHead>
      }
      empty={nights.length === 0 && <EmptyState sx={{p: "32px 20px"}}>Još nema odigranih kola.</EmptyState>}
    >
      <Box component="ol" sx={{listStyle: "none", m: 0, p: 0}}>
        {nights.map((n) => {
          const opponents = n.opponents.join(", ");
          return (
            <Box
              component="li"
              key={n.night}
              sx={{height: 54, display: "grid", gridTemplateColumns: NIGHTS_GRID, gap: "12px", alignItems: "center", p: "0 20px", borderBottom: `1px solid ${color.divider}`}}
            >
              <Box component="span" sx={{fontSize: 14, color: color.muted, ...tabular}}>
                {shortDate(n.night)}
              </Box>
              <Box component="span" title={opponents || undefined} sx={{minWidth: 0, fontSize: 15, fontWeight: 600, color: color.ink, ...ellipsis}}>
                {opponents ? `vs ${opponents}` : "—"}
              </Box>
              <ResultPill won={n.won} lost={n.lost} size="sm" sx={{justifySelf: "start"}} />
              <Box component="span" sx={{textAlign: "right", fontSize: 15, fontWeight: 700, color: changeInk(n.change), whiteSpace: "nowrap", ...tabular}}>
                {formatChange(n.change)}
              </Box>
            </Box>
          );
        })}
      </Box>
    </ColumnCard>
  );
}
