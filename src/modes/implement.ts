import { parseFucinaJson, runAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";

export async function implement(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult> }) {
  if (event.kind !== "issue") throw new Error("fucina:implement only runs on issues");
  const result = await deps.agent(`Implement issue #${event.number}: ${event.title}\n\nReturn <fucina>{"summary":"..."}</fucina>.`);
  if (!result.commits.length) throw new Error("Fucina implement produced no commits");
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "work";
  const branch = `fucina/issue-${event.number}-${slug}`;
  deps.gh(["pr", "create", "--draft", "--head", branch, "--title", `Implement #${event.number}: ${event.title}`, "--body", `Closes #${event.number}`]);
  const parsed = parseFucinaJson(result.stdout);
  deps.gh(["issue", "comment", String(event.number), "--body", String(parsed.prUrl ?? parsed.summary ?? "Draft PR created by Fucina.")]);
}

export async function implementDefault(event: FucinaEvent) {
  return implement(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
