export const labels = [
  ["fucina:blocked", "Fucina workflow is blocked or failed", "D73A4A"],
  ["fucina:explore", "Run read-only exploration", "0E8A16"],
  ["fucina:implement", "Run implementation", "0E8A16"],
  ["fucina:in-progress", "Fucina workflow is running", "FBCA04"],
  ["fucina:review", "Run automated PR review", "0E8A16"],
  ["fucina:update-branch", "Update PR branch", "0E8A16"],
  ["ready-for-fucina", "Fully specified, ready for Fucina", "0E8A16"],
  ["ready-for-human", "Requires human implementation", "C2E0C6"],
  ["needs-triage", "Maintainer needs to evaluate this issue", "FBCA04"],
  ["needs-info", "Waiting on reporter for more information", "D876E3"],
] as const;
