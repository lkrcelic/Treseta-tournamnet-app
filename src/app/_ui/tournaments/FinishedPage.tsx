"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import {useTournaments} from "@/app/_hooks/useTournaments";
import {count, NOUN} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font} from "@/app/_styles/tokens";
import {Card, Display, EmptyState, ErrorNote, LoadingRows, StackTopBar, ellipsis} from "@/app/_ui/sp";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import {Box} from "@mui/material";
import React from "react";
import PlayerFrame from "./PlayerFrame";
import {DateTile} from "./TournamentParts";

// Završeni turniri (Claude Design "Natjecanja" N1): every tournament that is over, by year, with its winner and the
// viewer's place where they played; a cancelled one says so
export default function FinishedPage() {
  const {tournaments, error, reload} = useTournaments();
  const nav = useNavStack("Završeni turniri", "/turniri");
  const done = (tournaments ?? []).filter((t) => t.phase === "finished" || t.phase === "cancelled").sort((a, b) => b.date.localeCompare(a.date));
  const played = done.filter((t) => t.my_place != null).length;
  const years = Array.from(new Set(done.map((t) => t.date.slice(0, 4))));
  return (
    <PlayerFrame>
      <StackTopBar eyebrow="Turniri" nav={nav} />
      <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "4px", px: "4px"}}>
        <Display size={30} sx={{lineHeight: 1.05}}>
          Završeni turniri
        </Display>
        {tournaments && done.length > 0 && played > 0 && (
          <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
            Odigrao si {played} od {done.filter((t) => t.phase === "finished").length}
          </Box>
        )}
      </Box>
      {error && !tournaments ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !tournaments ? (
        <Card>
          <LoadingRows rows={5} height={68} />
        </Card>
      ) : done.length === 0 ? (
        <Card>
          <EmptyState>Još nema završenih turnira.</EmptyState>
        </Card>
      ) : (
        years.map((year) => (
          <Box key={year} component="section" aria-label={year} sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
            <Box component="h2" sx={{m: 0, px: "4px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em", color: color.muted}}>
              {year}
            </Box>
            <Card component="ul" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden", borderRadius: "22px"}}>
              {done
                .filter((t) => t.date.startsWith(year))
                .map((t, i) => (
                  <Box component="li" key={t.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                    <Box component={TransitionLink} href={`/turniri/${t.id}`} sx={{minHeight: 72, display: "flex", alignItems: "center", gap: "12px", px: "14px", py: "8px", color: color.ink, textDecoration: "none", "&:active": {background: color.paper2}}}>
                      <DateTile date={t.date} size={44} done />
                      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                        <Box component="span" sx={{fontSize: 16, fontWeight: 700, ...ellipsis}}>
                          {t.name}
                        </Box>
                        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "4px", fontSize: 13, color: t.phase === "cancelled" ? color.red : color.muted, minWidth: 0, "& svg": {fontSize: 16, color: color.medal[0]}}}>
                          {t.phase === "cancelled" ? (
                            "Otkazan"
                          ) : (
                            <>
                              <EmojiEventsRoundedIcon aria-hidden />
                              <Box component="span" sx={ellipsis}>
                                {[t.winner?.team_name, count(t.teams, NOUN.ekipa)].filter(Boolean).join(" · ")}
                              </Box>
                            </>
                          )}
                        </Box>
                      </Box>
                      {t.my_place != null && (
                        <Box component="span" aria-label={`Vaše mjesto: ${t.my_place}.`} sx={{flex: "none", height: 30, px: "10px", display: "flex", alignItems: "center", borderRadius: "10px", background: color.navy, color: color.white, fontFamily: font.display, fontSize: 15, fontWeight: 800}}>
                          #{t.my_place}
                        </Box>
                      )}
                      <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy}} />
                    </Box>
                  </Box>
                ))}
            </Card>
          </Box>
        ))
      )}
    </PlayerFrame>
  );
}
