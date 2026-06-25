import { runAgent, parseFucinaJson, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";

export async function explore(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; runUrl?: string }) {
  const result = parseFucinaJson((await deps.agent(`Explore issue #${event.number}: ${event.title}\n\n${event.body ?? ""}\n\nReturn <fucina>{"summary":"..."}</fucina>.`)).stdout);
  deps.gh(["issue", "comment", String(event.number), "--body", withRunLink(String(result.summary), deps.runUrl)]);
}

export async function exploreDefault(event: FucinaEvent) {
  return explore(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
