import { execFileSync } from "node:child_process";

export function gh(args: string[]) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function ghOk(args: string[]) {
  try {
    gh(args);
    return true;
  } catch {
    return false;
  }
}
