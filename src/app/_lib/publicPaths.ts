// Pages that work without logging in, shared by the middleware and the client's session check

// Burza igrača's list and a single ad (/burza, /burza/12); publishing an ad (/burza/novi/...) needs a login
export function isPublicBurzaPath(path: string): boolean {
  return /^\/burza(\/\d+)?\/?$/.test(path);
}

// Where to go after logging in: only a page of this app ("/burza/novi/zamjena"), never another site ("//evil.example")
export function safeNextPath(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}
