# Fucina

Issue dentro, PR fuori.

Fucina is a thin layer over Sandcastle for label-driven AI workflows on GitHub.com repositories. Fucina owns labels, GitHub workflow conventions, prompts, configuration loading, and CLI setup; Sandcastle owns agent execution, sandboxing, branch strategy, sessions, and provider integration.

## MVP labels

Operational trigger labels are one-shot buttons: Fucina removes only the label that triggered the run when that run starts.

- `fucina:explore` - analyze an open issue and comment with findings
- `fucina:implement` - implement an open issue and create a draft PR
- `fucina:review` - publish a read-only GitHub PR Review
- `fucina:address-feedback` - address feedback on an internal PR branch
- `fucina:in-progress` - visible running state
- `fucina:blocked` - last run failed or was refused; removed on retry

There is no MVP readiness label, `fucina:queued`, or `fucina:update-branch`. Runs share repository-wide GitHub Actions concurrency with `cancel-in-progress: false`, so GitHub Actions is the queue.

## Install in a repo

```bash
npx @vekexasia/fucina@<version> install
```

`fucina install` writes workflows and `.fucina/config.json`, creates or updates labels, never commits, and does not overwrite existing files without confirmation or `--force`. Use `install-labels` only for label maintenance.

Target repositories pin Fucina in the generated workflows with `npx @vekexasia/fucina@<version>`; Fucina is not a repository dependency.

## Configuration

Fucina reads environment variables first, then optional `.fucina/config.json`. Required values must come from one of those sources.

Minimum config keys:

- `agent` - one of Sandcastle providers `claudeCode`, `codex`, or `pi`
- `model`
- `agentCliVersion` - pinned CLI version installed by Fucina
- `maxIterations` - optional, defaults to `1`

Optional repository variable:

- `FUCINA_ALLOWED_ACTORS` - comma-separated GitHub usernames allowed to run Fucina. When omitted, Fucina allows repository collaborators with write, maintain, or admin permission.

Optional secret:

- `AGENT_PAT` - Fucina uses `AGENT_PAT || GITHUB_TOKEN` and fails clearly when a PAT is required.

## Local development

```bash
npm install
npm run typecheck
npm run build
```
