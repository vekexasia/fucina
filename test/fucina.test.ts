import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { labels } from "../src/labels.js";
import { install, upgrade } from "../src/install.js";
import { loadConfig } from "../src/config.js";
import { runEvent } from "../src/run.js";
import { agentCliPackage, parseFucinaJson } from "../src/agent.js";
import { addressFeedback } from "../src/modes/address-feedback.js";
import { review } from "../src/modes/review.js";
import { withRunLink } from "../src/comment.js";
import { matchesSensitivePaths, getSensitiveFiles } from "../src/sensitive-paths.js";
import { assertAuthorizedWithGh } from "../src/auth.js";

function tmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), "fucina-"));
  mkdirSync(join(dir, ".git"));
  return dir;
}

test("authorization accepts explicit allowed actors without gh", () => {
  const old = { ...process.env };
  process.env.FUCINA_ALLOWED_ACTORS = "andrea";
  try {
    assertAuthorizedWithGh({ label: "fucina:explore", kind: "issue", number: 1, title: "x", actor: "andrea", body: "" }, () => { throw new Error("gh should not run"); });
    assert.throws(() => assertAuthorizedWithGh({ label: "fucina:explore", kind: "issue", number: 1, title: "x", actor: "mallory", body: "" }, () => ""), /mallory is not allowed/);
  } finally {
    process.env = old;
  }
});

test("MVP labels contain only fucina operational labels", () => {
  assert.deepEqual(labels.map(([name]) => name), [
    "fucina:explore",
    "fucina:implement",
    "fucina:review",
    "fucina:address-feedback",
    "fucina:in-progress",
    "fucina:blocked",
  ]);
});

test("claudeCode installs the pinned Claude CLI package", () => {
  assert.equal(agentCliPackage("claudeCode"), "@anthropic-ai/claude-code");
});

test("agent JSON parser tolerates multiline summary strings", () => {
  const parsed = parseFucinaJson('<fucina>{"summary":"first line\nsecond line"}</fucina>');
  assert.equal(parsed.summary, "first line\nsecond line");
});

test("success comments link the workflow run", () => {
  assert.equal(withRunLink("done", "https://github.test/run/1"), "done\n\nWorkflow run: https://github.test/run/1");
});

test("install writes config and three least-privilege workflows without overwriting", () => {
  const repo = tmpRepo();
  install({ cwd: repo, force: false, yes: true });

  const configPath = join(repo, ".fucina/config.json");
  assert.ok(existsSync(configPath));
  assert.match(readFileSync(configPath, "utf8"), /"maxIterations": 1/);

  const issue = readFileSync(join(repo, ".github/workflows/fucina-issue.yml"), "utf8");
  const review = readFileSync(join(repo, ".github/workflows/fucina-review.yml"), "utf8");
  const mutate = readFileSync(join(repo, ".github/workflows/fucina-mutate.yml"), "utf8");

  assert.match(issue, /concurrency:[\s\S]*group: fucina-\$\{\{ github.repository \}\}[\s\S]*cancel-in-progress: false/);
  assert.match(issue, /issues: write/);
  assert.doesNotMatch(review, /contents: write/);
  assert.match(review, /pull-requests: write/);
  assert.match(mutate, /contents: write/);
  assert.doesNotMatch(review, /actions\/checkout/);
  assert.match(issue + review + mutate, /npx @vekexasia\/fucina@0\.0\.0 run/);

  writeFileSync(configPath, "mine");
  assert.throws(() => install({ cwd: repo, force: false, yes: true }), /Refusing to overwrite/);
  assert.equal(readFileSync(configPath, "utf8"), "mine");
  rmSync(repo, { recursive: true, force: true });
});

