import { parseFucinaJson, runAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";

export async function review(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; runUrl?: string }) {
  if (event.kind !== "pull_request") throw new Error("fucina:review only runs on PRs");
  const diff = deps.gh(["api", `repos/${process.env.GITHUB_REPOSITORY}/pulls/${event.number}`, "--header", "Accept: application/vnd.github.v3.diff"]);
  const result = parseFucinaJson((await deps.agent(`Review PR #${event.number}: ${event.title}\n\nDiff:\n${diff}\n\nReturn <fucina>{"summary":"..."}</fucina>.`)).stdout);
  deps.gh(["pr", "review", String(event.number), "--comment", "--body", withRunLink(String(result.summary), deps.runUrl)]);
}

export async function reviewDefault(event: FucinaEvent) {
  return review(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
