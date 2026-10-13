"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import usePlayerOverview from "@/app/_hooks/usePlayerOverview";
import useShortWindow from "@/app/_hooks/useShortWindow";
import useTeams from "@/app/_hooks/useTeams";
import type {PlayerOverview} from "@/app/_interfaces/profiles";
import type {RatingNight} from "@/app/_interfaces/ratings";
import {teamAddOptions} from "@/app/_lib/ui/directory";
import {playerTeamLeagues, playerTiles, teamInitial} from "@/app/_lib/ui/profiles";
import {formatChange, ratingPath, shortDate} from "@/app/_lib/ui/ratings";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color} from "@/app/_styles/tokens";
import {changeInk, ColumnCard, ColumnHead, ellipsis, EmptyState, InitialsAvatar, ResultPill, SearchAddField, tabular, Tag} from "@/app/_ui/sp";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import GroupRemoveRoundedIcon from "@mui/icons-material/GroupRemoveRounded";
import {Box} from "@mui/material";
import {useEffect, useMemo, useRef, useState} from "react";
import {EditPlayerPanel} from "./EditPlayerPanel";
import {
  DesktopFrame,
  HeaderRating,
  HeroCard,
  PageColumns,
  PageStatus,
  PhoneFrame,
  PLAYER_GRID,
  PLAYER_STACKED_GRID,
  RowChevron,
  stretchedLink,
  stretchedRow,
} from "./PageParts";
import {PersonalDataCard} from "./PersonalDataCard";
import {EditDataButton, PlayerTeamsAdmin, usePlayerTeamsAdmin} from "./PlayerAdmin";
import {ProfileHero} from "./ProfileHero";
import {AddError, RemoveButton} from "./TeamAdmin";
import {TeamCards} from "./TeamCards";

// The Player page (/players/[playerId], handoff §6, frames 13c, 13g, 13j, 13l): the player's name and rating (to the
// rating's detail), Osobni podaci (first and last name for everyone, everything for the player and admins: the server
// sends nothing else), their teams and, on the desktop, their last nights. On the desktop an admin also adds the player
// to teams and takes them out (PlayerAdmin.tsx) and edits their details and account (EditPlayerPanel.tsx).

const NO_TEAMS = "Igrač još nije ni u jednoj ekipi.";

// a player who isn't on Rejting has no rating detail (it would say "Igrač ne postoji")
const ratingHref = (p: PlayerOverview) => (p.rating.rank != null ? ratingPath(p.player.id) : null);

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

// The desktop Player page (13g). embedded: inside the admin's Igrači directory (13j), which brings its own frame. An
// admin gets the controls (the server says so in viewer.admin).
export function PlayerPageDesktop({playerId, embedded = false}: {playerId: number; embedded?: boolean}) {
  const overview = usePlayerOverview(playerId);
  const data = overview.data;
  const nav = useNavStack(data?.player.name ?? null);
  const short = useShortWindow();
  const actions = usePlayerTeamsAdmin(overview);
  const admin = data?.viewer.admin ? actions : null;
  // "Uredi osobne podatke" is open; it closes when another player's page takes this one's place
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(false);
  }, [playerId]);
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
          <PageColumns template={PLAYER_GRID} stackedTemplate={PLAYER_STACKED_GRID}>
            <DesktopTeams data={data} admin={admin} />
            <PersonalDataCard
              player={data.player}
              full={data.full}
              desktop
              action={admin && <EditDataButton expanded={editing} onClick={() => setEditing(true)} />}
            />
            <DesktopNights nights={data.nights} />
          </PageColumns>
          {admin && editing && <EditPlayerPanel key={data.player.id} data={data} overview={overview} onClose={() => setEditing(false)} />}
        </>
      ) : (
        <PageStatus kind="player" overview={overview} nav={nav} desktop template={PLAYER_GRID} />
      )}
    </DesktopFrame>
  );
}

// Ekipe (P:274-297): each team with its leagues, to the team's page. An admin also adds the player to a team and takes
// them out of one.
function DesktopTeams({data, admin}: {data: PlayerOverview; admin: PlayerTeamsAdmin | null}) {
  const teams = data.teams;
  const listRef = useRef<HTMLUListElement>(null);
  // a removed row takes its focused remove button with it: the focus goes to the next row's (the one before, when it
  // was the last), or to "Dodaj u ekipu" when no team is left
  const refocus = useRef<{card: Element | null; to: number | null} | null>(null);
  const remove = (team: PlayerOverview["teams"][number]) => {
    const row = document.activeElement?.closest("li[data-team]");
    if (row?.getAttribute("data-team") === String(team.team_id) && listRef.current?.contains(row)) {
      const at = teams.findIndex((t) => t.team_id === team.team_id);
      const to = teams[at + 1] ?? teams[at - 1];
      refocus.current = {card: listRef.current.closest("section"), to: to?.team_id ?? null};
    }
    admin?.removeTeam(team);
  };
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const next =
      target.to != null
        ? listRef.current?.querySelector<HTMLElement>(`li[data-team="${target.to}"] button`)
        : target.card?.querySelector<HTMLElement>("input:not(:disabled)");
    next?.focus();
  }, [teams]);
  return (
    <ColumnCard
      title="Ekipe"
      addField={admin && <TeamsAddField data={data} admin={admin} />}
      empty={teams.length === 0 && <EmptyState icon>{NO_TEAMS}</EmptyState>}
    >
      <Box component="ul" ref={listRef} sx={{listStyle: "none", m: 0, p: 0}}>
        {teams.map((t) => (
          <Box
            component="li"
            key={t.team_id}
            data-team={t.team_id}
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
            {admin && <RemoveButton label={`Ukloni iz ekipe ${t.team_name}`} onClick={() => remove(t)} icon={<GroupRemoveRoundedIcon />} />}
            <Box sx={{width: 36, height: 36, flex: "none", display: "flex", alignItems: "center", justifyContent: "center"}}>
              <RowChevron />
            </Box>
          </Box>
        ))}
      </Box>
    </ColumnCard>
  );
}

// "Dodaj u ekipu" (P:276-286): the teams the player isn't in, found by name. A deactivated player can't join a team
// (the server refuses it), so for them the field is greyed and says why.
function TeamsAddField({data, admin}: {data: PlayerOverview; admin: PlayerTeamsAdmin}) {
  const {list, error, reload} = useTeams();
  const active = data.player.active;
  const options = useMemo(() => (list && active ? teamAddOptions(list, data.teams.map((t) => t.team_id)) : []), [list, active, data.teams]);
  return (
    <>
      <SearchAddField
        placeholder="Dodaj u ekipu · ime ekipe"
        icon={<GroupAddRoundedIcon aria-hidden />}
        options={options}
        onAdd={(o) => {
          const team = list?.find((t) => t.id === o.id);
          if (team) admin.addTeam(team);
        }}
        disabled={!active}
        note={active ? (list && options.length === 0 ? "Igrač je već u svim ekipama." : undefined) : "Deaktivirani igrač se ne može dodati u ekipu."}
        noHit="Nema takve ekipe."
      />
      {error && !list && <AddError onRetry={reload}>{error}</AddError>}
      {admin.error && <AddError>{admin.error}</AddError>}
    </>
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
