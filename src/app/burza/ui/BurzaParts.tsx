"use client";

import {BurzaKind, BurzaPost} from "@/app/_interfaces/burza";
import {nightLabel} from "@/app/_lib/nights";
import {isValidPhone, normalizePhone, phoneInput, PHONE_ERROR, PHONE_HINT} from "@/app/_lib/phone";
import {busyLine, KIND_TAG, postBody, postSub, postTitle, timeAgo} from "@/app/_lib/ui/burza";
import {initials} from "@/app/_lib/ui/text";
import {TransitionLink} from "@/app/_lib/viewTransitions";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, ellipsis, mergeSx, tabular} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BackHandRoundedIcon from "@mui/icons-material/BackHandRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useId} from "react";

// Pieces of Burza igrača (Claude Design "Burza igrača · spojeno"), shared by the list, the ad and the forms

// The list as it was last shown (its tab and night), where an ad and a form go back to
let lastList = "/burza";
export function rememberBurzaList(href: string) {
  lastList = href;
}
export const burzaListHref = () => lastList;

// The three kinds of ad, as "Što objavljuješ?" offers them; href is the form
export const KINDS: {kind: BurzaKind; title: string; sub: string; href: string; icon: React.ReactNode}[] = [
  {kind: "SUBSTITUTE", title: "Trebam zamjenu", sub: "Fali vam igrač za jednu večer.", href: "/burza/novi/zamjena", icon: <PersonSearchRoundedIcon />},
  {kind: "PARTNER", title: "Tražim partnera", sub: "Za stalnu ekipu u ligi.", href: "/burza/novi/partner", icon: <HandshakeRoundedIcon />},
  {kind: "AVAILABLE", title: "Dostupan sam", sub: "Kao zamjena, novi partner ili oboje.", href: "/burza/novi/dostupan", icon: <BackHandRoundedIcon />},
];

export function KindTag({kind}: {kind: BurzaKind}) {
  const tag = KIND_TAG[kind];
  return (
    <Box component="span" sx={{alignSelf: "flex-start", height: 24, display: "inline-flex", alignItems: "center", px: "9px", borderRadius: "8px", background: tag.bg, color: tag.ink, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"}}>
      {tag.label}
    </Box>
  );
}

// Initials in a cream circle (a team or a player)
export function AdAvatar({name, size = 44, sx}: {name: string; size?: number; sx?: SxProps<Theme>}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={mergeSx(
        {width: size, height: size, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, fontSize: size >= 52 ? 17 : size >= 44 ? 15 : 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"},
        sx
      )}
    >
      {initials(name)}
    </Box>
  );
}

// The night of a substitute ad, on the right of its card
export function NightChip({night}: {night: string}) {
  return (
    <Box component="span" sx={{height: 30, flex: "none", display: "flex", alignItems: "center", px: "10px", borderRadius: "10px", background: color.cream, color: color.navy, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap"}}>
      {nightLabel(night)}
    </Box>
  );
}

// "Taj dan igraš za ekipu Dalmatinci"
export function BusyLine({team}: {team: string}) {
  return (
    <Box sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 13, fontWeight: 600, color: color.red, "& svg": {fontSize: 18}}}>
      <EventBusyRoundedIcon aria-hidden />
      {busyLine(team)}
    </Box>
  );
}

const cardSx = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: "22px",
  background: color.white,
  p: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  textAlign: "left",
  boxShadow: shadow.card,
  color: color.ink,
  textDecoration: "none",
} as const;

// The ad as the list shows it: tag and age, avatar, headline, night, text. With href it opens the ad;
// footer adds a line at the bottom (the phone number on "Oglas je objavljen").
export function PostCard({post, href, ago, footer}: {post: BurzaPost; href?: string; ago?: string; footer?: React.ReactNode}) {
  const title = postTitle(post);
  const body = (
    <>
      <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
        <KindTag kind={post.kind} />
        <Box component="span" sx={{fontSize: 12.5, color: color.muted, whiteSpace: "nowrap"}}>
          {ago ?? timeAgo(post.created_at)}
        </Box>
      </Box>
      <Box sx={{display: "flex", alignItems: "center", gap: "12px"}}>
        <AdAvatar name={title} />
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 17, fontWeight: 700, color: color.ink, ...ellipsis}}>
            {title}
          </Box>
          <Box component="span" sx={{fontSize: 13, color: color.muted}}>
            {postSub(post)}
          </Box>
        </Box>
        {post.kind === "SUBSTITUTE" && post.night && <NightChip night={post.night} />}
      </Box>
      <Box sx={{fontSize: 14.5, lineHeight: 1.45, color: color.ink, textWrap: "pretty", overflowWrap: "anywhere"}}>{postBody(post)}</Box>
      {post.busy_team && <BusyLine team={post.busy_team} />}
      {footer}
    </>
  );
  if (!href) return <Box sx={cardSx}>{body}</Box>;
  return (
    <Box
      component={TransitionLink}
      href={href}
      sx={{...buttonBase, ...cardSx, transition: "transform 120ms ease", "&:active": {transform: "scale(.99)"}, "&:hover": {boxShadow: shadow.cardHover}}}
    >
      {body}
    </Box>
  );
}

