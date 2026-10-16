"use client";

import {getLeagueSponsorsAPI, setLeagueSponsorsAPI} from "@/app/_fetchers/sponsors";
import {forgetLeagueSponsors, useAdminSponsors} from "@/app/_hooks/useSponsors";
import {SponsorAdmin} from "@/app/_interfaces/sponsor";
import {countsLabel, pickSub, sponsorSub} from "@/app/_lib/ui/sponsors";
import {count, NOUN} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, Card, ellipsis, ErrorNote, LoadingRows, NARROW_DESKTOP, SectionLabel, SolidButton} from "@/app/_ui/sp";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {Box} from "@mui/material";
import {useCallback, useEffect, useMemo, useState} from "react";
import {CheckBox, DashedAction, DragHandle, listCardSx, SponsorEmpty, useDragOrder} from "./AdminSponsorParts";
import {SponsorLogo} from "./SponsorParts";

// A league's sponsors for Upravljanje ligom · Sponzori: the ones it shows, in their order, picked from the admin's
// list. Every change is saved at once (optimistic; it goes back if the server refuses).
function useLeagueSponsorEdit(leagueId: number) {
  const all = useAdminSponsors();
  const [order, setOrder] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    getLeagueSponsorsAPI(leagueId)
      .then((list) => setOrder(list.map((s) => s.id)))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Sponzori lige se nisu učitali."));
  }, [leagueId]);
  useEffect(() => {
    setOrder(null);
    load();
  }, [load]);

  const byId = useMemo(() => new Map((all.list ?? []).map((s) => [s.id, s])), [all.list]);
  // the league's sponsors that are still on the list (one deleted meanwhile is left out)
  const chosen = order && all.list ? order.map((id) => byId.get(id)).filter((s): s is SponsorAdmin => s != null) : null;

  const save = async (next: number[]) => {
    const before = order;
    setOrder(next);
    setError(null);
    try {
      await setLeagueSponsorsAPI(leagueId, next);
      forgetLeagueSponsors(leagueId);
      // "Još u:" under the others' names
      all.reload();
    } catch (e) {
      setOrder(before);
      setError(e instanceof Error ? e.message : "Sponzori lige nisu spremljeni.");
    }
  };

  return {
    all: all.list,
    chosen,
    error,
    loadError: loadError ?? (all.error && !all.list ? all.error : null),
    retry: () => {
      load();
      all.reload();
    },
    save,
    remove: (id: number) => order && save(order.filter((x) => x !== id)),
    toggle: (id: number) => order && save(order.includes(id) ? order.filter((x) => x !== id) : [...order, id]),
  };
}

// ---------- phone (S5–S8) ----------

// The fifth tab of Upravljanje ligom on the admin's phone
export function LeagueSponsorsPhone({leagueId, leagueName}: {leagueId: number; leagueName: string}) {
  const e = useLeagueSponsorEdit(leagueId);
  const [picking, setPicking] = useState(false);
  const drag = useDragOrder(e.chosen ?? [], (next) => e.save(next.map((s) => s.id)));

  if (e.loadError) return <ErrorNote onRetry={e.retry}>{e.loadError}</ErrorNote>;
  if (!e.chosen || !e.all)
    return (
      <Box sx={listCardSx}>
        <LoadingRows rows={5} height={64} />
      </Box>
    );

  return (
    <>
      {e.chosen.length === 0 ? (
        <Box sx={{...listCardSx, p: "24px 20px 20px"}}>
          <SponsorEmpty title="Liga još nema sponzora" text="Odaberi sponzore s popisa. Igrači ih vide na Početnoj, a na računalu su na dnu kola uživo.">
            <SolidButton height={52} onClick={() => setPicking(true)} sx={{fontSize: 16, "& svg": {fontSize: 22}}}>
              <ChecklistRoundedIcon aria-hidden />
              Odaberi sponzore
            </SolidButton>
          </SponsorEmpty>
        </Box>
      ) : (
        <>
          <Box component="p" sx={{m: 0, px: "6px", fontSize: 13, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>
            Sponzori ove lige polako klize na Početnoj igrača i na dnu kola uživo na admin računalu, ovim redoslijedom. Povuci <DragMark /> za
            redoslijed.
          </Box>
          <DashedAction icon={<ChecklistRoundedIcon aria-hidden />} onClick={() => setPicking(true)}>
            Odaberi sponzore
          </DashedAction>
          {e.error && <ErrorNote>{e.error}</ErrorNote>}
          <SectionLabel sx={{pt: "4px"}}>U ligi · {e.chosen.length}</SectionLabel>
          <Box component="ul" aria-label={`Sponzori lige ${leagueName}`} sx={{...listCardSx, listStyle: "none", m: 0, p: 0, overflow: "visible"}}>
            {e.chosen.map((s, i) => (
              <Box
                component="li"
                key={s.id}
                ref={drag.rowRef(i)}
                sx={[{minHeight: 64, display: "flex", alignItems: "center", gap: "8px", p: "8px 6px 8px 4px", borderTop: i ? `1px solid ${color.line}` : "none", borderRadius: i === 0 ? "22px 22px 0 0" : i === e.chosen!.length - 1 ? "0 0 22px 22px" : 0}, drag.rowSx(i) as object]}
              >
                <DragHandle {...drag.handleProps(i, s.name)} />
                <SponsorLogo sponsor={s} height={42} />
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                  <Box sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>{s.name}</Box>
                  <Box sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>{countsLabel(s.league_counts[leagueId])}</Box>
                </Box>
                <RemoveButton name={s.name} onClick={() => e.remove(s.id)} />
              </Box>
            ))}
          </Box>
        </>
      )}
      {picking && <PickSheet leagueId={leagueId} leagueName={leagueName} all={e.all} chosen={e.chosen.map((s) => s.id)} onClose={() => setPicking(false)} onSave={(ids) => e.save(ids)} />}
    </>
  );
}

// the drag handle's dots, inside a line of text
function DragMark() {
  return <DragIndicatorRoundedIcon aria-label="ručku" sx={{fontSize: 16, verticalAlign: "-3px", color: color.muted}} />;
}

function RemoveButton({name, onClick}: {name: string; onClick: () => void}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={`Makni ${name} iz lige`}
      title="Makni iz lige"
      onClick={onClick}
      sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "12px", color: color.ink2, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: tint.red[8], color: color.red}}}
    >
      <CloseRoundedIcon />
    </Box>
  );
}

