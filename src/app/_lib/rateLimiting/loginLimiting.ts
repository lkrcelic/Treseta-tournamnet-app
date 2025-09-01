import {LoginUser} from "@/app/_interfaces/login";
import {NextRequest} from "next/server";

/*
 * TODO: In the future, we might want to consider using Redis for this (for scalability)
 * I did not do it now as it requires either setting up to run locally on our server
 * OR we could consider hosted(paid) redis options.
 */
const rateLimitStore = new Map<string, {count: number; lastRequest: number}>();

const MAX_ATTEMPTS = 5;
const WINDOW_DURATION = 5 * 60 * 1000; // Minutes * seconds * miliseconds

async function loginRateLimited(username: string): Promise<boolean> {
  const key = username;
  const now = Date.now();

  const entry = rateLimitStore.get(key) || {count: 0, lastRequest: now};
  if (now - entry.lastRequest > WINDOW_DURATION) {
    rateLimitStore.set(key, {count: 1, lastRequest: now});
    return false;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return true;
  }

  entry.count++;
  entry.lastRequest = now;
  rateLimitStore.set(key, entry);
  return false;
}

export async function handleLogin(request: NextRequest): Promise<boolean> {
  try {
    const body = await request.json();
    const username = LoginUser.parse(body).username;

    return await loginRateLimited(username);
  } catch {
    // The error will be provided in the api route, safe to return true!
    return true;
  }
}
