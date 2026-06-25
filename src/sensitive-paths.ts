export function matchesSensitivePaths(files: string[], patterns: string[]): boolean {
  return files.some((file) => patterns.some((pattern) => matchesPattern(file, pattern)));
}

export function getSensitiveFiles(files: string[], patterns: string[]): string[] {
  return files.filter((file) => patterns.some((pattern) => matchesPattern(file, pattern)));
}

function matchesPattern(file: string, pattern: string) {
  if (pattern.endsWith("/**")) return file === pattern.slice(0, -3) || file.startsWith(pattern.slice(0, -2));
  return file === pattern;
}
