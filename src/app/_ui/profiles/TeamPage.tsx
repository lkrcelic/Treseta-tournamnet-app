"use client";

import useAdminPhone from "@/app/_hooks/useAdminPhone";
import useAdminPlayers from "@/app/_hooks/useAdminPlayers";
import {reloadLeagues, useLeagueList} from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import useShortWindow from "@/app/_hooks/useShortWindow";
import useTeamOverview from "@/app/_hooks/useTeamOverview";
import type {TeamNight, TeamOverview, TeamOverviewLeague, TeamOverviewPlayer} from "@/app/_interfaces/profiles";
import {leagueDateString} from "@/app/_lib/dates";
import {leagueAddOptions, playerAddOptions} from "@/app/_lib/ui/directory";
import {leagueStatusParts, nightParts, rosterSubline, teamInitial, teamTiles} from "@/app/_lib/ui/profiles";
import {formatChange, shortDate} from "@/app/_lib/ui/ratings";
import {count, NOUN} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, shadow} from "@/app/_styles/tokens";
import {
  buttonBase,
  Card,
  changeInk,
  ColumnCard,
  ColumnHead,
  ellipsis,
  EmptyState,
  InitialsAvatar,
  ProvisionalTag,
  RankBadge,
  rowFocus,
  SearchAddField,
  SectionLabel,
  Spinner,
  tabular,
  Tag,
} from "@/app/_ui/sp";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import {Box} from "@mui/material";
import React, {useId, useMemo, useState} from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import type {TeamPhotoInfo} from "@/app/_interfaces/photo";
import type {Overview} from "@/app/_hooks/useOverview";
import {teamsList} from "@/app/_hooks/useTeams";
import {BlockedNote, EditableAvatar, PhotoControls, PhotoInfo, usePhoto, visibilityLabel} from "@/app/_ui/photo/PhotoParts";
import {PhotoSheet} from "@/app/_ui/photo/PhotoSheet";
import {PhotoDialog} from "@/app/_ui/photo/PhotoDialog";
import {PhotoAdminCard} from "@/app/_ui/photo/PhotoAdmin";
import {
  ColumnWithFooter,
  DesktopFrame,
  heroAvatarSize,
  HeroCard,
  PageColumns,
  PageStatus,
  PhoneFrame,
  PhoneListHead,
  RowChevron,
  StatusDot,
  stretchedLink,
  stretchedRow,
  TEAM_GRID,
  TEAM_STACKED_GRID,
} from "./PageParts";
import {AddError, NameButton, NameEditing, RemoveButton, TeamAdmin, TeamNameInput, useNameFocus, useTeamAdmin} from "./TeamAdmin";

// The Team page (/teams/[teamId], handoff §6, frames 13a, 13b, 13f, 13k–13o): the cream header with the team's best
// place, players and leagues, then its players (to their pages), its leagues (to that league's standings with the team
// highlighted) and its last nights. On the desktop an admin also renames the team, adds and removes its players and puts
// it in leagues (TeamAdmin.tsx).

// what an empty column says (Nova ekipa says it its own way)
export type EmptyText = {players: string; leagues: string; nights: string};

const EMPTY: EmptyText = {
  players: "Ekipa još nema igrača.",
  leagues: "Ekipa još ne igra ni u jednoj ligi.",
  nights: "Još nema odigranih večeri.",
};

const playerHref = (p: TeamOverviewPlayer) => `/players/${p.id}`;
const leagueHref = (l: TeamOverviewLeague, teamId: number) => `/league/${l.league_id}/standings?team=${teamId}`;

// The team's photo with its settings, for its players and admins (null for anyone else)
const photoSettings = (team: TeamOverview | null): TeamPhotoInfo | null => (team && "can_edit" in team.photo ? team.photo : null);

