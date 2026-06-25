import { parseFucinaJson, runAgent, type AgentResult } from "../agent.js";
import type { FucinaEvent } from "../event.js";
import { withRunLink } from "../comment.js";
import { loadConfig } from "../config.js";
import { isAuthorizedActor } from "../auth.js";
import { getSensitiveFiles } from "../sensitive-paths.js";

export async function review(event: FucinaEvent, deps: { gh(args: string[]): string; agent(prompt: string): Promise<AgentResult>; cwd: string; runUrl?: string }) {
  if (event.kind !== "pull_request") throw new Error("fucina:review only runs on PRs");

  const pr = JSON.parse(deps.gh(["api", `repos/${process.env.GITHUB_REPOSITORY}/pulls/${event.number}`, "--jq", "."]));
  const prAuthor = pr.user.login;
  const headSha = pr.head.sha;

  const config = loadConfig(deps.cwd);
  const filesData = JSON.parse(deps.gh(["api", `repos/${process.env.GITHUB_REPOSITORY}/pulls/${event.number}/files`, "--jq", "."]));
  const changedFiles = filesData.map((f: { filename: string }) => f.filename);

  const sensitiveFiles = getSensitiveFiles(changedFiles, config.sensitiveInstructionPaths);
  if (sensitiveFiles.length > 0 && !isAuthorizedActor(prAuthor, deps.gh)) {
    const fileList = sensitiveFiles.map((f) => `  - ${f}`).join("\n");
    throw new Error(`PR author @${prAuthor} is not an Authorized Actor and modified sensitive instruction paths:\n${fileList}\n\nAn Authorized Actor must explicitly trust these changes:\n\`/fucina trust-instructions ${headSha}\``);
  }

  const diff = deps.gh(["api", `repos/${process.env.GITHUB_REPOSITORY}/pulls/${event.number}`, "--header", "Accept: application/vnd.github.v3.diff"]);
  const result = parseFucinaJson((await deps.agent(`Review PR #${event.number}: ${event.title}\n\nDiff:\n${diff}\n\nReturn <fucina>{"summary":"..."}</fucina>.`)).stdout);
  deps.gh(["pr", "review", String(event.number), "--comment", "--body", withRunLink(String(result.summary), deps.runUrl)]);
}

export async function reviewDefault(event: FucinaEvent) {
  const { gh } = await import("../gh.js");
  return review(event, { gh, agent: (prompt) => runAgent(prompt), cwd: process.cwd() });
}
