import type { FucinaEvent } from "../event.js";

export async function explore(event: FucinaEvent) {
  console.log(`Explore issue #${event.number}: ${event.title}`);
  throw new Error("fucina:explore is scaffolded but not implemented yet");
}