test("upgrade keeps existing config values including agentCliVersion", () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  const configPath = join(repo, ".fucina/config.json");
  writeFileSync(configPath, JSON.stringify({ agent: "pi", model: "m", agentCliVersion: "old" }));
  upgrade({ cwd: repo, skipLabels: true });
  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), {
    agent: "pi",
    model: "m",
    agentCliVersion: "old",
    maxIterations: 1,
    sensitiveInstructionPaths: [".fucina/**", ".github/workflows/**", "AGENTS.md", "CLAUDE.md", ".claude/**", ".codex/**", ".pi/**"],
  });
  rmSync(repo, { recursive: true, force: true });
});

test("config uses env before .fucina/config.json and keeps maxIterations default", () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  writeFileSync(join(repo, ".fucina/config.json"), JSON.stringify({ agent: "pi", model: "file-model", agentCliVersion: "1.2.3" }));
  const old = { ...process.env };
  process.env.FUCINA_AGENT = "codex";
  process.env.FUCINA_MODEL = "env-model";
  process.env.FUCINA_AGENT_CLI_VERSION = "9.9.9";
  try {
    assert.deepEqual(loadConfig(repo), { agent: "codex", model: "env-model", agentCliVersion: "9.9.9", maxIterations: 1, sensitiveInstructionPaths: [".fucina/**", ".github/workflows/**", "AGENTS.md", "CLAUDE.md", ".claude/**", ".codex/**", ".pi/**"] });
  } finally {
    process.env = old;
    rmSync(repo, { recursive: true, force: true });
  }
});

test("empty GitHub Actions vars do not override config file", () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  writeFileSync(join(repo, ".fucina/config.json"), JSON.stringify({ agent: "claudeCode", model: "file-model", agentCliVersion: "2.1.178" }));
  const old = { ...process.env };
  process.env.FUCINA_AGENT = "";
  process.env.FUCINA_MODEL = "";
  process.env.FUCINA_AGENT_CLI_VERSION = "";
  try {
    assert.equal(loadConfig(repo).agent, "claudeCode");
    assert.equal(loadConfig(repo).model, "file-model");
    assert.equal(loadConfig(repo).agentCliVersion, "2.1.178");
  } finally {
    process.env = old;
    rmSync(repo, { recursive: true, force: true });
  }
});

test("run simulates a label-triggered explore action end to end", async () => {
  const calls: string[][] = [];
  await runEvent({ label: "fucina:explore", kind: "issue", number: 7, title: "bug", actor: "andrea", body: "please inspect" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      return "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Looks real\"}</fucina>", commits: [], branch: "main" }),
    cwd: tmpRepo(),
    runUrl: "https://github.test/run/1",
  });

  assert.deepEqual(calls[0], ["issue", "edit", "7", "--remove-label", "fucina:explore"]);
  assert.ok(calls.some((args) => args.join(" ").includes("--remove-label fucina:blocked")));
  assert.ok(calls.some((args) => args.join(" ").includes("--add-label fucina:in-progress")));
  assert.ok(calls.some((args) => args[0] === "issue" && args[1] === "comment" && args.join("\n").includes("Looks real") && args.join("\n").includes("https://github.test/run/1")));
  assert.ok(calls.some((args) => args.join(" ").includes("--remove-label fucina:in-progress")));
});

test("implement composes repository instructions in safety, global, mode order", async () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina/instructions"), { recursive: true });
  writeFileSync(join(repo, ".fucina/instructions/safety.md"), "safety rules");
  writeFileSync(join(repo, ".fucina/instructions/global.md"), "global rules");
  writeFileSync(join(repo, ".fucina/instructions/implement.md"), "implement rules");
  let prompt = "";
  const calls: string[][] = [];
  await runEvent({ label: "fucina:implement", kind: "issue", number: 1, title: "split leftovers", actor: "andrea", body: "Inspect gaps" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      if (args[0] === "issue" && args[1] === "view" && args.includes("--comments")) return "maintainer: create issues for leftovers";
      return "";
    },
    agent: async (agentPrompt) => {
      prompt = agentPrompt;
      return { stdout: "<fucina>{\"summary\":\"Created follow-up issues\"}</fucina>", commits: [], branch: "main" };
    },
    sh() { return "0"; },
    cwd: repo,
  });

  assert.match(prompt, /Implement the issue with the smallest correct change/);
  assert.ok(prompt.indexOf("safety rules") < prompt.indexOf("global rules"));
  assert.ok(prompt.indexOf("global rules") < prompt.indexOf("implement rules"));
  assert.ok(prompt.indexOf("implement rules") < prompt.indexOf("create issues for leftovers"));
  assert.match(prompt, /Do not close issue #1/);
  assert.ok(calls.some((args) => args.join(" ") === "issue reopen 1"));
  assert.ok(calls.some((args) => args[0] === "issue" && args[1] === "comment" && args.includes("Created follow-up issues")));
  rmSync(repo, { recursive: true, force: true });
});

