"use client";

import {MyBurzaPost} from "@/app/_interfaces/burza";
import {expiryLine, MyPostChange, myPostSub, myPostTitle, repostBlocked, STATUS_PILL} from "@/app/_lib/ui/burza";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, radius} from "@/app/_styles/tokens";
import {buttonBase, Card, ErrorNote, Spinner} from "@/app/_ui/sp";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {Box, Skeleton} from "@mui/material";
import {KindTag, narrowPhone} from "./BurzaParts";

// Moji oglasi (Claude Design "Burza igrača · spojeno", 11c): one of the player's ads with its status, the skeleton
// while they load, and the empty state of a tab

const actionSx = {
  ...buttonBase,
  height: 46,
  px: "8px",
  borderRadius: radius.md,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  fontSize: 15,
  fontWeight: 600,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  textDecoration: "none",
  transition: "transform 120ms ease, opacity 160ms ease",
  "&:active:not(:disabled)": {transform: "scale(.98)"},
  "&:disabled": {opacity: 0.5},
  "& svg": {fontSize: 20},
  // two buttons side by side on a 320 px phone: the words keep their room
  [narrowPhone]: {"& svg": {display: "none"}},
} as const;

const outlineSx = {...actionSx, border: `1.5px solid ${color.borderControl}`, background: color.white, color: color.navy} as const;

// where Objavi ponovno would be, for an ad that can't go up again: the reason, as a flat grey pill
const blockedSx = {
  mt: "auto",
  height: 46,
  px: "8px",
  borderRadius: radius.md,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: color.lineFill,
  color: color.muted,
  fontSize: 15,
  fontWeight: 600,
  "& svg": {fontSize: 20},
} as const;

const cardId = (id: number) => `moji-oglas-${id}`;

// The first action of an ad on the page (Pogledaj, or Objavi ponovno), where the keyboard goes after the ad has moved
export function postActions(id: number): HTMLElement | null {
  return document.getElementById(cardId(id))?.querySelector<HTMLElement>("a, button") ?? null;
}