// "Sponzori lige": every sponsor with a tick; the new ones go to the end of the league's order (S6, S8)
function PickSheet({
  leagueId,
  leagueName,
  all,
  chosen,
  onClose,
  onSave,
}: {
  leagueId: number;
  leagueName: string;
  all: SponsorAdmin[];
  chosen: number[];
  onClose: () => void;
  onSave: (ids: number[]) => Promise<void> | void;
}) {
  const [ticked, setTicked] = useState(() => new Set(chosen));
  const [saving, setSaving] = useState(false);
  const flip = (id: number) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const save = async () => {
    setSaving(true);
    // the league's order stays; the newly ticked ones follow in the list's order
    await onSave([...chosen.filter((id) => ticked.has(id)), ...all.filter((s) => ticked.has(s.id) && !chosen.includes(s.id)).map((s) => s.id)]);
    setSaving(false);
    onClose();
  };
  return (
    <BottomSheet open onClose={onClose} title="Sponzori lige" closable busy={saving}>
      <Box component="p" sx={{flex: "none", m: 0, fontSize: 14, lineHeight: 1.45, color: color.muted}}>
        Označi sponzore koji se prikazuju u ligi {leagueName}. Novi se dodaju na kraj popisa.
      </Box>
      {all.length === 0 ? (
        <Box sx={{p: "16px", borderRadius: "16px", background: color.paper2, fontSize: 15, color: color.muted}}>Na popisu još nema sponzora.</Box>
      ) : (
        <Box component="ul" aria-label="Svi sponzori" sx={{flex: "none", listStyle: "none", m: 0, p: 0, borderRadius: "18px", background: color.paper2, overflow: "hidden"}}>
          {all.map((s, i) => {
            const on = ticked.has(s.id);
            return (
              <Box component="li" key={s.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                <Box
                  component="button"
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => flip(s.id)}
                  sx={{...buttonBase, width: "100%", minHeight: 58, display: "flex", alignItems: "center", gap: "12px", p: "6px 14px", textAlign: "left", color: color.ink}}
                >
                  <CheckBox on={on} />
                  <SponsorLogo sponsor={s} height={40} />
                  <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                    <Box component="span" sx={{fontSize: 15.5, fontWeight: 600, ...ellipsis}}>
                      {s.name}
                    </Box>
                    <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                      {pickSub(s, leagueId)}
                    </Box>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "10px", p: "12px 14px", borderRadius: "16px", background: color.paper, "& > svg": {fontSize: 22, color: color.muted, flex: "none"}}}>
        <InfoOutlinedIcon aria-hidden />
        <Box sx={{fontSize: 14, lineHeight: 1.4, color: color.ink2}}>Nema ga na popisu? Novog sponzora dodaj na kartici Sponzori u donjem izborniku.</Box>
      </Box>
      <SolidButton onClick={save} loading={saving} sx={{flex: "none", fontSize: 16}}>
        Spremi · {count(ticked.size, NOUN.sponzor)}
      </SolidButton>
    </BottomSheet>
  );
}

// ---------- computer (D7, D8) ----------

// The sixth tab of Upravljanje ligom on the computer: the league's sponsors on the left (drag to order, × takes one
// out), every sponsor with a tick on the right (a tick adds or takes out at once)
export function LeagueSponsorsDesktop({leagueId, leagueName}: {leagueId: number; leagueName: string}) {
  const e = useLeagueSponsorEdit(leagueId);
  const drag = useDragOrder(e.chosen ?? [], (next) => e.save(next.map((s) => s.id)));
  const chosenIds = new Set((e.chosen ?? []).map((s) => s.id));

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,.85fr)", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)"}, gap: "20px"}}>
      <Card component="section" aria-label={`Sponzori lige ${leagueName}`} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", p: "18px 20px 12px", display: "flex", flexDirection: "column", gap: "4px"}}>
          <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px"}}>
            <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
              Sponzori lige
            </Box>
            {e.chosen && e.chosen.length > 0 && <Box sx={{fontSize: 13, color: color.muted}}>{e.chosen.length} u ligi</Box>}
          </Box>
          {e.chosen && e.chosen.length > 0 && (
            <Box sx={{fontSize: 13, color: color.muted}}>
              Ovim redoslijedom klize na Početnoj igrača i na dnu kola uživo. Povuci <DragMark /> za redoslijed.
            </Box>
          )}
        </Box>
        {e.error && <ErrorNote sx={{m: "0 14px 10px"}}>{e.error}</ErrorNote>}
        {e.loadError ? (
          <ErrorNote onRetry={e.retry} sx={{m: "0 14px 14px"}}>
            {e.loadError}
          </ErrorNote>
        ) : !e.chosen ? (
          <LoadingRows rows={6} height={64} />
        ) : e.chosen.length === 0 ? (
          <SponsorEmpty title="Liga još nema sponzora" text="Označi sponzore desno. Igrači ih vide na Početnoj, a na računalu su na dnu kola uživo." sx={{flex: 1, justifyContent: "center", p: "24px"}} />
        ) : (
          <Box component="ul" sx={{flex: 1, minHeight: 0, overflowY: "auto", listStyle: "none", m: 0, p: 0, borderTop: `1px solid ${color.line}`}}>
            {e.chosen.map((s, i) => (
              <Box
                component="li"
                key={s.id}
                ref={drag.rowRef(i)}
                sx={[{minHeight: 64, display: "flex", alignItems: "center", gap: "12px", p: "8px 12px 8px 8px", borderBottom: `1px solid ${color.divider}`, background: color.white}, drag.rowSx(i) as object]}
              >
                <DragHandle {...drag.handleProps(i, s.name)} />
                <Box sx={{width: 92, flex: "none", display: "flex"}}>
                  <SponsorLogo sponsor={s} height={40} />
                </Box>
                <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                  <Box sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>{s.name}</Box>
                  <Box sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>{sponsorSub(s)}</Box>
                </Box>
                <Box sx={{flex: "none", fontSize: 13, color: color.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"}}>{countsLabel(s.league_counts[leagueId], true)}</Box>
                <RemoveButton name={s.name} onClick={() => e.remove(s.id)} />
              </Box>
            ))}
          </Box>
        )}
      </Card>

      <Card component="section" aria-label="Odaberi sponzore" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box sx={{flex: "none", p: "18px 20px 12px", display: "flex", flexDirection: "column", gap: "4px"}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
            Odaberi sponzore
          </Box>
          <Box sx={{fontSize: 13, color: color.muted}}>Označeni se prikazuju u ligi {leagueName}. Novi idu na kraj popisa.</Box>
        </Box>
        {!e.all ? (
          <LoadingRows rows={6} height={58} />
        ) : (
          <Box component="ul" sx={{flex: 1, minHeight: 0, overflowY: "auto", listStyle: "none", m: 0, p: 0, borderTop: `1px solid ${color.line}`}}>
            {e.all.map((s) => {
              const on = chosenIds.has(s.id);
              return (
                <Box component="li" key={s.id} sx={{borderBottom: `1px solid ${color.divider}`}}>
                  <Box
                    component="button"
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!e.chosen}
                    onClick={() => e.toggle(s.id)}
                    sx={{...buttonBase, width: "100%", minHeight: 58, display: "flex", alignItems: "center", gap: "12px", p: "6px 20px", textAlign: "left", color: color.ink, "&:hover": {background: color.paper2}}}
                  >
                    <CheckBox on={on} />
                    <SponsorLogo sponsor={s} height={36} />
                    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
                      <Box component="span" sx={{fontSize: 14.5, fontWeight: 600, ...ellipsis}}>
                        {s.name}
                      </Box>
                      <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                        {pickSub(s, leagueId)}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        <Box sx={{flex: "none", m: "12px 14px 14px", p: "10px 10px 10px 14px", borderRadius: "16px", background: color.paper, display: "flex", alignItems: "center", gap: "10px", "& > svg": {fontSize: 20, color: color.muted, flex: "none"}}}>
          <InfoOutlinedIcon aria-hidden />
          <Box sx={{flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, color: color.ink2}}>Nema ga na popisu? Novog sponzora dodaj na stranici Sponzori u izborniku.</Box>
          <Box
            component={TransitionLink}
            href="/sponzori"
            sx={{...buttonBase, flex: "none", height: 38, display: "flex", alignItems: "center", gap: "6px", px: "12px", borderRadius: "12px", background: color.white, color: color.navy, fontSize: 13.5, fontWeight: 600, textDecoration: "none", boxShadow: shadow.pill, "& svg": {fontSize: 18}}}
          >
            <HandshakeRoundedIcon aria-hidden />
            Sponzori
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
