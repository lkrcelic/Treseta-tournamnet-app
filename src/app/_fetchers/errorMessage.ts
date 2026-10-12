// What a screen shows when a request never reached the server (offline, the bar's wifi dropped)
export const NETWORK_ERROR = "Provjeri vezu i pokušaj ponovno.";

// The browser rejects fetch() with its own English TypeError ("Failed to fetch", "Load failed"); screens show an
// error's message, so it becomes NETWORK_ERROR. An abort is passed on as it is, for callers that check for it.
export function networkError(error: unknown): unknown {
  if (error instanceof Error && error.name === "AbortError") return error;
  return new Error(NETWORK_ERROR);
}

// What the app does when a request answers 401 (the login ended: expired, or an admin deactivated the account).
// UserBootstrapper sets it to checkSession, which sends the player to Prijava; kept as a hook so the fetchers don't
// depend on the app's stores.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// fetch() for the fetchers: a request that fails before any response throws NETWORK_ERROR, and a 401 also starts the
// session check (the screen still gets the response and shows its error until the page changes)
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    throw networkError(error);
  }
  if (response.status === 401) onUnauthorized?.();
  return response;
}

// Reads the {error} message an API route sends back (Croatian), falling back to the fetcher's own sentence.
export async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // not JSON
  }
  return fallback;
}
