import { runAgent, parseFucinaJson, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";

export async function explore(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult> }) {
  const result = parseFucinaJson((await deps.agent(`Explore issue #${event.number}: ${event.title}\n\n${event.body ?? ""}\n\nReturn <fucina>{"summary":"..."}</fucina>.`)).stdout);
  deps.gh(["issue", "comment", String(event.number), "--body", String(result.summary)]);
}

export async function exploreDefault(event: FucinaEvent) {
  return explore(event, { gh: () => "", agent: (prompt) => runAgent(prompt) });
}