// "‹ Svi datumi · 4 ekipe traže igrača ›": the nights with substitute ads, picked with arrows as on Dnevni poredak
export function DateArrows({
  label,
  count,
  onPrev,
  onNext,
  sx,
}: {
  label: string;
  count: string;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  sx?: SxProps<Theme>;
}) {
  const arrow = (prev: boolean) => {
    const go = prev ? onPrev : onNext;
    return (
      <Box
        component="button"
        type="button"
        aria-label={prev ? "Prethodni datum" : "Sljedeći datum"}
        disabled={!go}
        onClick={() => go?.()}
        sx={{...buttonBase, width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "&:disabled": {opacity: 0.35}, "& svg": {fontSize: 26}}}
      >
        {prev ? <ChevronLeftRoundedIcon /> : <ChevronRightRoundedIcon />}
      </Box>
    );
  };
  return (
    <Box sx={mergeSx({flex: "none", height: 56, display: "flex", alignItems: "center", gap: "6px", px: "6px", borderRadius: "18px", background: color.white, boxShadow: shadow.card}, sx)}>
      {arrow(true)}
      <Box aria-live="polite" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700, color: color.ink, whiteSpace: "nowrap"}}>
          {label}
        </Box>
        <Box component="span" sx={{fontSize: 12.5, color: color.muted, whiteSpace: "nowrap"}}>
          {count}
        </Box>
      </Box>
      {arrow(false)}
    </Box>
  );
}

