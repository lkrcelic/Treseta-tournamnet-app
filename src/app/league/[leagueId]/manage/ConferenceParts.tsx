"use client";

import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {Conference, distributeEvenly} from "@/app/_lib/conferences";
import {plural} from "@/app/_lib/ui/text";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, Card, ellipsis, ErrorNote, OutlineButton, SolidButton, TeamDot} from "@/app/_ui/sp";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import {Box, Popover} from "@mui/material";
import {useRef, useState} from "react";

// A team's conference in Manage League · Teams: a chip "● Sjever ▾" (or "Bez konferencije") under the team's name,
// opening the league's conferences in a menu (desktop) or a sheet (phone)
export function ConferencePicker({
  teamName,
  value,
  conferences,
  onPick,
}: {
  teamName: string;
  value: number | null;
  conferences: Conference[];
  onPick: (conferenceId: number | null) => void;
}) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const current = conferences.find((c) => c.id === value) ?? null;
  const options = [...conferences, {id: null, name: "Bez konferencije", color: null}];
  const choose = (id: number | null) => {
    setOpen(false);
    if (id !== (current?.id ?? null)) onPick(id);
  };

  const list = (
    <Box role="listbox" aria-label={`Konferencija: ${teamName}`} sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
      {options.map((o) => {
        const on = o.id === (current?.id ?? null);
        return (
          <Box
            key={o.id ?? "none"}
            component="button"
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => choose(o.id)}
            sx={{
              ...buttonBase,
              minHeight: 48,
              borderRadius: "12px",
              background: on ? color.paper : "transparent",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              px: "12px",
              textAlign: "left",
              fontSize: 15,
              fontWeight: 600,
              color: o.id == null ? color.muted : color.ink,
              "&:hover": {background: color.paper},
            }}
          >
            <TeamDot color={o.color} size={10} />
            <Box component="span" sx={{flex: 1, ...ellipsis}}>
              {o.name}
            </Box>
            {on && <CheckRoundedIcon sx={{fontSize: 20, color: color.navy}} />}
          </Box>
        );
      })}
    </Box>
  );

  return (
    <>
      <Box
        component="button"
        ref={anchor}
        type="button"
        aria-haspopup={isDesktop ? "listbox" : "dialog"}
        aria-expanded={open}
        aria-label={`${teamName}: ${current ? `konferencija ${current.name}` : "bez konferencije"}. Promijeni konferenciju`}
        onClick={() => setOpen(true)}
        sx={{
          ...buttonBase,
          alignSelf: "flex-start",
          maxWidth: "100%",
          height: 30,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          pl: "10px",
          pr: "4px",
          borderRadius: "15px",
          border: `1px solid ${current ? tint.navy[12] : tint.red[35]}`,
          background: color.white,
          fontSize: 13,
          fontWeight: 600,
          color: current ? color.ink : color.red,
          "&:hover": {background: color.paper},
        }}
      >
        <TeamDot color={current?.color ?? null} />
        <Box component="span" sx={ellipsis}>
          {current?.name ?? "Bez konferencije"}
        </Box>
        <ExpandMoreRoundedIcon sx={{fontSize: 18, flex: "none", color: color.muted}} />
      </Box>
      {isDesktop ? (
        <Popover
          open={open}
          anchorEl={anchor.current}
          onClose={() => setOpen(false)}
          anchorOrigin={{vertical: "bottom", horizontal: "left"}}
          transformOrigin={{vertical: "top", horizontal: "left"}}
          slotProps={{paper: {sx: {mt: "6px", width: 240, p: "6px", borderRadius: "16px", boxShadow: shadow.popover}}}}
        >
          {list}
        </Popover>
      ) : (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={teamName}>
          {list}
        </BottomSheet>
      )}
    </>
  );
}

// Manage League · Teams: how many teams each conference has, and "Rasporedi ravnomjerno": every team is dealt out in snake
// order of the league table, so the conferences are as big and about as strong as each other. Asked first, since it
// replaces the teams' conferences. order: the league's team ids in table order.
export function DistributeCard({
  conferences,
  teams,
  order,
  onDistribute,
}: {
  conferences: Conference[];
  teams: {id: number; conferenceId: number | null}[];
  order: number[];
  onDistribute: (assignments: {team_id: number; conference_id: number}[]) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counts = conferences.map((c) => ({...c, n: teams.filter((t) => t.conferenceId === c.id).length}));
  const unassigned = teams.filter((t) => !conferences.some((c) => c.id === t.conferenceId)).length;
  const plan = distributeEvenly(order, conferences.map((c) => c.id));

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDistribute(plan);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekipe nisu raspoređene.");
    }
    setBusy(false);
  };

  return (
    <Card component="section" aria-labelledby="conf-teams" sx={{p: "20px", display: "flex", flexDirection: "column", gap: "12px", borderRadius: "24px"}}>
      <Box component="h2" id="conf-teams" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
        Ekipe po konferencijama
      </Box>
      <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column"}}>
        {counts.map((c) => (
          <Box component="li" key={c.id} sx={{minHeight: 40, display: "flex", alignItems: "center", gap: "10px", borderBottom: `1px solid ${color.line}`}}>
            <TeamDot color={c.color} size={10} />
            <Box component="span" sx={{flex: 1, fontSize: 15, fontWeight: 600, ...ellipsis}}>
              {c.name}
            </Box>
            <Box component="span" sx={{fontSize: 15, color: color.ink2, fontVariantNumeric: "tabular-nums"}}>
              {c.n}
            </Box>
          </Box>
        ))}
        {unassigned > 0 && (
          <Box component="li" sx={{minHeight: 40, display: "flex", alignItems: "center", gap: "10px"}}>
            <TeamDot color={null} size={10} />
            <Box component="span" sx={{flex: 1, fontSize: 15, fontWeight: 600, color: color.red}}>
              Bez konferencije
            </Box>
            <Box component="span" sx={{fontSize: 15, fontWeight: 700, color: color.red, fontVariantNumeric: "tabular-nums"}}>
              {unassigned}
            </Box>
          </Box>
        )}
      </Box>
      {confirming ? (
        <Box role="alert" sx={{display: "flex", flexDirection: "column", gap: "10px", p: "12px 14px", borderRadius: "14px", background: color.paper2}}>
          <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.ink}}>
            {plural(teams.length, "Raspoređuje se", "Raspoređuju se", "Raspoređuje se")} {teams.length} {plural(teams.length, "ekipa", "ekipe", "ekipa")} po
            poretku lige:{" "}
            <b>{conferences.map((c) => `${c.name} ${plan.filter((p) => p.conference_id === c.id).length}`).join(" · ")}</b>. Ovo
            zamjenjuje njihove dosadašnje konferencije.
          </Box>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Box sx={{display: "flex", gap: "8px"}}>
            <OutlineButton height={44} onClick={() => setConfirming(false)} disabled={busy} sx={{flex: 1, fontSize: 15, border: `1.5px solid ${tint.navy[25]}`}}>
              Odustani
            </OutlineButton>
            <SolidButton height={44} onClick={go} loading={busy} sx={{flex: 1, fontSize: 15}}>
              Rasporedi
            </SolidButton>
          </Box>
        </Box>
      ) : (
        <OutlineButton height={48} onClick={() => setConfirming(true)} disabled={teams.length === 0} sx={{borderWidth: "1.5px", borderColor: tint.navy[25], fontSize: 15}}>
          <ShuffleRoundedIcon sx={{fontSize: 20}} />
          Rasporedi ravnomjerno
        </OutlineButton>
      )}
    </Card>
  );
}
