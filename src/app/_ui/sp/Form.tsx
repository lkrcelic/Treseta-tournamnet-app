import {color} from "@/app/_styles/tokens";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React, {useId, useState} from "react";
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
  background: color.card,
  px: "16px",
  fontFamily: "inherit",
  fontSize: 17,
  color: color.ink,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 150ms ease, background 150ms ease",
  "&:focus": {borderColor: color.navy, background: color.card},
  "&:focus-visible": {outline: "none", boxShadow: `0 0 0 3px rgba(60,74,103,.18)`},
  "&[aria-invalid=true]": {borderColor: color.red},
  "&::-webkit-calendar-picker-indicator": {opacity: 0.6},
  "&[type=date]": dateInputFix,
} as const;

type FieldProps = {
  label: string;
  error?: string;
  children: (props: {id: string; "aria-invalid"?: boolean; "aria-describedby"?: string}) => React.ReactNode;
  sx?: SxProps<Theme>;
};

// Label + control + error message, wired together for screen readers
export function Field({label, error, children, sx}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Box sx={mergeSx({display: "flex", flexDirection: "column", gap: "6px", minWidth: 0}, sx)}>
      <Box component="label" htmlFor={id} sx={{fontSize: 14, fontWeight: 600, color: color.inkSoft, pl: "4px"}}>
        {label}
      </Box>
      {children({id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined})}
      {error && (
        <Box
          id={errorId}
          sx={{display: "flex", alignItems: "center", gap: "6px", pl: "4px", fontSize: 14, fontWeight: 600, color: color.red}}
        >
          <ErrorRoundedIcon sx={{fontSize: 18}} />
          {error}
        </Box>
      )}
    </Box>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {sx?: SxProps<Theme>; soft?: boolean};

// soft: the cream-tinted fill used on desktop forms and the login card
export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(function TextInput({sx, soft, ...rest}, ref) {
  return <Box component="input" ref={ref} sx={mergeSx(inputSx, soft && {background: color.paperSoft}, sx)} {...rest} />;
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

// Input with a leading search icon
export const SearchInput = React.forwardRef<HTMLInputElement, InputProps & {height?: number; active?: boolean}>(
  function SearchInput({sx, height = 52, active, soft, ...rest}, ref) {
    return (
      <Box sx={mergeSx({position: "relative", flex: "none"}, sx)}>
        <SearchRoundedIcon
          aria-hidden
          sx={{
            position: "absolute",
            left: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 24,
            color: active ? color.navy : color.muted,
            pointerEvents: "none",
          }}
        />
        <TextInput
          ref={ref}
          type="search"
          soft={soft}
          sx={{height, pl: "48px", borderColor: active ? color.navy : undefined, borderRadius: height < 50 ? "14px" : "16px"}}
          {...rest}
        />
      </Box>
    );
  }
);
