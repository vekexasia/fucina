#!/usr/bin/env node
import { installLabels } from "./install-labels.js";
import { install, upgrade } from "./install.js";
import { run } from "./run.js";

const command = process.argv[2];
const force = process.argv.includes("--force");

try {
  if (command === "install") install({ force });
  else if (command === "upgrade") upgrade({ force: true });
  else if (command === "install-labels") installLabels();
  else if (command === "run") await run();
  else {
    console.error("Usage: fucina <install|upgrade|install-labels|run> [--force]");
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
