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

function tmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), "fucina-"));
  mkdirSync(join(dir, ".git"));
  return dir;
}

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
  assert.ok(calls.some((args) => args[0] === "issue" && args[1] === "comment" && args.includes("Looks real")));
  assert.ok(calls.some((args) => args.join(" ").includes("--remove-label fucina:in-progress")));
});

test("implement sees issue comments and can succeed without commits", async () => {
  const calls: string[][] = [];
  let prompt = "";
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
    cwd: tmpRepo(),
  });

  assert.match(prompt, /create issues for leftovers/);
  assert.ok(calls.some((args) => args[0] === "issue" && args[1] === "comment" && args.includes("Created follow-up issues")));
});
