"use client";

import {getAvailabilityAPI, getBurzaPostAPI, publishBurzaPostAPI} from "@/app/_fetchers/burza";
import {invalidateBurza} from "@/app/_hooks/useBurza";
import {invalidateMyBurza} from "@/app/_hooks/useMyBurza";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useLeagues from "@/app/_hooks/useLeagues";
import useMySchedule from "@/app/_hooks/useMySchedule";
import {useMyRating} from "@/app/_hooks/useRatings";
import {BurzaAvailability, BurzaCreateRequest, BurzaKind, BurzaPost} from "@/app/_interfaces/burza";
import {normalizePhone} from "@/app/_lib/phone";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import {Card, CenteredSpinner, DesktopShell, EmptyState, ErrorNote, Screen, TopBar} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useState} from "react";
import {AvailableForm, PartnerForm, PhoneState, Published, SubstituteForm} from "../../ui/BurzaForms";
import {burzaListHref, burzaListLabel} from "../../ui/BurzaParts";

// Novi oglas: /burza/novi/zamjena | partner | dostupan. ?from=home (Početna · Nađi zamjenu) goes back Home;
// &league= and &night= pick the league and night. Moji oglasi · Objavi ponovno, for a substitute ad whose night is
// gone or an availability ad without a phone number: &team=, &with= and &note= fill in the substitute ad again, and
// repost=<id> is the ad, whose phone number (and an availability ad's choices) the form starts from. After
// publishing it shows "Oglas je objavljen".

const FORMS: Record<string, {kind: BurzaKind; title: string; tab: string}> = {
  zamjena: {kind: "SUBSTITUTE", title: "Trebam zamjenu", tab: "zamjene"},
  partner: {kind: "PARTNER", title: "Tražim partnera", tab: "partneri"},
  dostupan: {kind: "AVAILABLE", title: "Dostupan sam", tab: "dostupni"},
};

export default function NewBurzaPost() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const params = useSearchParams();
  const form = FORMS[useParams<{vrsta: string}>().vrsta];
  const fromHome = params.get("from") === "home";
  const preset = {
    league: Number(params.get("league")) || undefined,
    team: Number(params.get("team")) || undefined,
    night: params.get("night") ?? undefined,
    with: Number(params.get("with")) || undefined,
    note: params.get("note") ?? undefined,
  };
  const repostId = Number(params.get("repost")) || null;

  const user = useAuthStore((s) => s.user);
  const {schedule, error: scheduleError, reload: reloadSchedule} = useMySchedule();
  const leagues = useLeagues();
  const {me} = useMyRating();
  const [availability, setAvailability] = useState<BurzaAvailability | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phone, setPhone] = useState<PhoneState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<{post: BurzaPost; savedPhone: boolean} | null>(null);
  // the player's ad being published again (repost=); undefined while it loads, null without one
  const [repostAd, setRepostAd] = useState<BurzaPost | null | undefined>(repostId ? undefined : null);

  const loadAvailability = useCallback(() => {
    setLoadError(null);
    getAvailabilityAPI()
      .then(setAvailability)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Podaci se nisu učitali."));
  }, []);
  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);
  useEffect(() => {
    if (!repostId) return;
    // without it the form starts as a new one
    getBurzaPostAPI(repostId)
      .then((p) => setRepostAd(p?.mine ? p : null))
      .catch(() => setRepostAd(null));
  }, [repostId]);
  // the ad's number or the profile's is filled in, and saving a new one is offered (but not over the profile's own
  // number when the ad had another)
  useEffect(() => {
    if (!availability || repostAd === undefined) return;
    const own = repostAd?.phone ?? null;
    setPhone((p) => p ?? {value: own ?? availability.phone ?? "", save: !own || !availability.phone || normalizePhone(own) === availability.phone, profile: availability.phone});
  }, [availability, repostAd]);

  const back = () => router.push(fromHome ? "/" : burzaListHref(), "back");
  const publish = async (req: BurzaCreateRequest) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await publishBurzaPostAPI(req);
      invalidateBurza();
      invalidateMyBurza();
      setPublished({post, savedPhone: !!req.save_phone});
      if (req.save_phone && phone) setPhone({...phone, profile: normalizePhone(phone.value)});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oglas nije objavljen.");
    }
    setSubmitting(false);
  };

  // phone: the form scrolls and its button stays at the bottom; desktop: one column with the button after the form
  const layout = (body: React.ReactNode, action?: React.ReactNode) =>
    isDesktop ? (
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
        <Box sx={{maxWidth: 640, display: "flex", flexDirection: "column", gap: "12px", pb: "8px"}}>
          {body}
          {action && <Box sx={{pt: "6px"}}>{action}</Box>}
        </Box>
      </Box>
    ) : (
      <>
        <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "12px", mx: "-20px", px: "20px", pt: "2px", pb: "4px", "& > *": {flexShrink: 0}}}>
          {body}
        </Box>
        {action}
      </>
    );

  let content: React.ReactNode;
  if (!form) {
    content = layout(
      <Card>
        <EmptyState>Ova vrsta oglasa ne postoji.</EmptyState>
      </Card>
    );
  } else if (published) {
    content = (
      <Published
        post={published.post}
        savedPhone={published.savedPhone}
        onDone={() => router.replace(`/burza?tab=${form.tab}`)}
        layout={layout}
      />
    );
  } else if (loadError || (form.kind === "SUBSTITUTE" && scheduleError && !schedule)) {
    content = layout(
      <ErrorNote
        onRetry={() => {
          loadAvailability();
          reloadSchedule();
        }}
      >
        {loadError ?? scheduleError}
      </ErrorNote>
    );
  } else if (!phone || !availability || (form.kind === "SUBSTITUTE" && !schedule)) {
    content = layout(<CenteredSpinner />);
  } else {
    const common = {phone, setPhone, submitting, error, onPublish: publish, layout};
    content =
      form.kind === "SUBSTITUTE" ? (
        <SubstituteForm {...common} leagues={schedule!.leagues} preset={preset} />
      ) : form.kind === "PARTNER" ? (
        <PartnerForm
          {...common}
          leagues={leagues}
          preset={{league: preset.league ?? schedule?.leagues[0]?.league_id}}
          me={{name: me?.name ?? user?.username ?? "", rating: me && me.rounds > 0 ? me.rating : null}}
        />
      ) : (
        <AvailableForm
          {...common}
          initial={availability.available ?? (repostAd?.kind === "AVAILABLE" ? {as_substitute: repostAd.as_substitute, as_partner: repostAd.as_partner, note: repostAd.note} : null)}
        />
      );
  }

  const title = published ? "Objavljeno" : form?.title ?? "Novi oglas";
  if (isDesktop) {
    return (
      <DesktopShell active="burza" back={{label: fromHome ? "Početna" : burzaListLabel(), href: fromHome ? "/" : burzaListHref()}} eyebrow="Novi oglas" title={title}>
        {content}
      </DesktopShell>
    );
  }

  return (
    <Screen fill gap={14}>
      {/* "Oglas je objavljen" has only the way back above it */}
      {published ? <TopBar onBack={back} /> : <TopBar eyebrow="Novi oglas" title={title} onBack={back} />}
      {content}
    </Screen>
  );
}
