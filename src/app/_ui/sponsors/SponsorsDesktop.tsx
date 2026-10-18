"use client";

import {deleteSponsorAPI} from "@/app/_fetchers/sponsors";
import {forgetLeagueSponsors, useAdminSponsors} from "@/app/_hooks/useSponsors";
import {SponsorAdmin} from "@/app/_interfaces/sponsor";
import {deleteSponsorText, groupDigits, leaguesLabel, sponsorSub} from "@/app/_lib/ui/sponsors";
import {count, NOUN} from "@/app/_lib/ui/text";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, DesktopShell, ellipsis, ErrorNote, LoadingRows, NARROW_DESKTOP, OutlineButton, SolidButton, Spinner} from "@/app/_ui/sp";
import AddBusinessOutlinedIcon from "@mui/icons-material/AddBusinessOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import {Box, Dialog} from "@mui/material";
import {useEffect, useId, useState} from "react";
import {SponsorEmpty} from "./AdminSponsorParts";
import {SponsorFormFields, useSponsorForm} from "./SponsorForm";
import {SponsorLogo} from "./SponsorParts";

const GRID = {gridTemplateColumns: "92px minmax(0,1.3fr) minmax(0,1fr) 84px 96px 28px", [NARROW_DESKTOP]: {gridTemplateColumns: "84px minmax(0,1.2fr) minmax(0,1fr) 72px 84px 24px"}} as const;

