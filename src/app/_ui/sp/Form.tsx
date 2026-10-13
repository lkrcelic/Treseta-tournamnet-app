import {color, shadow} from "@/app/_styles/tokens";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useCallback, useId, useRef, useState} from "react";
import {buttonBase, mergeSx} from "./base";

// iOS Safari gives a date input its own minimum width and ignores width: 100%, so on a narrow phone it runs past
// its card; without the native look it takes the given width, and the date stays left-aligned like other text
export const dateInputFix = {
  appearance: "none",
  WebkitAppearance: "none",
  display: "block",
  minWidth: 0,
  maxWidth: "100%",
  textAlign: "left",
  "&::-webkit-date-and-time-value": {textAlign: "left", margin: 0},
} as const;

export const inputSx = {
  width: "100%",
  height: 56,
  borderRadius: "16px",
  border: `1.5px solid ${color.border}`,
  background: color.white,
  px: "16px",
  fontFamily: "inherit",
  fontSize: 17,
  color: color.ink,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 150ms ease, background 150ms ease",
  "&:focus": {borderColor: color.navy, background: color.white},
  "&:focus-visible": {outline: "none", boxShadow: shadow.focus},
  "&[aria-invalid=true]": {borderColor: color.red},
  "&::-webkit-calendar-picker-indicator": {opacity: 0.6},
  "&[type=date]": dateInputFix,
} as const;

type FieldProps = {
  label: string;
  error?: string;
  children: (props: {id: string; "aria-invalid"?: boolean; "aria-describedby"?: string}) => React.ReactNode;
  sx?: SxProps<Theme>;
  // the label and the message under the control, restyled (the admin's "Uredi osobne podatke" panel: smaller)
  labelSx?: SxProps<Theme>;
  errorSx?: SxProps<Theme>;
};

// Label + control + error message, wired together for screen readers
export function Field({label, error, children, sx, labelSx, errorSx}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Box sx={mergeSx({display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}, sx)}>
      <Box component="label" htmlFor={id} sx={mergeSx({fontSize: 14, fontWeight: 600, color: color.ink2, pl: "4px"}, labelSx)}>
        {label}
      </Box>
      {children({id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined})}
      {error && (
        // a message of two lines keeps its icon at the first one
        <Box
          id={errorId}
          sx={mergeSx({display: "flex", alignItems: "flex-start", gap: "6px", pl: "4px", fontSize: 14, lineHeight: "20px", fontWeight: 600, color: color.red}, errorSx)}
        >
          <ErrorRoundedIcon sx={{flex: "none", fontSize: 18, mt: "1px"}} />
          {error}
        </Box>
      )}
    </Box>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {sx?: SxProps<Theme>; soft?: boolean};

// soft: the cream-tinted fill used on desktop forms and the login card
export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(function TextInput({sx, soft, ...rest}, ref) {
  return <Box component="input" ref={ref} sx={mergeSx(inputSx, soft && {background: color.paper2}, sx)} {...rest} />;
});

export function TextField({
  label,
  error,
  sx,
  inputSx: extraInputSx,
  ...input
}: InputProps & {label: string; error?: string; inputSx?: SxProps<Theme>}) {
  return (
    <Field label={label} error={error} sx={sx}>
      {(a11y) => <TextInput {...a11y} {...input} sx={extraInputSx} />}
    </Field>
  );
}

export function PasswordField({
  label,
  error,
  sx,
  soft,
  ...input
}: InputProps & {label: string; error?: string}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error} sx={sx}>
      {(a11y) => (
        <Box sx={{position: "relative"}}>
          <TextInput {...a11y} {...input} soft={soft} type={visible ? "text" : "password"} sx={{pr: "56px"}} />
          <Box
            component="button"
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Sakrij lozinku" : "Prikaži lozinku"}
            aria-pressed={visible}
            sx={{
              ...buttonBase,
              position: "absolute",
              right: "4px",
              top: "4px",
              width: 48,
              height: 48,
              borderRadius: "12px",
              color: color.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {visible ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
          </Box>
        </Box>
      )}
    </Field>
  );
}

// A borderless search field shows its keyboard focus as a navy line inside its edge
const borderlessFocus = `inset 0 0 0 1.5px ${color.navy}`;

const SEARCH_VARIANT = {
  // white with a border (soft: the cream-tinted fill of desktop forms)
  outline: {},
  // white, no border, a card's shadow: on the phone's paper background (Rejting 8a)
  white: {border: "none", background: color.white, boxShadow: shadow.card, fontSize: 16, "&:focus": {background: color.white}, "&:focus-visible": {boxShadow: `${shadow.card}, ${borderlessFocus}`}},
  // paper, no border: inside a white card on the desktop (Rejting 8k, the Ekipe and Igrači lists)
  paper: {border: "none", background: color.paper, fontSize: 15, "&:focus": {background: color.paper}, "&:focus-visible": {boxShadow: borderlessFocus}},
} as const;

type SearchInputProps = InputProps & {
  height?: number;
  active?: boolean;
  variant?: keyof typeof SEARCH_VARIANT;
  // with a query, a round "Očisti" button at the end empties it (and the field keeps the focus)
  onClear?: () => void;
};

// Input with a leading search icon
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {sx, height = 52, active, soft, variant = "outline", onClear, ...rest},
  ref
) {
  const own = useRef<HTMLInputElement | null>(null);
  // the field for the clear button's focus, and for whoever passed a ref
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      own.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );
  // the borderless fields of a narrow card (the Ekipe and Igrači lists, 44 px) are a size smaller inside
  const small = variant !== "outline" && height <= 44;
  const icon = variant === "outline" ? 24 : small ? 20 : 22;
  const left = small ? 12 : 14;
  // the designs: the phone's white field 16, the paper ones 14 (12 in a narrow card), the outlined ones by height
  const radius = variant === "white" ? 16 : small ? 12 : height < 50 ? 14 : 16;
  // the clear button is as far in from the end as the icon from the start (the borderless fields' padding); in an
  // outlined field it is centred in the field's height
  const clearInset = variant === "outline" ? (height - 32) / 2 : left;
  const clearable = onClear != null && String(rest.value ?? "") !== "";
  return (
    <Box sx={mergeSx({position: "relative", flex: "none"}, sx)}>
      <SearchRoundedIcon
        aria-hidden
        sx={{
          position: "absolute",
          left: `${left}px`,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: icon,
          color: active ? color.navy : color.muted,
          pointerEvents: "none",
        }}
      />
      <TextInput
        ref={setRef}
        type="search"
        soft={soft}
        sx={mergeSx(SEARCH_VARIANT[variant], {
          height,
          pl: `${left + icon + (small ? 8 : 10)}px`,
          pr: clearable ? `${clearInset + 32 + 8}px` : undefined,
          borderColor: active ? color.navy : undefined,
          borderRadius: `${radius}px`,
          // our own clear button replaces the browser's
          ...(onClear && {"&::-webkit-search-cancel-button": {display: "none"}}),
        })}
        {...rest}
      />
      {clearable && (
        <Box
          component="button"
          type="button"
          aria-label="Očisti"
          onClick={() => {
            onClear();
            own.current?.focus();
          }}
          sx={{
            ...buttonBase,
            position: "absolute",
            right: `${clearInset}px`,
            top: "50%",
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: color.lineFill,
            color: color.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& svg": {fontSize: 18},
          }}
        >
          <CloseRoundedIcon aria-hidden />
        </Box>
      )}
    </Box>
  );
});
