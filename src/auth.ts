import type { FucinaEvent } from "./event.js";
import { gh } from "./gh.js";

const writePermissions = new Set(["admin", "maintain", "write"]);

export function assertAuthorized(event: FucinaEvent) {
  return assertAuthorizedWithGh(event, gh);
}

export function assertAuthorizedWithGh(event: FucinaEvent, runGh: (args: string[]) => string) {
  const allowed = process.env.FUCINA_ALLOWED_ACTORS?.split(",").map((name) => name.trim()).filter(Boolean);
  if (allowed?.length) {
    if (!allowed.includes(event.actor)) throw new Error(`${event.actor} is not allowed to run Fucina`);
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY ?? "OWNER/REPO";
  const output = runGh(["api", `repos/${repo}/collaborators/${event.actor}/permission`, "--jq", ".permission"]).trim();
  const value = output.startsWith("{") ? JSON.parse(output).permission : output;
  if (!writePermissions.has(value)) throw new Error(`${event.actor} does not have write access to ${repo}`);
}
