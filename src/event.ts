import { readFileSync } from "node:fs";

export type FucinaEvent = {
  label: string;
  kind: "issue" | "pull_request";
  number: number;
  title: string;
  actor: string;
  body?: string;
};

export function readEvent(): FucinaEvent {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error("GITHUB_EVENT_PATH is missing");

  const event = JSON.parse(readFileSync(path, "utf8"));
  const actor = event.sender?.login;
  if (typeof actor !== "string") throw new Error("Event has no sender login");

  if (event.comment) {
    const body = event.comment.body;
    if (typeof body === "string" && body.trim().startsWith("/fucina ")) {
      const label = body.trim().split("\n")[0];
      if (event.issue) {
        const isPR = !!event.issue.pull_request;
        return { label, actor, kind: isPR ? "pull_request" : "issue", number: event.issue.number, title: event.issue.title, body: event.issue.body };
      }
    }
  }

  const label = event.label?.name;
  if (typeof label !== "string") throw new Error("Event has no label name");

  if (event.issue) {
    return { label, actor, kind: "issue", number: event.issue.number, title: event.issue.title, body: event.issue.body };
  }
  if (event.pull_request) {
    return { label, actor, kind: "pull_request", number: event.pull_request.number, title: event.pull_request.title, body: event.pull_request.body };
  }
  throw new Error("Unsupported GitHub event");
}
