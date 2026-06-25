import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const modePrompts: Record<string, string> = {
  explore: "Explore this issue read-only. Report difficulty, relevant files, verified claims, open questions, and a possible approach. Do not edit files.",
  implement: "Implement the issue with the smallest correct change. Run the project checks. Commit with a conventional commit message. Do not push.",
  review: "Review the PR read-only. Publish comments and a summary. Do not edit files, commit, or push. If changes are needed, explain them so the owner can add `fucina:address-feedback`.",
};

const maxInstructionBytes = 64 * 1024;

export function composeAgentPrompt(mode: string, taskPrompt: string, cwd = process.cwd()) {
  return [modePrompts[mode], loadInstructions(mode, cwd), taskPrompt].filter(Boolean).join("\n\n");
}

function loadInstructions(mode: string, cwd: string) {
  const dir = join(cwd, ".fucina/instructions");
  return ["safety", "global", mode].map((name) => readInstruction(join(dir, `${name}.md`))).filter(Boolean).join("\n\n");
}

function readInstruction(path: string) {
  if (!existsSync(path)) return "";
  try {
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error("is not a file");
    if (stat.size > maxInstructionBytes) throw new Error(`is too large (${stat.size} bytes, max ${maxInstructionBytes})`);
    const text = readFileSync(path, "utf8");
    if (text.includes("\0")) throw new Error("must be a markdown text file");
    return text.trim();
  } catch (error) {
    throw new Error(`Cannot load Fucina instruction ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