// The team's photo as the page holds it, and what its players do to it; a change shows on the page, and in the admin's
// Ekipe directory
function useTeamPhoto(overview: Overview<TeamOverview>) {
  const team = overview.data;
  const settings = photoSettings(team);
  const teamId = team?.team.id ?? 0;
  const target = useMemo(() => ({kind: "team" as const, id: teamId}), [teamId]);
  const info: PhotoInfo = {photo_url: team?.photo.photo_url ?? null, photo_visibility: settings?.photo_visibility ?? "ALL", photo_blocked: settings?.photo_blocked ?? false};
  const {setData} = overview;
  return usePhoto(target, info, (next) => {
    setData((d) => ({...d, photo: {...d.photo, ...next}}));
    teamsList.update((list) => list.map((t) => (t.id === teamId ? {...t, photo_url: next.photo_url} : t)));
  });
}

// rename: the admin's pencil next to the name (desktop). photo: the team's player changes the photo from its avatar
// (the camera badge; onPhoto opens the sheet or the dialog).
function Hero({
  team,
  desktop,
  short = false,
  rename,
  photo,
  onPhoto,
}: {
  team: TeamOverview;
  desktop: boolean;
  short?: boolean;
  rename?: NameEditing;
  photo?: PhotoControls;
  onPhoto?: () => void;
}) {
  const focus = useNameFocus(rename?.editing ?? false);
  const letters = teamInitial(team.team.name);
  const editable = photo && onPhoto && photoSettings(team)?.can_edit;
  const blocked = photo?.info.photo_blocked ?? false;
  return (
    <HeroCard
      desktop={desktop}
      short={short}
      avatarName={team.team.name}
      avatarLetters={letters}
      avatarSrc={team.photo.photo_url}
      avatar={
        editable ? (
          <EditableAvatar
            name={team.team.name}
            letters={letters}
            src={photo.info.photo_url}
            size={heroAvatarSize(desktop, short)}
            badge={desktop && short ? 24 : 28}
            hover={desktop}
            blocked={blocked}
            label={photo.info.photo_url ? "Promijeni sliku ekipe" : "Dodaj sliku ekipe"}
            // the computer has nothing to open while it is blocked
            onClick={() => (desktop && blocked ? undefined : onPhoto())}
            sx={desktop ? {fontSize: short ? 20 : 28} : undefined}
          />
        ) : undefined
      }
      title={team.team.name}
      titleEditor={rename?.editing ? <TeamNameInput edit={rename} short={short} inputRef={focus.inputRef} /> : undefined}
      nameTag={rename ? <NameButton edit={rename} short={short} onStart={rename.start} buttonRef={focus.buttonRef} /> : undefined}
      cornerTag={team.team.mine ? <Tag variant="mine" size={desktop ? "md" : "sm"} /> : undefined}
      tiles={teamTiles(team.stats)}
    />
  );
}

// A player's name, and under it "Neaktivan" (when deactivated) and @username or the team's name. The tag sits on the
// second line, so a long name keeps its room.
function PlayerNames({player, teamName, desktop}: {player: TeamOverviewPlayer; teamName: string; desktop: boolean}) {
  return (
    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: desktop ? "1px" : "2px"}}>
      <Box component="span" title={desktop ? player.name : undefined} sx={{minWidth: 0, fontSize: 16, fontWeight: player.me ? 700 : 600, color: color.ink, ...ellipsis}}>
        {player.name}
      </Box>
      <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", minWidth: 0}}>
        {!player.active && <Tag variant="inactive" size="row" />}
        <Box component="span" sx={{minWidth: 0, fontSize: 13, color: color.muted, ...ellipsis}}>
          {rosterSubline(player, teamName)}
        </Box>
      </Box>
    </Box>
  );
}

// ---------- phone ----------

