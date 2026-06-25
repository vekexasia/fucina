import { readEvent } from "./event.js";
import { ghOk } from "./gh.js";
import { explore } from "./modes/explore.js";
import { implement } from "./modes/implement.js";
import { review } from "./modes/review.js";
import { updateBranch } from "./modes/update-branch.js";

export async function run() {
  const event = readEvent();
  const target = event.kind === "issue" ? "issue" : "pr";

  ghOk([target, "edit", String(event.number), "--remove-label", event.label]);
  ghOk([target, "edit", String(event.number), "--remove-label", "fucina:blocked"]);
  ghOk([target, "edit", String(event.number), "--add-label", "fucina:in-progress"]);

  try {
    if (event.label === "fucina:explore" && event.kind === "issue") return await explore(event);
    if (event.label === "fucina:implement") return await implement(event);
    if (event.label === "fucina:review" && event.kind === "pull_request") return await review(event);
    if (event.label === "fucina:update-branch" && event.kind === "pull_request") return await updateBranch(event);
    throw new Error(`${event.label} is not valid for ${event.kind}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ghOk([target, "edit", String(event.number), "--add-label", "fucina:blocked"]);
    ghOk([target, "comment", String(event.number), "--body", `\`${event.label}\` failed.\n\n${message}`]);
    throw error;
  } finally {
    ghOk([target, "edit", String(event.number), "--remove-label", "fucina:in-progress"]);
  }
}