test("existing instruction paths must be markdown files", async () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina/instructions/safety.md"), { recursive: true });
  const calls: string[][] = [];
  await assert.rejects(() => runEvent({ label: "fucina:explore", kind: "issue", number: 3, title: "bad instructions", actor: "andrea", body: "" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      return "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"should not run\"}</fucina>", commits: [], branch: "main" }),
    cwd: repo,
  }), /Cannot load Fucina instruction .*safety\.md: is not a file/);
  assert.ok(calls.some((args) => args[0] === "issue" && args[1] === "comment" && args.join("\n").includes("Cannot load Fucina instruction")));
  rmSync(repo, { recursive: true, force: true });
});

test("implement pushes the branch before creating a PR", async () => {
  const calls: string[][] = [];
  await runEvent({ label: "fucina:implement", kind: "issue", number: 2, title: "Add thing", actor: "andrea", body: "Do it" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      if (args[0] === "issue" && args[1] === "view") return "";
      return "https://github.test/pr/9";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Done\"}</fucina>", commits: [{ sha: "abc" }], branch: "main" }),
    sh(args) { calls.push(["sh", ...args]); return args.includes("--count") ? "1" : ""; },
    cwd: tmpRepo(),
  });

  assert.ok(calls.some((args) => args.join(" ") === "sh git checkout -B fucina/issue-2-add-thing"));
  assert.ok(calls.some((args) => args.join(" ") === "sh git push --force-with-lease origin fucina/issue-2-add-thing"));
  assert.ok(calls.some((args) => args[0] === "pr" && args[1] === "create"));
});

test("sensitive path matching detects glob patterns", () => {
  const patterns = [".fucina/**", ".github/workflows/**", "CLAUDE.md"];
  assert.ok(matchesSensitivePaths([".fucina/config.json"], patterns));
  assert.ok(matchesSensitivePaths([".github/workflows/ci.yml"], patterns));
  assert.ok(matchesSensitivePaths(["CLAUDE.md"], patterns));
  assert.ok(matchesSensitivePaths(["src/index.ts", ".fucina/instructions/global.md"], patterns));
  assert.ok(!matchesSensitivePaths(["src/index.ts", "README.md"], patterns));
});

test("getSensitiveFiles filters only matching files", () => {
  const patterns = [".fucina/**", "AGENTS.md"];
  const files = ["src/app.ts", ".fucina/config.json", "AGENTS.md", "docs/guide.md"];
  assert.deepEqual(getSensitiveFiles(files, patterns), [".fucina/config.json", "AGENTS.md"]);
});