// A numbered step of a form ("1 Liga")
export function Step({n, children, id}: {n: number; children: React.ReactNode; id?: string}) {
  return (
    <Box component="h2" id={id} sx={{m: 0, display: "flex", alignItems: "center", gap: "10px", px: "2px"}}>
      <Box component="span" aria-hidden sx={{width: 26, height: 26, flex: "none", borderRadius: "50%", background: color.navy, color: color.white, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}>
        {n}
      </Box>
      <Box component="span" sx={{fontSize: 17, fontWeight: 700, whiteSpace: "nowrap"}}>
        {children}
      </Box>
    </Box>
  );
}

// "BROJ MOBITELA *": a small uppercase label above a field
export function FieldLabel({children, htmlFor, id, right}: {children: React.ReactNode; htmlFor?: string; id?: string; right?: React.ReactNode}) {
  return (
    <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", px: "6px"}}>
      <Box component="label" htmlFor={htmlFor} id={id} sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
        {children}
      </Box>
      {right}
    </Box>
  );
}

// A choice in a row of pills (Liga, Večer): navy when picked
export function ChoicePill({on, onClick, children}: {on: boolean; onClick: () => void; children: React.ReactNode}) {
  return (
    <Box
      component="button"
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      sx={{...buttonBase, height: 44, px: "16px", borderRadius: "22px", border: `1.5px solid ${color.navy}`, background: on ? color.navy : color.white, color: on ? color.white : color.navy, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", transition: "background 160ms ease, color 160ms ease"}}
    >
      {children}
    </Box>
  );
}

// An on/off pill with a check or a plus (Zamjena, Novi partner, Spremi broj na profil)
export function TogglePill({on, onClick, children, height = 48}: {on: boolean; onClick: () => void; children: React.ReactNode; height?: number}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={on}
      onClick={onClick}
      sx={{
        ...buttonBase,
        height,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        pl: height > 44 ? "14px" : "12px",
        pr: height > 44 ? "18px" : "16px",
        borderRadius: `${height / 2}px`,
        border: `1.5px solid ${color.navy}`,
        background: on ? color.navy : color.white,
        color: on ? color.white : color.navy,
        fontSize: 15,
        fontWeight: 600,
        whiteSpace: "nowrap",
        transition: "background 160ms ease, color 160ms ease",
        "& svg": {fontSize: 20},
      }}
    >
      {on ? <CheckRoundedIcon aria-hidden /> : <AddRoundedIcon aria-hidden />}
      {children}
    </Box>
  );
}

// A note above or below a form: an icon and a short text on a tinted background
export function Callout({icon, tone = "public", children, sx}: {icon: React.ReactNode; tone?: "public" | "warn" | "ok" | "plain"; children: React.ReactNode; sx?: SxProps<Theme>}) {
  const bg = {public: color.cream2, warn: tint.red[8], ok: tint.green[9], plain: color.white}[tone];
  return (
    <Box
      sx={mergeSx(
        {display: "flex", gap: "10px", alignItems: "flex-start", p: "12px 14px", borderRadius: "16px", background: bg, fontSize: 13.5, lineHeight: 1.45, color: color.ink, "& > svg": {fontSize: 20, flex: "none", color: color.navy}},
        sx
      )}
    >
      {icon}
      <Box component="span" sx={{textWrap: "pretty"}}>
        {children}
      </Box>
    </Box>
  );
}

export function PublicNote() {
  return <Callout icon={<PublicRoundedIcon aria-hidden />}>Oglas vide svi, i bez prijave, zajedno s brojem mobitela.</Callout>;
}

// The phone field: required on an ad, "S profila" when it came from the profile. On an ad (onSave), a new number
// goes on the profile too: by itself when the profile has none, and with a checkbox when it would replace the
// profile's. (A pill that started on read as a "save" button, and tapping it turned saving off.)
export function PhoneField({
  value,
  onChange,
  onBlur,
  profilePhone,
  save,
  onSave,
  label = "Broj mobitela *",
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  profilePhone: string | null;
  save?: boolean;
  onSave?: (v: boolean) => void;
  label?: string;
  required?: boolean;
}) {
  const id = useId();
  const valid = isValidPhone(value);
  const bad = value.trim() !== "" && !valid;
  const fromProfile = !!profilePhone && normalizePhone(value) === profilePhone;
  const newNumber = onSave != null && valid && !fromProfile;
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      <FieldLabel
        htmlFor={id}
        right={
          fromProfile && (
            <Box component="span" sx={{height: 24, flex: "none", display: "inline-flex", alignItems: "center", px: "9px", borderRadius: "8px", background: color.cream, color: color.navy, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"}}>
              S profila
            </Box>
          )
        }
      >
        {label}
      </FieldLabel>
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderRadius: "16px",
          border: `1.5px solid ${bad ? color.red : valid ? color.navy : tint.navy[25]}`,
          background: color.white,
          px: "14px",
          boxSizing: "border-box",
          "&:focus-within": {boxShadow: shadow.focus},
          "& > svg": {fontSize: 22, color: color.muted, flex: "none"},
        }}
      >
        <CallRoundedIcon aria-hidden />
        <Box
          component="input"
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          aria-invalid={bad || undefined}
          aria-describedby={`${id}-hint`}
          placeholder="091 234 5678"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(phoneInput(e.target.value))}
          onBlur={onBlur}
          sx={{flex: 1, minWidth: 0, height: "100%", p: 0, border: "none", outline: "none", background: "transparent", font: "inherit", fontSize: 17, fontWeight: 600, color: color.ink, ...tabular, "&::placeholder": {color: color.faint, fontWeight: 600}}}
        />
      </Box>
      <Box id={`${id}-hint`} aria-live="polite" sx={{px: "6px", fontSize: 13, lineHeight: 1.4, color: bad ? color.red : color.muted}}>
        {bad ? PHONE_ERROR : required ? PHONE_HINT : "Upisuje se sam kad objavljuješ oglas, da ga ne tipkaš svaki put."}
      </Box>
      {newNumber &&
        (profilePhone ? (
          <CheckRow checked={!!save} onChange={onSave} hint={`Na profilu je ${profilePhone}.`}>
            Zamijeni i broj na profilu
          </CheckRow>
        ) : (
          <Box sx={{display: "flex", alignItems: "flex-start", gap: "8px", px: "6px", fontSize: 13, lineHeight: 1.4, color: color.muted, "& svg": {fontSize: 18, flex: "none", color: color.navy}}}>
            <CheckRoundedIcon aria-hidden />
            <span>Sprema se i na tvoj profil, pa ga idući put ne upisuješ.</span>
          </Box>
        ))}
    </Box>
  );
}

