import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

import { defaultSensitiveInstructionPaths } from "./config.js";
import { installLabels } from "./install-labels.js";

const require = createRequire(import.meta.url);
const version = require("../package.json").version;

type InstallOptions = { cwd?: string; force?: boolean; yes?: boolean; skipLabels?: boolean };

export function install(options: InstallOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  writeNew(join(cwd, ".fucina/config.json"), JSON.stringify({ agent: "", model: "", agentCliVersion: "", maxIterations: 1, sensitiveInstructionPaths: defaultSensitiveInstructionPaths }, null, 2) + "\n", options.force);
  writeNew(join(cwd, ".github/workflows/fucina-issue.yml"), workflow("issues", "issues: write\n      pull-requests: write\n      contents: write", ["fucina:explore", "fucina:implement"]), options.force);
  writeNew(join(cwd, ".github/workflows/fucina-review.yml"), workflow("pull_request_target", "contents: read\n      pull-requests: write\n      issues: write", ["fucina:review"]), options.force);
  writeNew(join(cwd, ".github/workflows/fucina-mutate.yml"), workflow("pull_request_target", "contents: write\n      pull-requests: write\n      issues: write", ["fucina:address-feedback"], false), options.force);
  if (!options.skipLabels) installLabels();
}

export function upgrade(options: InstallOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const configPath = join(cwd, ".fucina/config.json");
  const current = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  const next = { ...{ agent: "", model: "", agentCliVersion: "", maxIterations: 1, sensitiveInstructionPaths: defaultSensitiveInstructionPaths }, ...current };
  writeNew(configPath, JSON.stringify(next, null, 2) + "\n", true);
  writeNew(join(cwd, ".github/workflows/fucina-issue.yml"), workflow("issues", "issues: write\n      pull-requests: write\n      contents: write", ["fucina:explore", "fucina:implement"]), true);
  writeNew(join(cwd, ".github/workflows/fucina-review.yml"), workflow("pull_request_target", "contents: read\n      pull-requests: write\n      issues: write", ["fucina:review"]), true);
  writeNew(join(cwd, ".github/workflows/fucina-mutate.yml"), workflow("pull_request_target", "contents: write\n      pull-requests: write\n      issues: write", ["fucina:address-feedback"], false), true);
  if (!options.skipLabels) installLabels();
}

function writeNew(path: string, content: string, force = false) {
  if (existsSync(path) && !force) throw new Error(`Refusing to overwrite ${path}; rerun with --force`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function workflow(event: "issues" | "pull_request_target", permissions: string, labels: string[], checkout = true) {
  return `name: Fucina ${event === "issues" ? "Issue" : labels[0] === "fucina:review" ? "Review" : "Mutation"}

on:
  ${event}:
    types: [labeled]

concurrency:
  group: fucina-\${{ github.repository }}
  cancel-in-progress: false

permissions:
      ${permissions}

jobs:
  fucina:
    if: \${{ ${labels.map((label) => `github.event.label.name == '${label}'`).join(" || ")} }}
    runs-on: ubuntu-latest
    steps:
${checkout ? `      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
` : ""}      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run Fucina
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GH_TOKEN: \${{ secrets.AGENT_PAT || secrets.GITHUB_TOKEN }}
          AGENT_PAT: \${{ secrets.AGENT_PAT }}
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          FUCINA_ALLOWED_ACTORS: \${{ vars.FUCINA_ALLOWED_ACTORS }}
          FUCINA_AGENT: \${{ vars.FUCINA_AGENT }}
          FUCINA_MODEL: \${{ vars.FUCINA_MODEL }}
          FUCINA_AGENT_CLI_VERSION: \${{ vars.FUCINA_AGENT_CLI_VERSION }}
          FUCINA_MAX_ITERATIONS: \${{ vars.FUCINA_MAX_ITERATIONS }}
        run: npx @vekexasia/fucina@${version} run
`;
}
