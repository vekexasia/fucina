# Fucina

Fucina defines the language for label-driven AI workflows on GitHub.com repositories.

## Language

**Fucina**:
A thin workflow layer for turning GitHub labels into AI-assisted repository work. Fucina owns GitHub labels, workflow conventions, prompts, configuration loading, and CLI setup, while delegating agent execution, sandboxing, branch strategy, session handling, and provider integration to Sandcastle.
_Avoid_: agent runner, sandbox orchestrator, GitHub App

**Sandcastle**:
The underlying agent execution and sandboxing library used by Fucina. Sandcastle owns sandbox providers, branch strategies, session handling, and agent process execution.
_Avoid_: Fucina runtime

**Target Repository**:
A GitHub.com repository where Fucina workflows are enabled. A target repository carries generated workflows, `.fucina/config.json`, optional instructions, and secrets; it does not need Fucina as a package dependency.
_Avoid_: installed repo, package consumer

**Trigger Label**:
An operational `fucina:*` label that explicitly starts a Fucina workflow when added to an issue or pull request. If a label does not change Fucina behavior, it is not part of the MVP.
_Avoid_: readiness label, triage label

**Button Label**:
A trigger label treated as a one-shot button: Fucina removes only the label that triggered the run when that run starts, and retrying means adding the label again.
_Avoid_: persistent workflow state

**Issue Mode**:
A Fucina workflow that runs from an issue. MVP issue modes are `fucina:explore` and `fucina:implement`; `implement` applies only to open issues and creates a draft PR from the default branch.
_Avoid_: PR mutation mode

**Review Mode**:
The `fucina:review` workflow for open pull requests. It is read-only, may run on draft PRs, publishes a GitHub PR Review with event `COMMENT`, and must not edit files, commit, push, approve, request changes, or resolve threads.
_Avoid_: reviewer fix mode

**Feedback Mode**:
The `fucina:address-feedback` workflow for open internal PR branches. It may commit fixes, reply when useful, or decline feedback with a reason, but it never marks threads resolved and uses `--force-with-lease` against the starting head SHA.
_Avoid_: issue implementation mode

**State Label**:
A visible status label. `fucina:in-progress` means a run is active; `fucina:blocked` means the last run failed or was refused and is removed automatically on retry. There is no `fucina:queued`; GitHub Actions repository-wide concurrency is the queue.
_Avoid_: lock label

**Authorized Actor**:
A GitHub user allowed to trigger Fucina. If `FUCINA_ALLOWED_ACTORS` is configured, only those usernames are authorized; otherwise collaborators with write, maintain, or admin permission are authorized.
_Avoid_: any labeler

**Sensitive Instruction Path**:
A path whose changes can influence agent instructions, such as `.fucina/**`, `.github/workflows/**`, `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.codex/**`, or `.pi/**`. Untrusted PR changes to these paths block review until an Authorized Actor posts `/fucina trust-instructions <head-sha>`.
_Avoid_: ordinary source path

**Repository Instructions**:
Append-only Fucina instructions under `.fucina/instructions/safety.md`, `.fucina/instructions/global.md`, or `.fucina/instructions/<mode>.md`. Fucina does not automatically include `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, or ADRs in its prompts.
_Avoid_: prompt replacement, provider-native file