// A checkbox with its label; the whole row is the target
function CheckRow({checked, onChange, hint, children}: {checked: boolean; onChange: (v: boolean) => void; hint?: string; children: React.ReactNode}) {
  const id = useId();
  return (
    <Box
      component="button"
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={hint ? `${id}-hint` : undefined}
      onClick={() => onChange(!checked)}
      sx={{...buttonBase, minHeight: 44, display: "flex", alignItems: "center", gap: "10px", px: "6px", textAlign: "left"}}
    >
      <Box
        component="span"
        aria-hidden
        sx={{width: 24, height: 24, flex: "none", boxSizing: "border-box", borderRadius: "7px", border: `2px solid ${color.navy}`, background: checked ? color.navy : color.white, color: color.white, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 18}}}
      >
        {checked && <CheckRoundedIcon />}
      </Box>
      <Box component="span" sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" id={`${id}-label`} sx={{fontSize: 15, fontWeight: 600, color: color.ink}}>
          {children}
        </Box>
        {hint && (
          <Box component="span" id={`${id}-hint`} sx={{fontSize: 12.5, color: color.muted}}>
            {hint}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// "Napomena · neobavezno"
export function NoteField({value, onChange, placeholder, label = "Napomena · neobavezno", height = 76, maxLength = 500}: {value: string; onChange: (v: string) => void; placeholder: string; label?: string; height?: number; maxLength?: number}) {
  const id = useId();
  return (
    <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <TextArea id={id} value={value} onChange={onChange} placeholder={placeholder} height={height} maxLength={maxLength} />
    </Box>
  );
}

export function TextArea({id, value, onChange, placeholder, height, maxLength, labelledBy}: {id?: string; value: string; onChange: (v: string) => void; placeholder: string; height: number; maxLength: number; labelledBy?: string}) {
  return (
    <Box
      component="textarea"
      id={id}
      aria-labelledby={labelledBy}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      sx={{
        width: "100%",
        height,
        resize: "none",
        boxSizing: "border-box",
        borderRadius: "16px",
        border: `1.5px solid ${color.borderControl}`,
        background: color.white,
        p: "12px 14px",
        font: "inherit",
        fontSize: 16,
        lineHeight: 1.45,
        color: color.ink,
        outline: "none",
        "&:focus": {borderColor: color.navy, boxShadow: shadow.focus},
        "&::placeholder": {color: color.faint},
      }}
    />
  );
}

// "Što objavljuješ?": the three kinds of ad
export function KindList({onPick}: {onPick: (href: string) => void}) {
  return (
    <Card component="ul" sx={{listStyle: "none", m: 0, p: 0, overflow: "hidden"}}>
      {KINDS.map((k, i) => (
        <Box component="li" key={k.kind}>
          <Box
            component="button"
            type="button"
            onClick={() => onPick(k.href)}
            sx={{
              ...buttonBase,
              width: "100%",
              minHeight: 78,
              display: "flex",
              alignItems: "center",
              gap: "14px",
              p: "12px 14px",
              borderBottom: i < KINDS.length - 1 ? `1px solid ${color.line}` : "none",
              background: color.white,
              textAlign: "left",
              "&:active": {background: color.lineFill},
              "& > svg": {fontSize: 24, color: color.navy, flex: "none"},
            }}
          >
            <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "14px", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 24}}}>
              {k.icon}
            </Box>
            <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px"}}>
              <Box component="span" sx={{fontSize: 16, fontWeight: 600, color: color.ink}}>
                {k.title}
              </Box>
              <Box component="span" sx={{fontSize: 13, color: color.muted}}>
                {k.sub}
              </Box>
            </Box>
            <ChevronRightRoundedIcon aria-hidden />
          </Box>
        </Box>
      ))}
    </Card>
  );
}

// The big headline of a screen in the display font
export function Headline({children, size = 30, sx}: {children: React.ReactNode; size?: number; sx?: SxProps<Theme>}) {
  return (
    <Box component="h1" sx={mergeSx({m: 0, fontFamily: font.display, fontSize: size, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.02em"}, sx)}>
      {children}
    </Box>
  );
}

// Shares the ad's link with the phone's share sheet, or copies it where there is none. Resolves to "copied" when
// the link was copied (the caller says so), "shared" or "cancelled".
export async function shareLink(url: string, title: string, text: string): Promise<"shared" | "copied" | "cancelled"> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.share) {
    try {
      await nav.share({title, text, url});
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await nav?.clipboard?.writeText(url);
    return "copied";
  } catch {
    window.prompt("Kopiraj poveznicu:", url);
    return "copied";
  }
}

// The text that goes with a shared ad
export function shareText(post: BurzaPost): string {
  if (post.kind === "SUBSTITUTE") return `Ekipa ${post.team?.name ?? ""} traži zamjenu${post.night ? ` (${nightLabel(post.night)})` : ""}. Možeš li uskočiti?`;
  if (post.kind === "PARTNER") return `${post.author.name} traži partnera za ${post.league?.name ?? "ligu"}.`;
  return `${post.author.name} je dostupan za Belu ligu.`;
}

// The white outlined 60 px action at the bottom (Javi nekome, Podijeli)
export function OutlineAction({icon, onClick, children, sx}: {icon: React.ReactNode; onClick: () => void; children: React.ReactNode; sx?: SxProps<Theme>}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={mergeSx(
        {
          ...buttonBase,
          height: 60,
          flex: "none",
          width: "100%",
          borderRadius: "18px",
          border: `1.5px solid ${color.borderControl}`,
          background: color.white,
          color: color.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          fontSize: 17,
          fontWeight: 600,
          "&:active": {transform: "scale(.98)"},
          "& svg": {fontSize: 24},
        },
        sx
      )}
    >
      {icon}
      {children}
    </Box>
  );
}