// The admin's phone (admin-mobile 33) gets the desktop's controls: the pencil on the name, Dodaj igrača with a remove
// button per player, and Dodaj u ligu
export function TeamPagePhone({teamId}: {teamId: number}) {
  const overview = useTeamOverview(teamId);
  const team = overview.data;
  const nav = useNavStack(team?.team.name ?? null);
  const adminPhone = useAdminPhone();
  const actions = useTeamAdmin(overview);
  const admin = adminPhone && team?.viewer.admin ? actions : null;
  const photo = useTeamPhoto(overview);
  const [photoOpen, setPhotoOpen] = useState(false);
  const settings = photoSettings(team);
  return (
    <PhoneFrame eyebrow="Ekipa" nav={nav}>
      {team ? (
        <>
          <Hero team={team} desktop={false} rename={admin?.rename} photo={photo} onPhoto={() => setPhotoOpen(true)} />
          {settings?.can_edit && <TeamPhotoVisibility photo={photo} onOpen={() => setPhotoOpen(true)} />}
          {admin && (
            <PhotoAdminCard
              target={{kind: "team", id: team.team.id}}
              name={team.team.name}
              letters={teamInitial(team.team.name)}
              info={photo.info}
              phone
              onChange={(next) => overview.setData((d) => ({...d, photo: {...d.photo, ...next}}))}
            />
          )}
          {settings?.can_edit && (
            <PhotoSheet kind="team" photo={photo} name={team.team.name} letters={teamInitial(team.team.name)} open={photoOpen} onClose={() => setPhotoOpen(false)} />
          )}
          <PhonePlayers team={team} admin={admin} />
          <PhoneLeagues team={team} admin={admin} />
          <PhoneNights nights={team.nights} />
        </>
      ) : (
        <PageStatus kind="team" overview={overview} nav={nav} />
      )}
    </PhoneFrame>
  );
}

// "Tko vidi sliku ekipe" under the header card, for the team's players (T1): Vidljivost › opens Slika ekipe; while an
// admin has blocked the team's photo, a note says so (T3)
function TeamPhotoVisibility({photo, onOpen}: {photo: PhotoControls; onOpen: () => void}) {
  const titleId = useId();
  return (
    <Box component="section" aria-labelledby={titleId} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      {photo.info.photo_blocked && <BlockedNote kind="team" sx={{background: color.white}} />}
      <SectionLabel id={titleId}>Tko vidi sliku ekipe</SectionLabel>
      <Card sx={{overflow: "hidden"}}>
        <Box
          component="button"
          type="button"
          aria-haspopup="dialog"
          onClick={onOpen}
          sx={{...buttonBase, width: "100%", height: 52, display: "flex", alignItems: "center", gap: "8px", pl: "16px", pr: "10px", textAlign: "left"}}
        >
          <Box component="span" sx={{flex: 1, fontSize: 15, color: color.muted}}>
            Vidljivost
          </Box>
          <Box component="span" sx={{fontSize: 15, fontWeight: 600, color: color.navy}}>
            {visibilityLabel(photo.info.photo_visibility)}
          </Box>
          <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 24, color: color.navy}} />
        </Box>
      </Card>
    </Box>
  );
}

function PhoneSection({title, children}: {title: string; children: React.ReactNode}) {
  const titleId = useId();
  return (
    <Box component="section" aria-labelledby={titleId} sx={{flex: "none", display: "flex", flexDirection: "column", gap: "8px"}}>
      <SectionLabel id={titleId}>{title}</SectionLabel>
      <Card sx={{overflow: "hidden"}}>{children}</Card>
    </Box>
  );
}

// the rows of a phone card: a hairline between them, none under the last
const phoneRows = {listStyle: "none", m: 0, p: 0, "& > li": {borderBottom: `1px solid ${color.line}`}, "& > li:last-of-type": {borderBottom: "none"}} as const;

const phoneRowLink = {
  ...buttonBase,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  textDecoration: "none",
  textAlign: "left",
  color: color.ink,
  "&:focus-visible": rowFocus,
} as const;

