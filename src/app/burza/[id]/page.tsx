"use client";

import {closeBurzaPostAPI, getBurzaPostAPI} from "@/app/_fetchers/burza";
import {invalidateBurza} from "@/app/_hooks/useBurza";
import {invalidateMyBurza} from "@/app/_hooks/useMyBurza";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {BurzaPost} from "@/app/_interfaces/burza";
import {telHref, whatsappHref} from "@/app/_lib/phone";
import {busyLine, postContact, postDetails, postHeadline, postTitle, timeAgo} from "@/app/_lib/ui/burza";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, CenteredSpinner, DesktopShell, EmptyState, ErrorNote, IconCircleButton, Screen, SectionLabel, tabular, TopBar} from "@/app/_ui/sp";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import React, {useCallback, useEffect, useState} from "react";
import {AdAvatar, postPhoto, burzaListHref, burzaListLabel, Callout, KindTag, OutlineAction, shareLink, shareText} from "../ui/BurzaParts";

// Oglas (Claude Design "Burza igrača · spojeno", "Oglas · kontakt"): one ad with its details and the number to call.
// Public, so a shared link works for anyone.

export default function BurzaPostPage() {
  const router = useTransitionRouter();
  const isDesktop = useIsDesktop();
  const id = Number(useParams<{id: string}>().id);
  const [post, setPost] = useState<BurzaPost | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getBurzaPostAPI(id)
      .then(setPost)
      .catch((e) => setError(e instanceof Error ? e.message : "Oglas se nije učitao."));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const back = () => router.push(burzaListHref(), "back");
  const share = async () => {
    if (!post) return;
    const outcome = await shareLink(window.location.href, `Burza igrača · ${postTitle(post)}`, shareText(post));
    if (outcome === "copied") setNotice("Poveznica je kopirana.");
  };
  const close = async () => {
    if (!post || closing) return;
    setClosing(true);
    setError(null);
    try {
      setPost(await closeBurzaPostAPI(post.id));
      invalidateBurza();
      invalidateMyBurza();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oglas nije zatvoren.");
    }
    setClosing(false);
  };

  // a closed ad isn't worth sharing
  const shareButton = post?.closed ? undefined : (
    <IconCircleButton label="Podijeli" size={44} onClick={share} disabled={!post} sx={{"& svg": {fontSize: 24}}}>
      <ShareRoundedIcon />
    </IconCircleButton>
  );
  const eyebrow = post ? `Burza · ${timeAgo(post.created_at)}` : "Burza";

  let content: React.ReactNode;
  if (post === undefined) content = error ? <ErrorNote onRetry={load}>{error}</ErrorNote> : <CenteredSpinner />;
  else if (post === null)
    content = (
      <Card>
        <EmptyState>Ovaj oglas ne postoji.</EmptyState>
      </Card>
    );
  else
    content = (
      <PostBody post={post} desktop={isDesktop} closing={closing} onClose={close} notice={notice} error={error} />
    );

  const shareAction = post && !post.closed && (
    <OutlineAction icon={<ShareRoundedIcon />} onClick={share}>
      Javi nekome
    </OutlineAction>
  );

  if (isDesktop) {
    return (
      <DesktopShell active="burza" back={{label: burzaListLabel(), href: burzaListHref()}} eyebrow={eyebrow} title="Oglas" right={shareButton}>
        <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>
          <Box sx={{maxWidth: 640, display: "flex", flexDirection: "column", gap: "14px"}}>
            {content}
            {shareAction}
          </Box>
        </Box>
      </DesktopShell>
    );
  }

  return (
    <Screen fill>
      <TopBar eyebrow={eyebrow} title="Oglas" onBack={back} right={shareButton} />
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: "12px", mx: "-20px", px: "20px", pt: "2px", pb: "4px", "& > *": {flexShrink: 0}}}>
        {content}
      </Box>
      {shareAction}
    </Screen>
  );
}

