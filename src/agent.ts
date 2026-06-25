import { execFileSync } from "node:child_process";
import { claudeCode, codex, pi, run as sandcastleRun } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";

import { loadConfig } from "./config.js";

export type AgentResult = { stdout: string; commits: { sha: string }[]; branch: string };

export async function runAgent(prompt: string, cwd = process.cwd()): Promise<AgentResult> {
  if (process.env.FUCINA_SIMULATE_AGENT_OUTPUT) return { stdout: process.env.FUCINA_SIMULATE_AGENT_OUTPUT, commits: [], branch: "simulated" };
  const config = loadConfig(cwd);
  installAgentCli(config.agent, config.agentCliVersion);
  const agent = config.agent === "claudeCode" ? claudeCode(config.model) : config.agent === "codex" ? codex(config.model) : pi(config.model);
  return sandcastleRun({ agent, sandbox: noSandbox(), cwd, prompt, maxIterations: config.maxIterations, logging: { type: "stdout" } });
}

export function agentCliPackage(agent: string) {
  return agent === "claudeCode" ? "@anthropic-ai/claude-code" : undefined;
}

export function installAgentCli(agent: string, version: string) {
  const pkg = agentCliPackage(agent);
  if (pkg) execFileSync("npm", ["install", "-g", `${pkg}@${version}`], { stdio: "inherit" });
}

export function parseFucinaJson(stdout: string) {
  const match = stdout.match(/<fucina>([\s\S]*?)<\/fucina>/);
  if (!match) throw new Error("Agent output did not include <fucina> JSON");
  return JSON.parse(match[1]);
}
