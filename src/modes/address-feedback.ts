import { parseFucinaJson, runAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";

export async function addressFeedback(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; runUrl?: string }) {
  if (event.kind !== "pull_request") throw new Error("fucina:address-feedback only runs on PRs");
  const pr = JSON.parse(deps.gh(["pr", "view", String(event.number), "--json", "headRepositoryOwner,baseRepositoryOwner,headRefName,isCrossRepository"]));
  if (pr.isCrossRepository) throw new Error("Fucina mutation refuses PRs from forks");
  const comments = deps.gh(["pr", "view", String(event.number), "--comments"]);
  const result = await deps.agent(`Address unresolved feedback on internal PR #${event.number}: ${event.title}\n\n${comments}\n\nReturn <fucina>{"summary":"..."}</fucina>.`);
  if (!result.commits.length && !parseFucinaJson(result.stdout).summary) throw new Error("Fucina address-feedback produced no useful commit or comment");
  deps.gh(["pr", "comment", String(event.number), "--body", withRunLink(String(parseFucinaJson(result.stdout).summary), deps.runUrl)]);
}

export async function addressFeedbackDefault(event: FucinaEvent) {
  return addressFeedback(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