function PostBody({post, desktop, closing, onClose, notice, error}: {post: BurzaPost; desktop: boolean; closing: boolean; onClose: () => void; notice: string | null; error: string | null}) {
  const details = postDetails(post);
  return (
    <>
      {post.closed && (
        <Callout icon={<InfoOutlinedIcon aria-hidden />} tone="warn">
          {post.mine ? "Oglas je zatvoren. Više se ne vidi u Burzi." : "Ovaj oglas je zatvoren."}
        </Callout>
      )}
      <Box component="section" aria-label="Oglas" sx={{borderRadius: "24px", background: color.cream, p: "18px", display: "flex", flexDirection: "column", gap: "12px", opacity: post.closed ? 0.7 : 1}}>
        <KindTag kind={post.kind} />
        <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
          <AdAvatar name={postTitle(post)} src={postPhoto(post)} size={52} sx={{background: color.white}} />
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: desktop ? 28 : 25, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.01em", textWrap: "pretty", overflowWrap: "anywhere"}}>
            {postHeadline(post)}
          </Box>
        </Box>
      </Box>
      <Card component="dl" sx={{m: 0, overflow: "hidden"}}>
        {details.map((d, i) => (
          <Box key={d.label} sx={{minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", px: "16px", borderBottom: i < details.length - 1 ? `1px solid ${color.line}` : "none"}}>
            <Box component="dt" sx={{flex: "none", fontSize: 15, color: color.muted, whiteSpace: "nowrap"}}>
              {d.label}
            </Box>
            <Box component="dd" sx={{m: 0, flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, textAlign: "right", textWrap: "pretty"}}>
              {d.value}
            </Box>
          </Box>
        ))}
      </Card>
      {post.note && (
        <Card sx={{p: "14px 16px", fontSize: 15, lineHeight: 1.5, color: color.ink, overflowWrap: "anywhere", whiteSpace: "pre-line"}}>“{post.note}”</Card>
      )}
      {post.busy_team && (
        <Callout icon={<EventBusyRoundedIcon aria-hidden />} tone="warn">
          {busyLine(post.busy_team)}, pa ne možeš uskočiti. Možeš podijeliti oglas nekome tko može.
        </Callout>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && (
        <Box role="status" sx={{px: "6px", fontSize: 14, fontWeight: 600, color: color.green}}>
          {notice}
        </Box>
      )}
      {post.phone && (
        <>
          <SectionLabel id="contact">Kontakt</SectionLabel>
          <Card aria-labelledby="contact" sx={{p: "14px 16px", display: "flex", flexDirection: "column", gap: "12px"}}>
            <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
              <Box component="span" sx={{fontSize: 15, color: color.muted}}>
                {post.mine ? "Tvoj oglas" : postContact(post)}
              </Box>
              <Box component="span" sx={{fontSize: 20, fontWeight: 700, letterSpacing: ".01em", ...tabular}}>
                {post.phone}
              </Box>
            </Box>
            {!post.mine && !post.closed && (
              <Box sx={{display: "flex", gap: "10px"}}>
                <ContactLink href={telHref(post.phone)} icon={<CallRoundedIcon />} primary>
                  Nazovi
                </ContactLink>
                <ContactLink href={whatsappHref(post.phone)} icon={<ChatRoundedIcon />} external>
                  WhatsApp
                </ContactLink>
              </Box>
            )}
          </Card>
        </>
      )}
      {post.can_close && (
        <Box
          component="button"
          type="button"
          onClick={onClose}
          disabled={closing}
          aria-busy={closing || undefined}
          sx={{...buttonBase, alignSelf: "center", height: 44, px: "14px", borderRadius: "12px", color: color.red, display: "flex", alignItems: "center", gap: "6px", fontSize: 15, fontWeight: 600, "&:hover": {background: tint.red[8]}, "&:disabled": {opacity: 0.5}, "& svg": {fontSize: 20}}}
        >
          <CancelRoundedIcon aria-hidden />
          {post.mine ? "Zatvori oglas" : "Zatvori oglas (admin)"}
        </Box>
      )}
    </>
  );
}

// Nazovi / WhatsApp: links styled as the design's buttons
function ContactLink({href, icon, primary = false, external = false, children}: {href: string; icon: React.ReactNode; primary?: boolean; external?: boolean; children: React.ReactNode}) {
  return (
    <Box
      component="a"
      href={href}
      {...(external ? {target: "_blank", rel: "noopener noreferrer"} : {})}
      sx={{
        ...buttonBase,
        flex: 1,
        minWidth: 0,
        height: 52,
        borderRadius: "18px",
        border: primary ? "none" : `1.5px solid ${color.borderControl}`,
        background: primary ? color.navy : color.white,
        color: primary ? color.white : color.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        fontSize: 16,
        fontWeight: 600,
        textDecoration: "none",
        boxShadow: primary ? shadow.action : "none",
        boxSizing: "border-box",
        "&:active": {transform: "scale(.98)"},
        "& svg": {fontSize: 24},
      }}
    >
      {icon}
      {children}
    </Box>
  );
}
