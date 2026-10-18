"use client";

import {deleteSponsorAPI} from "@/app/_fetchers/sponsors";
import {forgetLeagueSponsors, useAdminSponsors} from "@/app/_hooks/useSponsors";
import {SponsorAdmin} from "@/app/_interfaces/sponsor";
import {deleteSponsorText, leaguesLabel} from "@/app/_lib/ui/sponsors";
import {color, font} from "@/app/_styles/tokens";
import {
  BottomSheet,
  buttonBase,
  ConfirmSheet,
  ellipsis,
  ErrorNote,
  ErrorState,
  IconCircleButton,
  LoadingRows,
  OutlineButton,
  Screen,
  ScrollArea,
  SectionLabel,
  SolidButton,
} from "@/app/_ui/sp";
import {AdminTabBar} from "@/app/_ui/admin/AdminTabBar";
import AddBusinessOutlinedIcon from "@mui/icons-material/AddBusinessOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import {Box} from "@mui/material";
import {useState} from "react";
import {DashedAction, listCardSx, SponsorEmpty} from "./AdminSponsorParts";
import {SponsorFormFields, useSponsorForm} from "./SponsorForm";
import {SponsorLogo} from "./SponsorParts";

// Sponzori on the admin's phone, the fifth tab of the bottom bar (Claude Design "Sponzori ekrani" K1–K5): the one
// list of sponsors. A sponsor is added, edited and deleted here; each league picks from it in Upravljanje ligom.
export default function SponsorsPhone() {
  const {list, setList, error, reload} = useAdminSponsors();
  // the sheet: a new sponsor, or the one being edited
  const [editing, setEditing] = useState<SponsorAdmin | "new" | null>(null);
  const [asking, setAsking] = useState<SponsorAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const saved = (s: SponsorAdmin) => {
    setList((prev) => {
      const rest = (prev ?? []).filter((x) => x.id !== s.id);
      return [...rest, s].sort((a, b) => a.name.localeCompare(b.name, "hr"));
    });
    setEditing(null);
  };

  const remove = async () => {
    if (!asking) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSponsorAPI(asking.id);
      forgetLeagueSponsors();
      setList((prev) => prev?.filter((x) => x.id !== asking.id) ?? prev);
      setAsking(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Sponzor nije obrisan.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen fill gap={14}>
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}}>
          <Box sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>Admin</Box>
          <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em"}}>
            Sponzori
          </Box>
        </Box>
        <IconCircleButton label="Novi sponzor" onClick={() => setEditing("new")}>
          <AddRoundedIcon />
        </IconCircleButton>
      </Box>

      <ScrollArea bleed sx={{gap: "12px"}}>
        {error && !list ? (
          <ErrorState title="Sponzori se nisu učitali" onRetry={reload} />
        ) : !list ? (
          <Box sx={listCardSx}>
            <LoadingRows rows={6} height={64} />
          </Box>
        ) : list.length === 0 ? (
          <Box sx={{...listCardSx, p: "24px 20px 20px"}}>
            <SponsorEmpty title="Još nema sponzora" text="Dodaj sponzore jednom, pa ih u svakoj ligi samo odabereš.">
              <SolidButton height={52} onClick={() => setEditing("new")} sx={{fontSize: 16, "& svg": {fontSize: 22}}}>
                <AddBusinessOutlinedIcon aria-hidden />
                Dodaj sponzora
              </SolidButton>
            </SponsorEmpty>
          </Box>
        ) : (
          <>
            <Box component="p" sx={{m: 0, px: "6px", fontSize: 13, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>
              Popis svih sponzora. Koji se prikazuju u pojedinoj ligi biraš u Upravljanju ligom na kartici Sponzori.
            </Box>
            <DashedAction icon={<AddBusinessOutlinedIcon aria-hidden />} onClick={() => setEditing("new")}>
              Dodaj sponzora
            </DashedAction>
            <SectionLabel sx={{pt: "4px"}}>Svi sponzori · {list.length}</SectionLabel>
            <Box component="ul" aria-label="Svi sponzori" sx={{...listCardSx, listStyle: "none", m: 0, p: 0}}>
              {list.map((s, i) => (
                <Box component="li" key={s.id} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setEditing(s)}
                    sx={{...buttonBase, width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: "12px", p: "10px 10px 10px 14px", textAlign: "left", color: color.ink, "&:active": {background: color.paper2}}}
                  >
                    <SponsorLogo sponsor={s} height={44} slot />
                    <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                      <Box component="span" sx={{fontSize: 16, fontWeight: 600, ...ellipsis}}>
                        {s.name}
                      </Box>
                      <Box component="span" sx={{fontSize: 12.5, color: color.muted, ...ellipsis}}>
                        {leaguesLabel(s.leagues)}
                      </Box>
                    </Box>
                    <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy}} />
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </ScrollArea>

      {editing && (
        <SponsorSheet
          key={editing === "new" ? "new" : editing.id}
          sponsor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onDelete={(s) => {
            setEditing(null);
            setDeleteError(null);
            setAsking(s);
          }}
        />
      )}
      <ConfirmSheet
        open={asking != null}
        onClose={() => setAsking(null)}
        onConfirm={remove}
        title="Obrisati sponzora?"
        text={asking ? deleteSponsorText(asking.name, asking.leagues) : ""}
        action="Obriši"
        icon={<DeleteRoundedIcon />}
        busy={deleting}
        error={deleteError}
      />
      <AdminTabBar active="sponzori" />
    </Screen>
  );
}

// Novi sponzor / Uredi sponzora (K2, K4)
function SponsorSheet({sponsor, onClose, onSaved, onDelete}: {sponsor: SponsorAdmin | null; onClose: () => void; onSaved: (s: SponsorAdmin) => void; onDelete: (s: SponsorAdmin) => void}) {
  const form = useSponsorForm(sponsor, onSaved);
  return (
    <BottomSheet open onClose={onClose} title={form.isNew ? "Novi sponzor" : "Uredi sponzora"} closable busy={form.saving}>
      <SponsorFormFields form={form} sponsor={sponsor} />
      {form.error && <ErrorNote>{form.error}</ErrorNote>}
      <Box sx={{flex: "none", display: "flex", gap: "10px"}}>
        {sponsor ? (
          <Box
            component="button"
            type="button"
            aria-label="Obriši sponzora"
            onClick={() => onDelete(sponsor)}
            sx={{...buttonBase, width: 56, height: 56, flex: "none", borderRadius: "16px", border: `1.5px solid ${color.red}`, color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 24}}}
          >
            <DeleteRoundedIcon />
          </Box>
        ) : (
          <OutlineButton onClick={onClose} sx={{flex: 1, fontSize: 16, border: `1.5px solid ${color.borderControl}`}}>
            Odustani
          </OutlineButton>
        )}
        <SolidButton onClick={form.save} disabled={!form.ok} loading={form.saving} sx={{flex: 1, fontSize: 16}}>
          {form.isNew ? "Dodaj" : "Spremi"}
        </SolidButton>
      </Box>
    </BottomSheet>
  );
}
