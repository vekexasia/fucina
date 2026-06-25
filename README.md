# Fucina

Issue dentro, PR fuori.

Fucina is a small wrapper for label-driven AI workflows on GitHub repos, inspired by Sandcastle's dogfood workflows.

## Labels

- `fucina:explore` - read-only issue triage
- `fucina:implement` - implement an issue or address PR feedback
- `fucina:review` - automated PR review
- `fucina:update-branch` - update a PR branch, resolving conflicts when needed
- `fucina:in-progress` - workflow is running
- `fucina:blocked` - workflow failed or refused to run
- `ready-for-fucina` - human triage says the issue is ready
- `ready-for-human`, `needs-triage`, `needs-info`

## Install in a repo

```bash
npm i -D @vekex/fucina
npx fucina install-labels
mkdir -p .github/workflows
cp node_modules/@vekex/fucina/templates/.github/workflows/fucina.yml .github/workflows/fucina.yml
```

Required secret:

- `CLAUDE_CODE_OAUTH_TOKEN`

Optional secret:

- `AGENT_PAT` - needed when the workflow must trigger another workflow by adding labels.

## Local development

```bash
npm install
npm run typecheck
npm run build
```