function PhonePlayers({team, admin}: {team: TeamOverview; admin: TeamAdmin | null}) {
  const pending = admin?.pending.filter((p) => !team.players.some((x) => x.id === p.id)) ?? [];
  return (
    <PhoneSection title="Igrači">
      {admin && (
        <Box sx={{p: "12px 12px 4px"}}>
          <PlayersAddField team={team} admin={admin} />
        </Box>
      )}
      {team.players.length === 0 && pending.length === 0 ? (
        <EmptyState icon>{EMPTY.players}</EmptyState>
      ) : (
        <>
          <PhoneListHead sx={{pl: "14px", pr: "44px"}}>
            <span>Igrač</span>
            <span>Rejting</span>
          </PhoneListHead>
          <Box component="ul" sx={phoneRows}>
            {team.players.map((p) =>
              admin ? (
                // the row opens the player; the remove button sits above the link
                <Box
                  component="li"
                  key={p.id}
                  sx={{...stretchedRow, height: 62, display: "flex", alignItems: "center", gap: "12px", p: "0 4px 0 14px", background: p.me ? color.cream2 : undefined, boxShadow: p.me ? shadow.mineBar : undefined}}
                >
                  <Box component={TransitionLink} href={playerHref(p)} sx={{...stretchedLink, flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px"}}>
                    <InitialsAvatar name={p.name} src={p.photo_url} size={38} variant="paper" />
                    <PlayerNames player={p} teamName={team.team.name} desktop={false} />
                    <Box component="span" sx={{flex: "none", fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1, color: color.ink, ...tabular}}>
                      {p.rating}
                    </Box>
                  </Box>
                  <RemoveButton label={`Ukloni ${p.name} iz ekipe`} onClick={() => admin.removePlayer(p)} size={44} />
                </Box>
              ) : (
                <Box component="li" key={p.id}>
                  <Box
                    component={TransitionLink}
                    href={playerHref(p)}
                    sx={{...phoneRowLink, height: 62, p: "0 10px 0 14px", background: p.me ? color.cream2 : undefined, boxShadow: p.me ? shadow.mineBar : undefined}}
                  >
                    <InitialsAvatar name={p.name} src={p.photo_url} size={38} variant="paper" />
                    <PlayerNames player={p} teamName={team.team.name} desktop={false} />
                    <Box component="span" sx={{flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px"}}>
                      <Box component="span" sx={{fontFamily: font.display, fontSize: 22, fontWeight: 800, lineHeight: 1, color: color.ink, ...tabular}}>
                        {p.rating}
                      </Box>
                      {p.provisional && <ProvisionalTag size="sm" />}
                    </Box>
                    <RowChevron />
                  </Box>
                </Box>
              )
            )}
            {pending.map((p) => (
              <Box component="li" key={`pending-${p.id}`} aria-busy="true" sx={{height: 62, display: "flex", alignItems: "center", gap: "12px", p: "0 14px"}}>
                <InitialsAvatar name={p.name} size={38} variant="paper" />
                <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                  <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink, ...ellipsis}}>
                    {p.name}
                  </Box>
                  <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                    Dodajem u ekipu…
                  </Box>
                </Box>
                <Spinner size={22} />
              </Box>
            ))}
          </Box>
        </>
      )}
    </PhoneSection>
  );
}

function PhoneLeagues({team, admin}: {team: TeamOverview; admin: TeamAdmin | null}) {
  return (
    <PhoneSection title="Lige">
      {admin && (
        <Box sx={{p: "12px 12px 4px"}}>
          <LeaguesAddField team={team} admin={admin} />
        </Box>
      )}
      {team.leagues.length === 0 ? (
        <EmptyState icon>{EMPTY.leagues}</EmptyState>
      ) : (
        <>
          <PhoneListHead sx={{pl: "14px", pr: "44px"}}>
            <Box component="span" sx={{display: "flex", gap: "12px"}}>
              <Box component="span" sx={{width: 34, textAlign: "center"}}>
                #
              </Box>
              <span>Liga</span>
            </Box>
            <span>Bod</span>
          </PhoneListHead>
          <Box component="ul" sx={phoneRows}>
            {team.leagues.map((l) => (
              <Box component="li" key={l.league_id}>
                <Box component={TransitionLink} href={leagueHref(l, team.team.id)} sx={{...phoneRowLink, minHeight: 64, p: "10px 10px 10px 14px"}}>
                  <RankBadge rank={l.rank} medal hash size={34} />
                  <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
                    <Box component="span" sx={{fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: color.ink, overflowWrap: "anywhere"}}>
                      {l.league_name}
                    </Box>
                    <LeagueStatus league={l} phone />
                  </Box>
                  <Box component="span" sx={{flex: "none", minWidth: 34, textAlign: "right", fontFamily: font.display, fontSize: 24, fontWeight: 800, lineHeight: 1, color: color.ink, ...tabular}}>
                    {l.points ?? "–"}
                  </Box>
                  <RowChevron />
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </PhoneSection>
  );
}

function PhoneNights({nights}: {nights: TeamNight[]}) {
  return (
    <PhoneSection title="Zadnje večeri">
      {nights.length === 0 ? (
        <EmptyState icon>{EMPTY.nights}</EmptyState>
      ) : (
        <Box component="ol" sx={phoneRows}>
          {nights.map((n) => (
            <Box
              component="li"
              key={`${n.date}|${n.league_id}`}
              sx={{minHeight: 56, boxSizing: "border-box", display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: "10px", alignItems: "center", p: "8px 16px"}}
            >
              <NightCells night={n} desktop={false} />
            </Box>
          ))}
        </Box>
      )}
    </PhoneSection>
  );
}

// "● Jesen 2026 · U tijeku": the dot green while the league runs; in a narrow column the line breaks before the
// separator ("Sezona 2025" / "· Završeno"), never after it
function LeagueStatus({league: l, phone = false}: {league: TeamOverviewLeague; phone?: boolean}) {
  const {season, state} = leagueStatusParts(l.season, l.live);
  return (
    <Box component="span" sx={{display: "flex", alignItems: "baseline", gap: "6px", minWidth: 0, fontSize: phone ? 13 : 12.5, lineHeight: 1.3, color: color.muted}}>
      <Box component="span" sx={{flex: "none", display: "flex", alignSelf: "flex-start", height: "1.3em", alignItems: "center"}}>
        <StatusDot live={l.live} />
      </Box>
      <span>
        {season && `${season} `}
        <Box component="span" sx={{whiteSpace: "nowrap"}}>
          {season && "· "}
          {state}
        </Box>
      </span>
    </Box>
  );
}

// date | result over the league | RAZ
function NightCells({night: n, desktop}: {night: TeamNight; desktop: boolean}) {
  return (
    <>
      <Box component="span" sx={{fontSize: 14, color: color.muted, ...tabular}}>
        {shortDate(n.date)}
      </Box>
      <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: desktop ? "2px" : "1px"}}>
        <Box component="span" sx={{fontSize: 15, fontWeight: 600, color: color.ink}}>
          {/* in a narrow column the line breaks between the counts, never inside "1 pob", and the next line starts
              with the separator ("1 pob · 3 ner" / "· 0 por") */}
          {nightParts(n.wins, n.draws, n.losses).map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && " "}
              <Box component="span" sx={{whiteSpace: "nowrap"}}>
                {i > 0 && "· "}
                {part}
              </Box>
            </React.Fragment>
          ))}
        </Box>
        {/* league names differ at their end ("… Proljeće 25/26", "… Jesen 25/26"): they wrap instead of being cut */}
        <Box component="span" sx={{fontSize: 12.5, lineHeight: 1.3, color: color.muted, overflowWrap: "anywhere"}}>
          {n.league_name}
        </Box>
      </Box>
      <Box component="span" sx={{textAlign: "right", fontSize: desktop ? 16 : 15, fontWeight: 700, color: changeInk(n.diff), whiteSpace: "nowrap", ...tabular}}>
        {formatChange(n.diff)}
      </Box>
    </>
  );
}

// ---------- desktop ----------

const GRID = {
  players: "minmax(0,1fr) auto 36px",
  leagues: "40px minmax(0,1fr) 44px 22px",
  nights: "52px minmax(0,1fr) 56px",
} as const;

// The desktop Team page (13f; 13n loading, 13o a new team). embedded: inside the admin's Ekipe directory (13h), which
// brings its own frame. An admin gets the controls (the server says so in viewer.admin).
export function TeamPageDesktop({teamId, embedded = false}: {teamId: number; embedded?: boolean}) {
  const overview = useTeamOverview(teamId);
  const team = overview.data;
  const nav = useNavStack(team?.team.name ?? null);
  const short = useShortWindow();
  const actions = useTeamAdmin(overview);
  const admin = team?.viewer.admin ? actions : null;
  const photo = useTeamPhoto(overview);
  const [photoOpen, setPhotoOpen] = useState(false);
  return (
    <DesktopFrame embedded={embedded} short={short} nav={nav}>
      {team ? (
        <>
          <Hero team={team} desktop short={short} rename={admin?.rename} photo={photo} onPhoto={() => setPhotoOpen(true)} />
          <TeamColumns
            team={team}
            admin={admin}
            footer={
              admin && (
                <PhotoAdminCard
                  target={{kind: "team", id: team.team.id}}
                  name={team.team.name}
                  letters={teamInitial(team.team.name)}
                  info={photo.info}
                  phone={false}
                  onChange={(next) => {
                    overview.setData((d) => ({...d, photo: {...d.photo, ...next}}));
                    teamsList.update((list) => list.map((t) => (t.id === team.team.id ? {...t, photo_url: next.photo_url} : t)));
                  }}
                />
              )
            }
          />
          {photoOpen && <PhotoDialog kind="team" photo={photo} onClose={() => setPhotoOpen(false)} />}
        </>
      ) : (
        <PageStatus kind="team" overview={overview} nav={nav} desktop template={TEAM_GRID} />
      )}
    </DesktopFrame>
  );
}

// The three columns under the header card (13f, 13h; 13o for Nova ekipa, which passes its own empty texts)
// footer: a card under Zadnje večeri (the admin's Slika ekipe)
export function TeamColumns({team, admin, empty = EMPTY, footer}: {team: TeamOverview; admin: TeamAdmin | null; empty?: EmptyText; footer?: React.ReactNode}) {
  return (
    <PageColumns template={TEAM_GRID} stackedTemplate={TEAM_STACKED_GRID}>
      <DesktopPlayers team={team} admin={admin} empty={empty.players} />
      <DesktopLeagues team={team} admin={admin} empty={empty.leagues} />
      <ColumnWithFooter footer={footer}>
        <DesktopNights nights={team.nights} empty={empty.nights} />
      </ColumnWithFooter>
    </PageColumns>
  );
}

const rightLabel = {textAlign: "right"} as const;

function DesktopPlayers({team, admin, empty}: {team: TeamOverview; admin: TeamAdmin | null; empty: string}) {
  const pending = admin?.pending.filter((p) => !team.players.some((x) => x.id === p.id)) ?? [];
  return (
    <ColumnCard
      title="Igrači"
      right={count(team.players.length + pending.length, NOUN.igrač)}
      addField={admin && <PlayersAddField team={team} admin={admin} />}
      header={
        <ColumnHead grid={GRID.players}>
          <span>Igrač</span>
          <Box component="span" sx={rightLabel}>
            Rejting
          </Box>
          <span />
        </ColumnHead>
      }
      empty={team.players.length === 0 && pending.length === 0 && <EmptyState icon>{empty}</EmptyState>}
    >
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0}}>
        {team.players.map((p) => (
          <Box
            component="li"
            key={p.id}
            sx={{
              ...stretchedRow,
              height: 64,
              display: "grid",
              gridTemplateColumns: GRID.players,
              gap: "12px",
              alignItems: "center",
              p: "0 12px 0 20px",
              borderBottom: `1px solid ${color.divider}`,
              background: p.me ? color.cream2 : undefined,
              boxShadow: p.me ? shadow.mineBar : undefined,
              transition: "background 150ms ease",
              "&:hover": p.me ? undefined : {background: color.paper2},
            }}
          >
            <Box component={TransitionLink} href={playerHref(p)} sx={{...stretchedLink, minWidth: 0, display: "flex", alignItems: "center", gap: "12px"}}>
              <InitialsAvatar name={p.name} src={p.photo_url} size={40} variant="paper" />
              <PlayerNames player={p} teamName={team.team.name} desktop />
            </Box>
            <Box sx={{justifySelf: "end", display: "flex", alignItems: "center", gap: "8px"}}>
              {p.provisional && <ProvisionalTag size="row" />}
              <Box component="span" sx={{fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1, color: color.ink, ...tabular}}>
                {p.rating}
              </Box>
            </Box>
            <Box sx={{width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center"}}>
              {admin ? <RemoveButton label={`Ukloni ${p.name} iz ekipe`} onClick={() => admin.removePlayer(p)} /> : <RowChevron />}
            </Box>
          </Box>
        ))}
        {pending.map((p) => (
          <Box
            component="li"
            key={`pending-${p.id}`}
            aria-busy="true"
            sx={{height: 64, display: "grid", gridTemplateColumns: GRID.players, gap: "12px", alignItems: "center", p: "0 12px 0 20px", borderBottom: `1px solid ${color.divider}`}}
          >
            <Box sx={{minWidth: 0, display: "flex", alignItems: "center", gap: "12px"}}>
              <InitialsAvatar name={p.name} size={40} variant="paper" />
              <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink, ...ellipsis}}>
                  {p.name}
                </Box>
                <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                  Dodajem u ekipu…
                </Box>
              </Box>
            </Box>
            <Box sx={{justifySelf: "end", display: "flex"}}>
              <Spinner size={22} />
            </Box>
            <span />
          </Box>
        ))}
      </Box>
    </ColumnCard>
  );
}

