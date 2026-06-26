import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { loadConfig } from "./config.js";

const require = createRequire(import.meta.url);
const version = require("../package.json").version;

type GenerateOptions = { cwd?: string };

export function generateSchedules(options: GenerateOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(cwd);

  if (!config.scheduledPrompts || config.scheduledPrompts.length === 0) {
    console.log("No scheduled prompts configured in .fucina/config.json");
    return;
  }

  for (const scheduledPrompt of config.scheduledPrompts) {
    const filename = `fucina-schedule-${scheduledPrompt.name}.yml`;
    const filepath = join(cwd, ".github/workflows", filename);
    const content = scheduleWorkflow(scheduledPrompt.name, scheduledPrompt.schedule);
    writeFileSync(filepath, content);
    console.log(`Generated ${filename}`);
  }
}

function scheduleWorkflow(name: string, schedule: string) {
  return `name: Fucina Schedule: ${name}

on:
  schedule:
    - cron: '${schedule}'
  workflow_dispatch:

concurrency:
  group: fucina-\${{ github.repository }}
  cancel-in-progress: false

permissions:
      contents: write
      pull-requests: write

jobs:
  fucina-schedule:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run Fucina Scheduled Prompt
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GH_TOKEN: \${{ secrets.AGENT_PAT || secrets.GITHUB_TOKEN }}
          AGENT_PAT: \${{ secrets.AGENT_PAT }}
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          FUCINA_AGENT: \${{ vars.FUCINA_AGENT }}
          FUCINA_MODEL: \${{ vars.FUCINA_MODEL }}
          FUCINA_AGENT_CLI_VERSION: \${{ vars.FUCINA_AGENT_CLI_VERSION }}
          FUCINA_MAX_ITERATIONS: \${{ vars.FUCINA_MAX_ITERATIONS }}
          FUCINA_SCHEDULE_NAME: ${name}
        run: npx @vekexasia/fucina@${version} run
`;
}