test("review blocks untrusted PR author modifying sensitive paths", async () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  writeFileSync(join(repo, ".fucina/config.json"), JSON.stringify({
    agent: "claudeCode",
    model: "test",
    agentCliVersion: "1.0.0",
    sensitiveInstructionPaths: [".fucina/**", "CLAUDE.md"]
  }));

  let error: Error | undefined;
  try {
    await runEvent({ label: "fucina:review", kind: "pull_request", number: 10, title: "Update config", actor: "reviewer" }, {
      gh(args) {
        const argsStr = args.join(" ");
        if (args[0] === "api" && argsStr.includes("/collaborators/reviewer/permission")) return "write";
        if (args[0] === "api" && argsStr.includes("/collaborators/untrusted/permission")) return "read";
        if (argsStr.includes("/pulls/10/files")) {
          return JSON.stringify([{ filename: ".fucina/config.json" }]);
        }
        if (argsStr.includes("/pulls/10") && argsStr.includes("--jq") && argsStr.includes(".")) {
          return JSON.stringify({ user: { login: "untrusted" }, head: { sha: "a".repeat(40) } });
        }
        return "";
      },
      agent: async () => ({ stdout: "<fucina>{\"summary\":\"LGTM\"}</fucina>", commits: [], branch: "main" }),
      cwd: repo,
    });
  } catch (err) {
    error = err as Error;
  }

  assert.ok(error);
  assert.match(error!.message, /untrusted/);
  assert.match(error!.message, /\.fucina\/config\.json/);
  assert.match(error!.message, /trust-instructions/);
  assert.match(error!.message, new RegExp("a".repeat(40)));
  rmSync(repo, { recursive: true, force: true });
});

test("review allows authorized actor to modify sensitive paths", async () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  writeFileSync(join(repo, ".fucina/config.json"), JSON.stringify({
    agent: "claudeCode",
    model: "test",
    agentCliVersion: "1.0.0",
    sensitiveInstructionPaths: [".fucina/**"]
  }));

  const calls: string[][] = [];
  await runEvent({ label: "fucina:review", kind: "pull_request", number: 20, title: "Safe config", actor: "reviewer" }, {
    gh(args) {
      calls.push(args);
      const argsStr = args.join(" ");
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      if (argsStr.includes("/pulls/20/files")) {
        return JSON.stringify([{ filename: ".fucina/config.json" }]);
      }
      if (argsStr.includes("/pulls/20") && argsStr.includes("--jq") && argsStr.includes(".") && !argsStr.includes("/files")) {
        return JSON.stringify({ user: { login: "maintainer" }, head: { sha: "b".repeat(40) } });
      }
      if (argsStr.includes("Accept: application/vnd.github.v3.diff")) {
        return "diff content";
      }
      return "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Approved\"}</fucina>", commits: [], branch: "main" }),
    cwd: repo,
  });

  assert.ok(calls.some((args) => args[0] === "pr" && args[1] === "review"));
  rmSync(repo, { recursive: true, force: true });
});

test("trust-instructions triggers review for matching SHA", async () => {
  const fullSha = "c".repeat(40);
  const calls: string[][] = [];
  await runEvent({ label: `/fucina trust-instructions ${fullSha}`, kind: "pull_request", number: 30, title: "PR", actor: "admin" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "admin";
      if (args[0] === "api") return JSON.stringify({ head: { sha: fullSha } });
      return "";
    },
    agent: async () => ({ stdout: "", commits: [], branch: "main" }),
    cwd: tmpRepo(),
  });

  assert.ok(calls.some((args) => args.join(" ").includes("--remove-label fucina:review")));
  assert.ok(calls.some((args) => args.join(" ").includes("--remove-label fucina:blocked")));
  assert.ok(calls.some((args) => args.join(" ").includes("--add-label fucina:review")));
  assert.ok(calls.some((args) => args[0] === "pr" && args[1] === "comment" && args.join("\n").includes("trusted")));
});

test("trust-instructions rejects mismatched SHA", async () => {
  const requestedSha = "d".repeat(40);
  const actualSha = "e".repeat(40);
  let error: Error | undefined;
  try {
    await runEvent({ label: `/fucina trust-instructions ${requestedSha}`, kind: "pull_request", number: 40, title: "PR", actor: "admin" }, {
      gh(args) {
        if (args[0] === "api" && args.at(-1) === ".permission") return "admin";
        if (args[0] === "api") return JSON.stringify({ head: { sha: actualSha } });
        return "";
      },
      agent: async () => ({ stdout: "", commits: [], branch: "main" }),
      cwd: tmpRepo(),
    });
  } catch (err) {
    error = err as Error;
  }

  assert.ok(error);
  assert.match(error!.message, /SHA mismatch/);
  assert.match(error!.message, new RegExp(actualSha.substring(0, 7)));
  assert.match(error!.message, new RegExp(requestedSha.substring(0, 7)));
});