// "Dodaj igrača" (P:207-215): the active players who aren't in the team, found by name or username
function PlayersAddField({team, admin}: {team: TeamOverview; admin: TeamAdmin}) {
  const {list, error, reload} = useAdminPlayers();
  const options = useMemo(
    () => (list ? playerAddOptions(list, [...team.players.map((p) => p.id), ...admin.pending.map((p) => p.id)]) : []),
    [list, team.players, admin.pending]
  );
  return (
    <>
      <SearchAddField
        placeholder="Dodaj igrača · ime ili korisničko ime"
        icon={<PersonAddRoundedIcon aria-hidden />}
        options={options}
        onAdd={(o) => {
          const row = list?.find((p) => p.id === o.id);
          if (row) admin.addPlayer(row);
        }}
        note="Igrač mora imati račun da bi ga se dodalo."
        noHit="Nema takvog igrača."
      />
      {error && !list && <AddError onRetry={reload}>{error}</AddError>}
      {admin.playersError && <AddError>{admin.playersError}</AddError>}
    </>
  );
}

// "Dodaj u ligu" (P:236-244): the leagues the team isn't in. No switch and no remove here (Upravljanje ligom).
function LeaguesAddField({team, admin}: {team: TeamOverview; admin: TeamAdmin}) {
  const {leagues, error} = useLeagueList();
  const options = useMemo(
    () => (leagues ? leagueAddOptions(leagues, team.leagues.map((l) => l.league_id), leagueDateString()) : []),
    [leagues, team.leagues]
  );
  return (
    <>
      <SearchAddField
        placeholder="Dodaj u ligu · ime lige"
        icon={<AddCircleRoundedIcon aria-hidden />}
        options={options}
        onAdd={(o) => {
          const league = leagues?.find((l) => l.id === o.id);
          if (league) admin.addLeague(league);
        }}
        // a team in every league: the field has nothing to offer, and says why
        note={leagues && options.length === 0 ? "Ekipa je već u svim ligama." : undefined}
        noHit="Nema druge lige s tim imenom."
      />
      {error && !leagues && <AddError onRetry={reloadLeagues}>Lige se nisu učitale.</AddError>}
      {admin.leaguesError && <AddError>{admin.leaguesError}</AddError>}
    </>
  );
}

