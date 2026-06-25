import type { FucinaEvent } from "../event.js";

export async function updateBranch(event: FucinaEvent) {
  console.log(`Update PR branch #${event.number}: ${event.title}`);
  throw new Error("fucina:update-branch is scaffolded but not implemented yet");
}