test("slash command workflow is generated during install", () => {
  const repo = tmpRepo();
  install({ cwd: repo, force: false, yes: true });
  const slashWorkflow = readFileSync(join(repo, ".github/workflows/fucina-slash.yml"), "utf8");
  assert.match(slashWorkflow, /issue_comment/);
  assert.match(slashWorkflow, /startsWith\(github\.event\.comment\.body, '\/fucina '\)/);
  assert.match(slashWorkflow, /concurrency:[\s\S]*group: fucina-\$\{\{ github.repository \}\}/);
  rmSync(repo, { recursive: true, force: true });
});

test("implement rejects closed issues before running the agent", async () => {
  let agentRan = false;
  await assert.rejects(() => runEvent({ label: "fucina:implement", kind: "issue", number: 1, title: "split leftovers", actor: "andrea", body: "Inspect gaps" }, {
    gh(args) {
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      if (args[0] === "issue" && args[1] === "view" && args.includes("state")) return "CLOSED";
      return "";
    },
    agent: async () => { agentRan = true; return { stdout: "<fucina>{\"summary\":\"Done\"}</fucina>", commits: [], branch: "main" }; },
    cwd: tmpRepo(),
  }), /issue #1 is not open/);
  assert.equal(agentRan, false);
});

test("implement retries malformed Fucina output and requires commits before PR creation", async () => {
  const calls: string[][] = [];
  let attempts = 0;
  await runEvent({ label: "fucina:implement", kind: "issue", number: 3, title: "Retry output", actor: "andrea", body: "Do it" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      if (args[0] === "issue" && args[1] === "view" && args.includes("state")) return "OPEN";
      if (args[0] === "issue" && args[1] === "view") return "";
      return "https://github.test/pr/9";
    },
    agent: async () => ({ stdout: ++attempts === 1 ? "<fucina>{nope}</fucina>" : "<fucina>{\"summary\":\"Done\"}</fucina>", commits: [{ sha: "abc" }], branch: "main" }),
    sh(args) { calls.push(["sh", ...args]); return args.includes("--count") ? "1" : ""; },
    cwd: tmpRepo(),
  });
  assert.equal(attempts, 2);
  assert.ok(calls.some((args) => args[0] === "pr" && args[1] === "create"));
});

test("implement comments instead of creating a PR when no commits exist", async () => {
  const calls: string[][] = [];
  await runEvent({ label: "fucina:implement", kind: "issue", number: 4, title: "No commits", actor: "andrea", body: "Do it" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      if (args[0] === "issue" && args[1] === "view" && args.includes("state")) return "OPEN";
      if (args[0] === "issue" && args[1] === "view") return "";
      return "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Did bookkeeping\"}</fucina>", commits: [], branch: "main" }),
    sh(args) { calls.push(["sh", ...args]); return args.includes("--count") ? "0" : ""; },
    cwd: tmpRepo(),
  });
  assert.equal(calls.some((args) => args[0] === "pr" && args[1] === "create"), false);
  assert.ok(calls.some((args) => args[0] === "issue" && args[1] === "comment" && args.includes("Did bookkeeping")));
});

test("agent JSON parser validates output shape", () => {
  assert.throws(() => parseFucinaJson("<fucina>{\"summary\":1}</fucina>"), /summary must be a string/);
});

