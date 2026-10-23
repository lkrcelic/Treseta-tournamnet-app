import argon2 from "argon2";
import {randomBytes} from "crypto";

// Made once, with the same options as a real password hash (signup)
let dummyHash: Promise<string> | undefined;

// A missing account or a Google one (no password) still runs a hash check, so the answer takes as long as a wrong
// password and doesn't tell which usernames exist
export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
  if (hash) return argon2.verify(hash, password);
  dummyHash ??= argon2.hash(randomBytes(16).toString("hex"));
  await argon2.verify(await dummyHash, password);
  return false;
}
