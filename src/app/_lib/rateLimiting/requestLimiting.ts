import {NextRequest} from "next/server";

const MAX_REQUESTS = 1000; 
const TIME_WINDOW = 1 * 60 * 1000; // minute * seconds * miliseconds

const rateLimitStore = new Map<string, {count: number; lastRequest: number}>();

async function apiRateLimiter(request: NextRequest): Promise<boolean> {
  const key = request.ip || request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const now = Date.now();
  if (rateLimitStore.size >= 1000) {
    // drop finished windows so the in-memory store doesn't grow forever
    rateLimitStore.forEach((entry, storedKey) => {
      if (now - entry.lastRequest > TIME_WINDOW) rateLimitStore.delete(storedKey);
    });
  }

  const entry = rateLimitStore.get(key) || {count: 0, lastRequest: now};
  if (now - entry.lastRequest > TIME_WINDOW) {
    rateLimitStore.set(key, {count: 1, lastRequest: now});
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  entry.lastRequest = now;
  rateLimitStore.set(key, entry);
  return true;
}

export async function isApiLimited(request: NextRequest): Promise<boolean> {
  return !(await apiRateLimiter(request));
}
