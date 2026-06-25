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
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch (error) {
    const summary = match[1].match(/"summary"\s*:\s*"([\s\S]*)"\s*}/)?.[1];
    if (summary !== undefined) parsed = { summary };
    else throw new Error(`Agent output <fucina> JSON was malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Agent output must be a JSON object");
  const output = parsed as { summary?: unknown; prUrl?: unknown };
  if (typeof output.summary !== "string") throw new Error("Agent output summary must be a string");
  if (output.prUrl !== undefined && typeof output.prUrl !== "string") throw new Error("Agent output prUrl must be a string");
  return output as { summary: string; prUrl?: string };
}

export async function runFucinaAgent(agent: (prompt: string) => Promise<AgentResult>, prompt: string) {
  const result = await agent(prompt);
  try {
    return { result, parsed: parseFucinaJson(result.stdout) };
  } catch (error) {
    const retry = await agent(`${prompt}\n\nYour previous output was invalid: ${error instanceof Error ? error.message : String(error)}. Return only <fucina>{"summary":"..."}</fucina>.`);
    return { result: retry, parsed: parseFucinaJson(retry.stdout) };
  }
}
