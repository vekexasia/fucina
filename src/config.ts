import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ScheduledPrompt = {
  name: string;
  schedule: string;
  mode: "explore" | "implement";
  prompt: string;
};

export type FucinaConfig = {
  agent: "claudeCode" | "codex" | "pi";
  model: string;
  agentCliVersion: string;
  maxIterations: number;
  sensitiveInstructionPaths: string[];
  scheduledPrompts?: ScheduledPrompt[];
};

export const defaultSensitiveInstructionPaths = [".fucina/**", ".github/workflows/**", "AGENTS.md", "CLAUDE.md", ".claude/**", ".codex/**", ".pi/**"];

export function loadConfig(cwd = process.cwd()): FucinaConfig {
  const path = join(cwd, ".fucina/config.json");
  const file = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const env = (name: string) => process.env[name]?.trim() || undefined;
  const config = {
    agent: env("FUCINA_AGENT") ?? file.agent,
    model: env("FUCINA_MODEL") ?? file.model,
    agentCliVersion: env("FUCINA_AGENT_CLI_VERSION") ?? file.agentCliVersion,
    maxIterations: Number(env("FUCINA_MAX_ITERATIONS") ?? file.maxIterations ?? 1),
    sensitiveInstructionPaths: Array.isArray(file.sensitiveInstructionPaths) ? file.sensitiveInstructionPaths : defaultSensitiveInstructionPaths,
  };
  if (!["claudeCode", "codex", "pi"].includes(config.agent)) throw new Error("FUCINA_AGENT or .fucina/config.json agent must be claudeCode, codex, or pi");
  if (!config.model) throw new Error("FUCINA_MODEL or .fucina/config.json model is required");
  if (!config.agentCliVersion) throw new Error("FUCINA_AGENT_CLI_VERSION or .fucina/config.json agentCliVersion is required");
  return config as FucinaConfig;
}