function StatusPill({post}: {post: MyBurzaPost}) {
  const pill = STATUS_PILL[post.status];
  return (
    <Box
      component="span"
      sx={{height: 26, flex: "none", display: "inline-flex", alignItems: "center", gap: "5px", px: "10px", borderRadius: "13px", background: pill.bg, color: pill.ink, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap"}}
    >
      <Box component="span" aria-hidden sx={{width: 7, height: 7, borderRadius: "50%", background: pill.ink}} />
      {pill.label}
    </Box>
  );
}

// An ad of the player's: kind and status, headline, what it is for, when it closes; Pogledaj and Zatvori oglas while
// it is up, Objavi ponovno once it isn't (or why it can't go up again). change: what was just done to it here
// ("Zatvoren upravo").
export function MyPostCard({
  post,
  today,
  change,
  busy,
  error,
  onClose,
  onRepost,
}: {
  post: MyBurzaPost;
  today: string;
  change?: MyPostChange;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onRepost: () => void;
}) {
  const active = post.status === "ACTIVE";
  const title = myPostTitle(post);
  // an availability ad with no number anywhere isn't listed in Burza
  const hidden = active && post.kind === "AVAILABLE" && !post.phone;
  const blocked = repostBlocked(post, today);
  return (
    <Card
      component="article"
      id={cardId(post.id)}
      aria-label={title}
      // a past ad is faded, all but an error under it
      sx={{p: "16px", display: "flex", flexDirection: "column", gap: "12px", color: color.ink, "& > :not([role=alert])": {opacity: active ? 1 : 0.85}}}
    >
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
        <KindTag kind={post.kind} large />
        <StatusPill post={post} />
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "3px", minWidth: 0}}>
        <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 21, fontWeight: 800, lineHeight: 1.15, overflowWrap: "anywhere"}}>
          {title}
        </Box>
        <Box component="span" sx={{fontSize: 14, color: color.ink2, overflowWrap: "anywhere"}}>
          {myPostSub(post)}
        </Box>
      </Box>
      <Box sx={{display: "flex", alignItems: "center", gap: "8px", fontSize: 13, lineHeight: 1.4, color: color.muted, "& svg": {fontSize: 18, flex: "none"}}}>
        <ScheduleRoundedIcon aria-hidden />
        <span>{expiryLine(post, today, change)}</span>
      </Box>
      {hidden && (
        <Box sx={{fontSize: 13, lineHeight: 1.4, color: color.ink2}}>
          <Box component={TransitionLink} href="/burza/novi/dostupan" sx={{color: color.navy, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "2px"}}>
            Dodaj broj mobitela
          </Box>{" "}
          da se oglas vidi u Burzi.
        </Box>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {active ? (
        // mt auto: in the desktop grid the buttons of a row's cards line up at the bottom
        <Box sx={{mt: "auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "8px"}}>
          <Box component={TransitionLink} href={`/burza/${post.id}`} sx={outlineSx}>
            <VisibilityOutlinedIcon aria-hidden />
            Pogledaj
          </Box>
          <Box
            component="button"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-busy={busy || undefined}
            sx={{...actionSx, background: color.navy, color: color.white}}
          >
            {busy ? <Spinner size={18} tone="white" /> : <CheckCircleOutlineRoundedIcon aria-hidden />}
            Zatvori oglas
          </Box>
        </Box>
      ) : blocked ? (
        // in place of Objavi ponovno, which could only fail
        <Box sx={blockedSx}>
          <EventBusyRoundedIcon aria-hidden />
          {blocked}
        </Box>
      ) : (
        <Box component="button" type="button" onClick={onRepost} disabled={busy} aria-busy={busy || undefined} sx={{...outlineSx, width: "100%", mt: "auto"}}>
          {busy ? <Spinner size={18} /> : <ReplayRoundedIcon aria-hidden />}
          Objavi ponovno
        </Box>
      )}
    </Card>
  );
}

// Skeleton cards in the shape of an ad of the player's while they load
export function MyPostSkeletons() {
  return (
    <Box role="status" aria-label="Učitavanje" sx={{display: "contents"}}>
      {[0, 1].map((i) => (
        <Card key={i} sx={{p: "16px", display: "flex", flexDirection: "column", gap: "12px"}}>
          <Box sx={{display: "flex", justifyContent: "space-between"}}>
            <Skeleton variant="rounded" width={110} height={26} sx={{borderRadius: "9px"}} />
            <Skeleton variant="rounded" width={80} height={26} sx={{borderRadius: "13px"}} />
          </Box>
          <Box>
            <Skeleton variant="text" width="70%" height={28} />
            <Skeleton variant="text" width="85%" height={20} />
          </Box>
          <Skeleton variant="text" width="60%" height={18} />
          <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px"}}>
            <Skeleton variant="rounded" height={46} sx={{borderRadius: radius.md}} />
            <Skeleton variant="rounded" height={46} sx={{borderRadius: radius.md}} />
          </Box>
        </Card>
      ))}
    </Box>
  );
}

// "Nemaš aktivnih oglasa" / "Nema prošlih oglasa"
export function MyPostsEmpty({past}: {past: boolean}) {
  return (
    <Box sx={{p: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center"}}>
      <Box component="span" aria-hidden sx={{width: 64, height: 64, borderRadius: "50%", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 30}}}>
        <CampaignOutlinedIcon />
      </Box>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 21, fontWeight: 800}}>
        {past ? "Nema prošlih oglasa" : "Nemaš aktivnih oglasa"}
      </Box>
      <Box component="p" sx={{m: 0, fontSize: 15, lineHeight: 1.45, color: color.muted}}>
        Oglas za zamjenu se sam zatvara kad prođe večer.
      </Box>
    </Box>
  );
}
