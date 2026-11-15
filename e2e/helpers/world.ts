// Which app this run talks to, and the world it was seeded with. e2e/local/app.sh writes local/run/<id>/app.json
// and the generator's manifest next to it; E2E_ID picks the section (smoke when unset).
import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import type {Catalog} from "../seed/context";

export type App = {id: string; baseURL: string; databaseUrl: string; manifest: string};
export type World = {seed: number; now: string; tonight: string; catalog: Catalog};

export const sectionId = () => process.env.E2E_ID ?? "smoke";

export function appInfo(): App {
  const id = sectionId();
  const file = join(__dirname, "..", "local", "run", id, "app.json");
  if (!existsSync(file)) throw new Error(`No app for section "${id}": run e2e/local/app.sh start ${id} first`);
  return JSON.parse(readFileSync(file, "utf8")) as App;
}

// the config only needs a base URL to load, so it may run before app.sh did
export function appInfoOrNull(): App | null {
  try {
    return appInfo();
  } catch {
    return null;
  }
}

export function loadWorld(app: App = appInfo()): World {
  return JSON.parse(readFileSync(app.manifest, "utf8")) as World;
}
