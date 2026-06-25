#!/usr/bin/env node
import { installLabels } from "./install-labels.js";
import { run } from "./run.js";

const command = process.argv[2];

try {
  if (command === "install-labels") installLabels();
  else if (command === "run") await run();
  else {
    console.error("Usage: fucina <install-labels|run>");
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
