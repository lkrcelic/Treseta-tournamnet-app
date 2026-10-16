import { createTheme, ThemeOptions } from '@mui/material/styles';
import {color, ease, font, tint} from './tokens';

const themeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: color.navy,
    },
    secondary: {
      main: color.cream,
    },
    error: {
      main: color.red,
    },
    text: {
      primary: color.ink,
      secondary: color.muted,
    },
    background: {
      default: color.paper,
      paper: color.white,
    }
  },
  shape: {
    borderRadius: 14,
  },
  // no <Typography> is used: screens set their type with sx; MUI's own parts (Tooltip, CssBaseline) read the font
  typography: {
    fontFamily: font.body,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: color.paper,
          color: color.ink,
          fontFamily: font.body,
          WebkitTapHighlightColor: "transparent",
        },
        "button, input, select, textarea": {fontFamily: "inherit"},
        // no double-tap zoom delay on the keypad and other buttons (pinch zoom stays available)
        "button, a, [role=button]": {touchAction: "manipulation"},
        "input::placeholder": {color: color.faint, opacity: 1},
        // keyboard focus is always visible; mouse/touch focus is not
        ":focus-visible": {outline: `3px solid ${color.navy}`, outlineOffset: "2px"},
        "@keyframes spLive": {
          "0%": {boxShadow: `0 0 0 0 ${tint.red[45]}`},
          "70%": {boxShadow: "0 0 0 7px transparent"},
          "100%": {boxShadow: "0 0 0 0 transparent"},
        },
        "@keyframes spRowIn": {
          "0%": {opacity: 0, transform: "translateY(-10px) scale(.97)", background: color.cream},
          "60%": {background: color.cream},
          "100%": {opacity: 1, transform: "none", background: "transparent"},
        },
        "@keyframes spRowFlash": {"0%": {background: color.cream}, "100%": {background: "transparent"}},
        "@keyframes spPulse": {"0%, 100%": {transform: "scale(1)"}, "45%": {transform: "scale(1.07)"}},
        "@keyframes spPop": {"0%": {transform: "scale(1)"}, "40%": {transform: "scale(1.4)"}, "100%": {transform: "scale(1)"}},
        "@keyframes spSel": {
          "0%": {transform: "scale(1)"},
          "35%": {transform: "scale(.94)"},
          "70%": {transform: "scale(1.03)"},
          "100%": {transform: "scale(1)"},
        },
        "@keyframes spSpin": {to: {transform: "rotate(360deg)"}},
        // the sponsors' band: slides by half its length (one of its two equal halves), so it loops without a seam
        "@keyframes spBand": {from: {transform: "translateX(0)"}, to: {transform: "translateX(-50%)"}},
        "@keyframes spStepIn": {from: {transform: "translateX(28px)", opacity: 0}, to: {transform: "none", opacity: 1}},
        "@keyframes spStepBack": {from: {transform: "translateX(-28px)", opacity: 0}, to: {transform: "none", opacity: 1}},
        "@keyframes spFadeUp": {from: {transform: "translateY(14px)", opacity: 0}, to: {transform: "none", opacity: 1}},
        // Route transitions (see _lib/viewTransitions.tsx). forward: the new page slides in from the right over the
        // old one, which drifts left and fades; back: the reverse; morph: named elements morph, the rest crossfades.
        "@keyframes vtInRight": {from: {transform: "translateX(100%)"}},
        "@keyframes vtOutLeft": {to: {transform: "translateX(-28%)", opacity: 0}},
        "@keyframes vtInLeft": {from: {transform: "translateX(-28%)", opacity: 0}},
        "@keyframes vtOutRight": {to: {transform: "translateX(100%)"}},
        "@keyframes vtFadeOut": {to: {opacity: 0}},
        "@keyframes vtFadeIn": {from: {opacity: 0}},
        "::view-transition-old(root), ::view-transition-new(root)": {animationDuration: "280ms", animationTimingFunction: ease},
        "html[data-nav=forward]::view-transition-old(root)": {animationName: "vtOutLeft"},
        "html[data-nav=forward]::view-transition-new(root)": {animationName: "vtInRight"},
        "html[data-nav=back]::view-transition-old(root)": {animationName: "vtOutRight", zIndex: 2},
        "html[data-nav=back]::view-transition-new(root)": {animationName: "vtInLeft"},
        "html[data-nav=morph]::view-transition-old(root)": {animationName: "vtFadeOut", animationDuration: "200ms"},
        "html[data-nav=morph]::view-transition-new(root)": {animationName: "vtFadeIn", animationDuration: "200ms"},
        // the Start Game card grows into the scoreboard; the navy card fades out as the board shows through
        "::view-transition-group(table)": {animationDuration: "340ms", animationTimingFunction: ease},
        "::view-transition-old(table)": {animation: `vtFadeOut 220ms ease 170ms both`, height: "100%", objectFit: "cover"},
        "::view-transition-new(table)": {animation: "none", height: "100%"},
        // the wizard's team header stays put and only crossfades its values
        "::view-transition-group(team-header)": {animationDuration: "200ms"},
        "@media (prefers-reduced-motion: reduce)": {
          "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)": {animation: "none !important"},
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "1ms !important",
            scrollBehavior: "auto !important",
          },
        },
      },
    },
  },
};

const theme = createTheme(themeOptions);

export default theme;
