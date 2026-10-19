// The app's name as the screens show it (login, menu, install sheet, page title). The Bela app shows "Bela Liga" with
// its sponsor's name above it; the static files (public/manifest.webmanifest, public/icons) carry the same name.
export const BRAND = {
  name: "Trešeta Liga",
  // for "otvori Trešeta Ligu s početnog zaslona"
  nameAccusative: "Trešeta Ligu",
  // the small line above the name on the login screen and in the menu (Bela: "Piatnik"); empty shows none
  eyebrow: "",
  // the app icon as the install sheet draws it: the flower logo on cream (Bela: its bell on black)
  icon: "/icons/apple-touch-icon.png",
  // the flower logo, transparent, before the name on login and Početna (Bela: the bell)
  logo: "/logo.png",
} as const;
