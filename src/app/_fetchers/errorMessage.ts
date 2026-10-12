// What a screen shows when a request never reached the server (offline, the bar's wifi dropped)
export const NETWORK_ERROR = "Provjeri vezu i pokušaj ponovno.";

// The browser rejects fetch() with its own English TypeError ("Failed to fetch", "Load failed"); screens show an
// error's message, so it becomes NETWORK_ERROR. An abort is passed on as it is, for callers that check for it.
export function networkError(error: unknown): unknown {
  if (error instanceof Error && error.name === "AbortError") return error;
  return new Error(NETWORK_ERROR);
}

// fetch() for the fetchers: a request that fails before any response throws NETWORK_ERROR
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw networkError(error);
  }
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