// Sponzori on the computer, under Admin in the menu (Claude Design "Sponzori ekrani" D3–D6): every sponsor with its
// leagues and counts on the left, the chosen one (or a new one) edited on the right
export default function SponsorsDesktop() {
  const {list, setList, error, reload} = useAdminSponsors();
  // the sponsor on the right: an id, a new one, or none yet (the first of the list once it loads)
  const [picked, setPicked] = useState<number | "new" | null>(null);
  const [asking, setAsking] = useState<SponsorAdmin | null>(null);
  useEffect(() => {
    if (picked == null && list?.length) setPicked(list[0].id);
  }, [list, picked]);
  const current = typeof picked === "number" ? list?.find((s) => s.id === picked) ?? null : null;

  const saved = (s: SponsorAdmin) => {
    setList((prev) => [...(prev ?? []).filter((x) => x.id !== s.id), s].sort((a, b) => a.name.localeCompare(b.name, "hr")));
    setPicked(s.id);
  };
  const deleted = (id: number) => {
    const rest = (list ?? []).filter((x) => x.id !== id);
    setList(rest);
    setPicked(rest[0]?.id ?? null);
    setAsking(null);
  };

  return (
    <DesktopShell
      active="sponsors"
      eyebrow="Admin"
      title="Sponzori"
      right={
        <SolidButton height={52} onClick={() => setPicked("new")} sx={{px: "20px", fontSize: 15, boxShadow: shadow.action, "& svg": {fontSize: 22}}}>
          <AddBusinessOutlinedIcon aria-hidden />
          Dodaj sponzora
        </SolidButton>
      }
    >
      <Box component="p" sx={{flex: "none", m: "-8px 0 0", maxWidth: 760, fontSize: 14, lineHeight: 1.5, color: color.ink2}}>
        Popis svih sponzora. Koji se prikazuju u pojedinoj ligi biraš u Upravljanju ligom na kartici Sponzori. Promjena loga, linka ili poruke vrijedi u svim
        ligama.
      </Box>
      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", [NARROW_DESKTOP]: {gridTemplateColumns: "minmax(0,1fr) 360px"}, gap: "20px"}}>
        <Card component="section" aria-label="Svi sponzori" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", p: "18px 20px 14px"}}>
            <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
              Svi sponzori
            </Box>
            {list && list.length > 0 && <Box sx={{fontSize: 13, color: color.muted}}>{count(list.length, NOUN.sponzor)}</Box>}
          </Box>
          {error && !list ? (
            <ErrorNote onRetry={reload} sx={{m: "0 14px 14px"}}>
              {error}
            </ErrorNote>
          ) : !list ? (
            <LoadingRows rows={7} height={64} />
          ) : list.length === 0 ? (
            <SponsorEmpty title="Još nema sponzora" text="Dodaj sponzore jednom, pa ih u svakoj ligi samo odabereš." sx={{flex: 1, justifyContent: "center", p: "24px"}} />
          ) : (
            <>
              <Box
                aria-hidden
                sx={{flex: "none", height: 40, display: "grid", ...GRID, gap: "12px", alignItems: "center", px: "20px", background: color.paper2, borderTop: `1px solid ${tint.navy[10]}`, borderBottom: `1px solid ${tint.navy[10]}`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
              >
                <span>Logo</span>
                <span>Sponzor</span>
                <span>Lige</span>
                <Box component="span" sx={{textAlign: "right"}}>
                  Prikazi
                </Box>
                <Box component="span" sx={{textAlign: "right"}}>
                  Otvaranja
                </Box>
                <span />
              </Box>
              <Box component="ul" sx={{flex: 1, minHeight: 0, overflowY: "auto", listStyle: "none", m: 0, p: 0}}>
                {list.map((s) => {
                  const on = s.id === picked;
                  return (
                    <Box component="li" key={s.id} sx={{borderBottom: `1px solid ${color.divider}`}}>
                      <Box
                        component="button"
                        type="button"
                        aria-current={on || undefined}
                        onClick={() => setPicked(s.id)}
                        sx={{
                          ...buttonBase,
                          width: "100%",
                          minHeight: 68,
                          display: "grid",
                          ...GRID,
                          gap: "12px",
                          alignItems: "center",
                          px: "20px",
                          textAlign: "left",
                          color: color.ink,
                          background: on ? color.paper : "transparent",
                          boxShadow: on ? shadow.mineBar : "none",
                          "&:hover": {background: on ? color.paper : color.paper2},
                        }}
                      >
                        <Box sx={{display: "flex"}}>
                          <SponsorLogo sponsor={s} height={40} slot />
                        </Box>
                        <Box component="span" sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                          <Box component="span" sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
                            {s.name}
                          </Box>
                          <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                            {sponsorSub(s)}
                          </Box>
                        </Box>
                        <Box component="span" sx={{fontSize: 13.5, color: s.leagues.length ? color.ink2 : color.faint, ...ellipsis}}>
                          {leaguesLabel(s.leagues, ", ")}
                        </Box>
                        <Box component="span" sx={{textAlign: "right", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums"}}>
                          {groupDigits(s.views)}
                        </Box>
                        <Box component="span" sx={{textAlign: "right", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums"}}>
                          {groupDigits(s.clicks)}
                        </Box>
                        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 22, color: color.faint}} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Card>

        <Card component="section" aria-label={picked === "new" ? "Novi sponzor" : "Uredi sponzora"} sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
          {picked === "new" || current ? (
            <SponsorPanel key={picked === "new" ? "new" : current!.id} sponsor={picked === "new" ? null : current} onSaved={saved} onCancel={() => setPicked(list?.[0]?.id ?? null)} onDelete={setAsking} />
          ) : (
            <Box sx={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", p: "24px", color: color.faint, textAlign: "center", "& svg": {fontSize: 30}}}>
              <EditNoteRoundedIcon aria-hidden />
              <Box sx={{fontSize: 14, color: color.muted}}>Odaberi sponzora s popisa ili dodaj novog.</Box>
            </Box>
          )}
        </Card>
      </Box>
      {asking && <DeleteDialog sponsor={asking} onClose={() => setAsking(null)} onDeleted={() => deleted(asking.id)} />}
    </DesktopShell>
  );
}

// Uredi sponzora / Novi sponzor on the right (D3, D4)
function SponsorPanel({sponsor, onSaved, onCancel, onDelete}: {sponsor: SponsorAdmin | null; onSaved: (s: SponsorAdmin) => void; onCancel: () => void; onDelete: (s: SponsorAdmin) => void}) {
  const form = useSponsorForm(sponsor, onSaved);
  return (
    <>
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", p: "18px 20px 8px", display: "flex", flexDirection: "column", gap: "14px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box sx={{fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>{sponsor ? "Uredi sponzora" : "Novi sponzor"}</Box>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", ...ellipsis}}>
            {sponsor ? sponsor.name : "Novi sponzor"}
          </Box>
        </Box>
        <SponsorFormFields form={form} sponsor={sponsor} />
      </Box>
      <Box sx={{flex: "none", p: "12px 20px 20px", display: "flex", flexDirection: "column", gap: "10px", borderTop: `1px solid ${color.line}`}}>
        {form.error && <ErrorNote>{form.error}</ErrorNote>}
        <Box sx={{display: "flex", gap: "10px"}}>
          {sponsor ? (
            <>
              <Box
                component="button"
                type="button"
                aria-label="Obriši sponzora"
                title="Obriši sponzora"
                onClick={() => onDelete(sponsor)}
                sx={{...buttonBase, width: 52, height: 52, flex: "none", borderRadius: "14px", border: `1.5px solid ${tint.red[35]}`, color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}, "&:hover": {background: tint.red[8]}}}
              >
                <DeleteRoundedIcon />
              </Box>
              <OutlineButton height={52} onClick={form.reset} disabled={!form.dirty || form.saving} sx={{flex: 1, fontSize: 15, border: `1.5px solid ${color.borderControl}`}}>
                Odbaci promjene
              </OutlineButton>
            </>
          ) : (
            <OutlineButton height={52} onClick={onCancel} sx={{flex: 1, fontSize: 15, border: `1.5px solid ${color.borderControl}`}}>
              Odustani
            </OutlineButton>
          )}
          <SolidButton height={52} onClick={form.save} disabled={!form.ok} loading={form.saving} sx={{flex: 1, fontSize: 15}}>
            {sponsor ? "Spremi" : "Dodaj sponzora"}
          </SolidButton>
        </Box>
      </Box>
    </>
  );
}

// "Obrisati sponzora?" (D5)
function DeleteDialog({sponsor, onClose, onDeleted}: {sponsor: SponsorAdmin; onClose: () => void; onDeleted: () => void}) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteSponsorAPI(sponsor.id);
      forgetLeagueSponsors();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sponzor nije obrisan.");
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      aria-labelledby={titleId}
      slotProps={{backdrop: {sx: {background: tint.scrim[32]}}}}
      PaperProps={{sx: {width: 500, maxWidth: "calc(100% - 32px)", borderRadius: "24px", p: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: shadow.dialog}}}
    >
      <Box component="h2" id={titleId} sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.01em"}}>
        Obrisati sponzora?
      </Box>
      <Box sx={{display: "flex", gap: "12px", alignItems: "flex-start", p: "14px", borderRadius: "16px", background: tint.red[8], "& > svg": {fontSize: 24, color: color.red, flex: "none"}}}>
        <DeleteRoundedIcon aria-hidden />
        <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.5, color: color.ink, textWrap: "pretty"}}>
          {deleteSponsorText(sponsor.name, sponsor.leagues)}
        </Box>
      </Box>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
        <OutlineButton height={52} onClick={onClose} disabled={busy} sx={{fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
          Odustani
        </OutlineButton>
        <Box
          component="button"
          type="button"
          onClick={confirm}
          disabled={busy}
          aria-busy={busy || undefined}
          sx={{...buttonBase, height: 52, borderRadius: "16px", background: color.red, color: color.white, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"}}
        >
          {busy && <Spinner size={18} tone="white" />}
          Obriši
        </Box>
      </Box>
    </Dialog>
  );
}
