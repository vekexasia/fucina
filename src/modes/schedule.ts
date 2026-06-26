import { execFileSync } from "node:child_process";
import { runFucinaAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { loadConfig } from "../config.js";

export async function schedule(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; sh?(args: string[]): string; cwd: string }) {
  if (event.kind !== "schedule" || !event.scheduleName) {
    throw new Error("schedule mode requires a schedule event with scheduleName");
  }

  const config = loadConfig(deps.cwd);
  const scheduledPrompt = config.scheduledPrompts?.find((sp) => sp.name === event.scheduleName);
  if (!scheduledPrompt) {
    throw new Error(`No scheduled prompt found with name: ${event.scheduleName}`);
  }

  const branchName = `fucina/schedule/${event.scheduleName}`;
  const sh = deps.sh ?? ((args: string[]) => execFileSync(args[0], args.slice(1), { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));

  // Run the agent with the scheduled prompt
  const { result, parsed } = await runFucinaAgent(deps.agent, scheduledPrompt.prompt);

  // Check if there are any commits
  const commitsAhead = Number(sh(["git", "rev-list", "--count", "origin/main..HEAD"]).trim());
  if (!result.commits.length || !Number.isFinite(commitsAhead) || commitsAhead === 0) {
    // No changes, exit cleanly
    return;
  }

  // Create or switch to the scheduled branch
  sh(["git", "checkout", "-B", branchName]);
  sh(["git", "push", "--force-with-lease", "origin", branchName]);

  // Find or create PR
  const prTitle = `Scheduled: ${event.scheduleName}`;
  let prNumber: number | undefined;

  try {
    const existingPr = deps.gh(["pr", "list", "--head", branchName, "--json", "number", "--jq", ".[0].number"]).trim();
    if (existingPr) {
      prNumber = parseInt(existingPr);
    }
  } catch {
    // No existing PR
  }

  const prBody = `Automated scheduled run: ${event.scheduleName}\n\nSchedule: \`${scheduledPrompt.schedule}\`\nMode: ${scheduledPrompt.mode}\n\n${parsed.summary || ""}`;

  if (prNumber) {
    // Update existing PR
    deps.gh(["pr", "edit", String(prNumber), "--body", prBody]);
  } else {
    // Create new PR
    deps.gh(["pr", "create", "--title", prTitle, "--body", prBody, "--base", "main", "--head", branchName]);
  }
}
