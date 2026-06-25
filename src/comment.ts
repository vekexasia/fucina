export function withRunLink(body: string, runUrl?: string) {
  return runUrl ? `${body}\n\nWorkflow run: ${runUrl}` : body;
}
