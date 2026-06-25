import { claudeCode, codex, pi, run as sandcastleRun } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";

import { loadConfig } from "./config.js";

export type AgentResult = { stdout: string; commits: { sha: string }[]; branch: string };

export async function runAgent(prompt: string, cwd = process.cwd()): Promise<AgentResult> {
  if (process.env.FUCINA_SIMULATE_AGENT_OUTPUT) return { stdout: process.env.FUCINA_SIMULATE_AGENT_OUTPUT, commits: [], branch: "simulated" };
  const config = loadConfig(cwd);
  const agent = config.agent === "claudeCode" ? claudeCode(config.model) : config.agent === "codex" ? codex(config.model) : pi(config.model);
  return sandcastleRun({ agent, sandbox: noSandbox(), cwd, prompt, maxIterations: config.maxIterations, logging: { type: "stdout" } });
}

export function parseFucinaJson(stdout: string) {
  const match = stdout.match(/<fucina>([\s\S]*?)<\/fucina>/);
  if (!match) throw new Error("Agent output did not include <fucina> JSON");
  return JSON.parse(match[1]);
}