function DesktopLeagues({team, admin, empty}: {team: TeamOverview; admin: TeamAdmin | null; empty: string}) {
  return (
    <ColumnCard
      title="Lige"
      addField={admin && <LeaguesAddField team={team} admin={admin} />}
      header={
        <ColumnHead grid={GRID.leagues}>
          <span>#</span>
          <span>Liga</span>
          <Box component="span" sx={rightLabel}>
            Bod
          </Box>
          <span />
        </ColumnHead>
      }
      empty={team.leagues.length === 0 && <EmptyState icon>{empty}</EmptyState>}
    >
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0}}>
        {team.leagues.map((l) => (
          <Box component="li" key={l.league_id}>
            <Box
              component={TransitionLink}
              href={leagueHref(l, team.team.id)}
              sx={{
                ...buttonBase,
                minHeight: 68,
                boxSizing: "border-box",
                display: "grid",
                gridTemplateColumns: GRID.leagues,
                gap: "12px",
                alignItems: "center",
                p: "10px 16px 10px 20px",
                borderBottom: `1px solid ${color.divider}`,
                textDecoration: "none",
                textAlign: "left",
                color: color.ink,
                transition: "background 150ms ease",
                "&:hover": {background: color.paper2},
                "&:focus-visible": rowFocus,
              }}
            >
              <RankBadge rank={l.rank} medal hash size={34} />
              <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
                {/* league names differ at their end: they wrap instead of being cut */}
                <Box component="span" sx={{fontSize: 15, fontWeight: 700, lineHeight: 1.25, color: color.ink, overflowWrap: "anywhere"}}>
                  {l.league_name}
                </Box>
                <LeagueStatus league={l} />
              </Box>
              <Box component="span" sx={{textAlign: "right", fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.ink, ...tabular}}>
                {l.points ?? "–"}
              </Box>
              <RowChevron />
            </Box>
          </Box>
        ))}
      </Box>
    </ColumnCard>
  );
}

function DesktopNights({nights, empty}: {nights: TeamNight[]; empty: string}) {
  return (
    <ColumnCard
      title="Zadnje večeri"
      header={
        <ColumnHead grid={GRID.nights}>
          <span>Datum</span>
          <span>Liga · rezultat</span>
          <Box component="span" sx={rightLabel}>
            Raz
          </Box>
        </ColumnHead>
      }
      empty={nights.length === 0 && <EmptyState icon>{empty}</EmptyState>}
    >
      <Box component="ol" sx={{listStyle: "none", m: 0, p: 0}}>
        {nights.map((n) => (
          <Box
            component="li"
            key={`${n.date}|${n.league_id}`}
            sx={{minHeight: 62, boxSizing: "border-box", display: "grid", gridTemplateColumns: GRID.nights, gap: "12px", alignItems: "center", p: "8px 20px", borderBottom: `1px solid ${color.divider}`}}
          >
            <NightCells night={n} desktop />
          </Box>
        ))}
      </Box>
    </ColumnCard>
  );
}
