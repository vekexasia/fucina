import { readFileSync } from "node:fs";

export type FucinaEvent = {
  label: string;
  kind: "issue" | "pull_request";
  number: number;
  title: string;
};

export function readEvent(): FucinaEvent {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error("GITHUB_EVENT_PATH is missing");

  const event = JSON.parse(readFileSync(path, "utf8"));
  const label = event.label?.name;
  if (typeof label !== "string") throw new Error("Event has no label name");

  if (event.issue) {
    return { label, kind: "issue", number: event.issue.number, title: event.issue.title };
  }
  if (event.pull_request) {
    return { label, kind: "pull_request", number: event.pull_request.number, title: event.pull_request.title };
  }
  throw new Error("Unsupported GitHub event");
}
