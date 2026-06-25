import { execFileSync } from "node:child_process";
import { runAgent, runFucinaAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";

export async function addressFeedback(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; sh?(args: string[]): string; runUrl?: string }) {
  if (event.kind !== "pull_request") throw new Error("fucina:address-feedback only runs on PRs");
  const pr = JSON.parse(deps.gh(["pr", "view", String(event.number), "--json", "headRepositoryOwner,baseRepositoryOwner,headRefName,headRefOid,isCrossRepository"]));
  if (pr.isCrossRepository) throw new Error("Fucina mutation refuses PRs from forks");
  const comments = deps.gh(["pr", "view", String(event.number), "--comments"]);
  const { result, parsed } = await runFucinaAgent(deps.agent, `Address unresolved feedback on internal PR #${event.number}: ${event.title}\n\n${comments}\n\nReturn <fucina>{"summary":"..."}</fucina>.`);
  if (!result.commits.length && !parsed.summary.trim()) throw new Error("Fucina address-feedback produced no useful commit or comment");
  if (result.commits.length) {
    const sh = deps.sh ?? ((args: string[]) => execFileSync(args[0], args.slice(1), { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
    sh(["git", "push", `--force-with-lease=${pr.headRefName}:${pr.headRefOid}`, "origin", `HEAD:${pr.headRefName}`]);
  }
  if (parsed.summary.trim()) deps.gh(["pr", "comment", String(event.number), "--body", withRunLink(parsed.summary, deps.runUrl)]);
}

export async function addressFeedbackDefault(event: FucinaEvent) {
  return addressFeedback(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
