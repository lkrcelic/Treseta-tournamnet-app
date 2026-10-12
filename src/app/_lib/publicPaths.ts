// Pages that work without logging in, shared by the middleware and the client's session check

// Burza igrača's list and a single ad (/burza, /burza/12); publishing an ad (/burza/novi/...) needs a login
export function isPublicBurzaPath(path: string): boolean {
  return /^\/burza(\/\d+)?\/?$/.test(path);
}

// Pages that work without logging in (the client's session check doesn't send these to /login): Prijava,
// Registracija, a league's season table and Burza's list and ads
export function isPublicPagePath(path: string): boolean {
  return path.startsWith("/login") || path.startsWith("/signup") || /^\/league\/(\d+|current)\/standings\/?$/.test(path) || isPublicBurzaPath(path);
}

// Where to go after logging in: only a page of this app ("/burza/novi/zamjena"), never another site ("//evil.example")
export function safeNextPath(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}
