import { minimatch } from "minimatch";

export function matchesSensitivePaths(files: string[], patterns: string[]): boolean {
  return files.some((file) => patterns.some((pattern) => minimatch(file, pattern)));
}

export function getSensitiveFiles(files: string[], patterns: string[]): string[] {
  return files.filter((file) => patterns.some((pattern) => minimatch(file, pattern)));
}
