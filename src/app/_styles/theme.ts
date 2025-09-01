import { createTheme, ThemeOptions } from '@mui/material/styles';
import { PaletteColorOptions } from '@mui/material/styles/createPalette';

// Extend the palette to include custom colors
declare module '@mui/material/styles' {
  interface Palette {
    team1: Palette['primary'];
    team2: Palette['primary'];
  }

  interface PaletteOptions {
    team1?: PaletteColorOptions;
    team2?: PaletteColorOptions;
  }
}

// Extend the components to allow for team1 and team2 colors
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    team1: true;
    team2: true;
  }
}

const themeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: '#3C4A67',
    },
    secondary: {
      main: '#EDE0BF',
    },
    team1: {
      main: '#386641',
      contrastText: '#ffffff',
    },
    team2: {
      main: '#BC4749',
      contrastText: '#ffffff',
    },
    info: {
      main: '#92AFD7',
    },
    text: {
      primary: '#212121',  // Text color
      secondary: '#757575',  // Secondary text color
    },
    background: {
      default: "#F1F1F1"
    }
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      color: '#212121',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: '#212121',
    },
    h3: {
      fontSize: '2.25rem',
      fontWeight: 500,
      color: '#212121',
    },
    h4: {
      fontSize: '2rem',
      fontWeight: 500,
      color: '#212121',
    },
    h7: {
      fontFamily: 'Roboto, sans-serif',
      fontSize: '1.1rem',
      fontWeight: 500,
      color: '#212121',
    },
    body1: {
      fontSize: '1rem',
      color: '#212121',
    },
    body2: {
      fontSize: '0.875rem',
      color: '#757575',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ownerState, theme}) => ({
          borderRadius: '8px',            // Adds border radius
          textTransform: 'none',          // Removes uppercase text transformation

          // Contained variant for team1
          ...(ownerState.color === 'team1' && ownerState.variant === 'contained' && {
            backgroundColor: theme.palette.team1.main,
            color: theme.palette.team1.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.team1.dark || theme.palette.team1.main,
            },
          }),

          // Outlined variant for team1
          ...(ownerState.color === 'team1' && ownerState.variant === 'outlined' && {
            border: `1px solid ${theme.palette.team1.main}`,
            color: theme.palette.team1.main,
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: `${theme.palette.team1.main}0A`, // light transparent background on hover
            },
          }),

          // Contained variant for team2
          ...(ownerState.color === 'team2' && ownerState.variant === 'contained' && {
            backgroundColor: theme.palette.team2.main,
            color: theme.palette.team2.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.team2.dark || theme.palette.team2.main,
            },
          }),

          // Outlined variant for team2
          ...(ownerState.color === 'team2' && ownerState.variant === 'outlined' && {
            border: `1px solid ${theme.palette.team2.main}`,
            color: theme.palette.team2.main,
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: `${theme.palette.team2.main}0A`, // light transparent background on hover
            },
          }),
        }),
      },
    },
  },
};

const theme = createTheme(themeOptions);

export default theme;