test("address-feedback pushes with force-with-lease against starting SHA", async () => {
  const calls: string[][] = [];
  await addressFeedback({ label: "fucina:address-feedback", kind: "pull_request", number: 5, title: "Feedback", actor: "andrea", body: "" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "pr" && args[1] === "view" && args.includes("--json")) return JSON.stringify({ isCrossRepository: false, headRefName: "feature", headRefOid: "abc123" });
      return "comments";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Fixed\"}</fucina>", commits: [{ sha: "def" }], branch: "feature" }),
    sh(args) { calls.push(["sh", ...args]); return ""; },
  });
  assert.ok(calls.some((args) => args.join(" ") === "sh git push --force-with-lease=feature:abc123 origin HEAD:feature"));
});

test("address-feedback refuses success without commits or comments", async () => {
  await assert.rejects(() => addressFeedback({ label: "fucina:address-feedback", kind: "pull_request", number: 6, title: "Feedback", actor: "andrea", body: "" }, {
    gh(args) {
      if (args[0] === "pr" && args[1] === "view" && args.includes("--json")) return JSON.stringify({ isCrossRepository: false, headRefName: "feature", headRefOid: "abc123" });
      return "comments";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"\"}</fucina>", commits: [], branch: "feature" }),
  }), /produced no useful commit or comment/);
});

test("review rejects agent mutations", async () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  writeFileSync(join(repo, ".fucina/config.json"), JSON.stringify({ agent: "pi", model: "test", agentCliVersion: "1.0.0" }));
  await assert.rejects(() => review({ label: "fucina:review", kind: "pull_request", number: 7, title: "Review", actor: "andrea", body: "" }, {
    gh(args) {
      const argsStr = args.join(" ");
      if (argsStr.includes("/pulls/7/files")) return "[]";
      if (argsStr.includes("/pulls/7") && argsStr.includes("--jq")) return JSON.stringify({ user: { login: "andrea" }, head: { sha: "abc" } });
      return args[0] === "api" ? "diff" : "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Looks good\"}</fucina>", commits: [{ sha: "bad" }], branch: "feature" }),
    cwd: repo,
  }), /must not mutate/);
  rmSync(repo, { recursive: true, force: true });
});

test("review succeeds without inspecting a checkout", async () => {
  const repo = tmpRepo();
  mkdirSync(join(repo, ".fucina"));
  writeFileSync(join(repo, ".fucina/config.json"), JSON.stringify({ agent: "pi", model: "test", agentCliVersion: "1.0.0" }));
  const calls: string[][] = [];
  await review({ label: "fucina:review", kind: "pull_request", number: 8, title: "Review", actor: "andrea", body: "" }, {
    gh(args) {
      calls.push(args);
      const argsStr = args.join(" ");
      if (argsStr.includes("/pulls/8/files")) return "[]";
      if (argsStr.includes("/pulls/8") && argsStr.includes("--jq")) return JSON.stringify({ user: { login: "andrea" }, head: { sha: "abc" } });
      return args[0] === "api" ? "diff" : "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"Looks good\"}</fucina>", commits: [], branch: "feature" }),
    cwd: repo,
  });
  assert.ok(calls.some((args) => args.join(" ") === "pr review 8 --comment --body Looks good"));
  rmSync(repo, { recursive: true, force: true });
});

test("invalid label is blocked and cleaned up", async () => {
  const calls: string[][] = [];
  await assert.rejects(() => runEvent({ label: "fucina:unknown", kind: "issue", number: 9, title: "bad label", actor: "andrea", body: "" }, {
    gh(args) {
      calls.push(args);
      if (args[0] === "api" && args.at(-1) === ".permission") return "write";
      return "";
    },
    agent: async () => ({ stdout: "<fucina>{\"summary\":\"nope\"}</fucina>", commits: [], branch: "main" }),
    cwd: tmpRepo(),
  }), /fucina:unknown is not valid for issue/);
  assert.ok(calls.some((args) => args.join(" ") === "issue edit 9 --add-label fucina:blocked"));
  assert.ok(calls.some((args) => args.join(" ") === "issue edit 9 --remove-label fucina:in-progress"));
});
