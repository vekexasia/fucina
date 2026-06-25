import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";

export async function trustInstructions(event: FucinaEvent, sha: string, deps: { gh(args: string[]): string; runUrl?: string }) {
  if (event.kind !== "pull_request") throw new Error("/fucina trust-instructions only works on PRs");

  const pr = JSON.parse(deps.gh(["api", `repos/${process.env.GITHUB_REPOSITORY}/pulls/${event.number}`, "--jq", "."]));
  const currentSha = pr.head.sha;

  if (currentSha !== sha) {
    throw new Error(`SHA mismatch: PR head is ${currentSha.substring(0, 7)} but you provided ${sha.substring(0, 7)}. The PR has been updated since you copied the command. Re-run the review to get the current SHA.`);
  }

  deps.gh(["pr", "edit", String(event.number), "--remove-label", "fucina:review"]);
  deps.gh(["pr", "edit", String(event.number), "--remove-label", "fucina:blocked"]);
  deps.gh(["pr", "edit", String(event.number), "--add-label", "fucina:review"]);

  deps.gh(["pr", "comment", String(event.number), "--body", withRunLink(`Sensitive instruction changes at ${sha.substring(0, 7)} explicitly trusted. Review will proceed.`, deps.runUrl)]);
}

export async function trustInstructionsDefault(event: FucinaEvent, sha: string) {
  const { gh } = await import("../gh.js");
  return trustInstructions(event, sha, {
    gh,
    runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined
  });
}
