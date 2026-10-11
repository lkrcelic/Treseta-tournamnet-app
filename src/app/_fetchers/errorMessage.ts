// Reads the {error} message an API route sends back, falling back to the HTTP status text.
export async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // not JSON
  }
  return `${fallback}: ${response.statusText}`;
}
