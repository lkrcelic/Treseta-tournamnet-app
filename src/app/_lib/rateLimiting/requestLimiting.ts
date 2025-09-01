import {NextRequest} from "next/server";

const MAX_REQUESTS = 100;
const TIME_WINDOW = 1 * 60 * 1000; // minute * seconds * miliseconds

const rateLimitStore = new Map<string, {count: number; lastRequest: number}>();

async function apiRateLimiter(request: NextRequest): Promise<boolean> {
  const key = request.ip || request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const now = Date.now();
  console.log(key);

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
