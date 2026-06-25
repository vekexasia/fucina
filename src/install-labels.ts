import { labels } from "./labels.js";
import { ghOk } from "./gh.js";

export function installLabels() {
  for (const [name, description, color] of labels) {
    const updated = ghOk(["label", "edit", name, "--description", description, "--color", color]);
    if (!updated) {
      ghOk(["label", "create", name, "--description", description, "--color", color]);
    }
    console.log(name);
  }
}
