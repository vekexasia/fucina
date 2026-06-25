import { assertAuthorizedWithGh } from "./auth.js";
import { readEvent, type FucinaEvent } from "./event.js";
import { gh } from "./gh.js";
import { runAgent, type AgentResult } from "./agent.js";
import { explore } from "./modes/explore.js";
import { addressFeedback } from "./modes/address-feedback.js";
import { implement } from "./modes/implement.js";
import { review } from "./modes/review.js";

type Deps = {
  gh(args: string[]): string;
  agent(prompt: string): Promise<AgentResult>;
  cwd: string;
  runUrl?: string;
};

export async function run() {
  return runEvent(readEvent(), { gh, agent: (prompt) => runAgent(prompt), cwd: process.cwd(), runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined });
}

export async function runEvent(event: FucinaEvent, deps: Deps) {
  if (event.label.startsWith("/fucina ")) {
    return await runSlashCommand(event, deps);
  }

  const target = event.kind === "issue" ? "issue" : "pr";
  deps.gh([target, "edit", String(event.number), "--remove-label", event.label]);
  try {
    assertAuthorizedWithGh(event, deps.gh);
    deps.gh([target, "edit", String(event.number), "--remove-label", "fucina:blocked"]);
    deps.gh([target, "edit", String(event.number), "--add-label", "fucina:in-progress"]);
    if (event.label === "fucina:explore" && event.kind === "issue") return await explore(event, deps);
    if (event.label === "fucina:implement" && event.kind === "issue") return await implement(event, deps);
    if (event.label === "fucina:address-feedback" && event.kind === "pull_request") return await addressFeedback(event, deps);
    if (event.label === "fucina:review" && event.kind === "pull_request") return await review(event, deps);
    throw new Error(`${event.label} is not valid for ${event.kind}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.gh([target, "edit", String(event.number), "--remove-label", event.label]);
    deps.gh([target, "edit", String(event.number), "--add-label", "fucina:blocked"]);
    deps.gh([target, "comment", String(event.number), "--body", `Fucina ${event.label} failed.\n\nReason: ${message}\n${deps.runUrl ? `\nRetry by re-adding ${event.label}. Run: ${deps.runUrl}` : `\nRetry by re-adding ${event.label}.`}`]);
    throw error;
  } finally {
    deps.gh([target, "edit", String(event.number), "--remove-label", "fucina:in-progress"]);
  }
}

async function runSlashCommand(event: FucinaEvent, deps: Deps) {
  const target = event.kind === "issue" ? "issue" : "pr";
  try {
    assertAuthorizedWithGh(event, deps.gh);
    const parts = event.label.split(/\s+/);
    const command = parts[1];
    if (command === "trust-instructions") {
      const sha = parts[2];
      if (!sha || sha.length !== 40) throw new Error("trust-instructions requires a full 40-character SHA");
      const { trustInstructions } = await import("./modes/trust-instructions.js");
      return await trustInstructions(event, sha, deps);
    }
    throw new Error(`Unknown slash command: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.gh([target, "comment", String(event.number), "--body", `Fucina slash command failed.\n\nReason: ${message}\n${deps.runUrl ? `\nRun: ${deps.runUrl}` : ""}`]);
    throw error;
  }
}
