import { execFileSync } from "node:child_process";
import { parseFucinaJson, runAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";

export async function implement(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; sh?(args: string[]): string; runUrl?: string }) {
  if (event.kind !== "issue") throw new Error("fucina:implement only runs on issues");
  const comments = deps.gh(["issue", "view", String(event.number), "--comments"]);
  const result = await deps.agent(`Implement issue #${event.number}: ${event.title}\n\nIssue body:\n${event.body ?? ""}\n\nIssue comments:\n${comments}\n\nIf the requested work is GitHub-side bookkeeping, do it with gh and return a summary. Return <fucina>{"summary":"..."}</fucina>.`);
  const parsed = parseFucinaJson(result.stdout);
  const sh = deps.sh ?? ((args: string[]) => execFileSync(args[0], args.slice(1), { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
  const commitsAhead = Number(sh(["git", "rev-list", "--count", "origin/main..HEAD"]).trim());
  if (!Number.isFinite(commitsAhead) || commitsAhead === 0) {
    deps.gh(["issue", "comment", String(event.number), "--body", withRunLink(String(parsed.summary ?? "Fucina completed the requested GitHub-side work."), deps.runUrl)]);
    return;
  }
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "work";
  const branch = `fucina/issue-${event.number}-${slug}`;
  sh(["git", "checkout", "-B", branch]);
  sh(["git", "push", "--force", "origin", branch]);
  deps.gh(["pr", "create", "--draft", "--head", branch, "--title", `Implement #${event.number}: ${event.title}`, "--body", `Closes #${event.number}`]);
  deps.gh(["issue", "comment", String(event.number), "--body", withRunLink(String(parsed.prUrl ?? parsed.summary ?? "Draft PR created by Fucina."), deps.runUrl)]);
}

export async function implementDefault(event: FucinaEvent) {
  return implement(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
