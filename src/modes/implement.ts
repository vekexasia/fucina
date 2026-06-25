import type { FucinaEvent } from "../event.js";

export async function implement(event: FucinaEvent) {
  console.log(`Implement ${event.kind} #${event.number}: ${event.title}`);
  throw new Error("fucina:implement is scaffolded but not implemented yet");
}
