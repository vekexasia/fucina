import type { FucinaEvent } from "../event.js";

export async function review(event: FucinaEvent) {
  console.log(`Review PR #${event.number}: ${event.title}`);
  throw new Error("fucina:review is scaffolded but not implemented yet");
}
