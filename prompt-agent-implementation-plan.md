# Prompt Agent Implementation Plan

## Purpose

Implement a Codex CLI driven prompt-processing loop inside this repo so a user can submit an idea from the frontend, persist it as a `prompt` row, have a coding agent reorganize the repository's markdown knowledge base and Obsidian canvas, append a structured audit trail, and then commit and push the resulting repo changes.

This plan is intentionally focused on the implementation architecture and rollout order, not the final product copy or visual design.

## Primary Goal

Turn the repo into a living, Obsidian-oriented mind map where:

- user prompts enter through the app UI
- each prompt is stored and tracked in Postgres
- Codex CLI evaluates the prompt against the existing markdown and canvas content
- the repo is reorganized when appropriate
- the central canvas inside `obsidian-repository/` stays aligned with the markdown corpus
- every round is appended to `obsidian-repository/audit.md`
- each round ends with a commit, push, and audit sync back into the originating `prompt` row

## Scope

### In scope

- prompt persistence in Postgres
- GraphQL API for creating and reading prompt state
- frontend prompt submission interface
- a server-side prompt runner that invokes Codex CLI
- a `program.md` contract describing the agent's responsibilities
- audit logging and post-run audit synchronization
- commit and push as part of the automated round

### Out of scope for the first pass

- multi-agent concurrency
- realtime subscriptions
- advanced canvas auto-layout algorithms
- rich auth / permissions
- retry orchestration beyond basic failure handling
- branch/PR workflows more complex than a single managed automation branch

## High-Level Architecture

The existing monorepo remains the control plane:

1. The web app submits text through a GraphQL mutation.
2. The server inserts a `prompt` row with `queued` status.
3. A background prompt runner claims the next queued prompt.
4. The runner invokes `codex exec` in this repository with a strict instruction contract.
5. Codex scans markdown files and Obsidian canvas files inside `obsidian-repository/`, decides how to reorganize content, updates files, updates the canonical canvas, appends `obsidian-repository/audit.md`, commits, and pushes.
6. A local helper script parses the resulting `obsidian-repository/audit.md` entry and writes structured audit data plus branch/SHA back into the current `prompt.audit`.
7. The frontend polls prompt status and surfaces progress/results.

## Data Model

Create a new `prompts` table.

### Required columns

- `id uuid primary key default gen_random_uuid()`
- `content text not null`
- `status text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `audit jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Recommended columns

- `started_at timestamptz`
- `finished_at timestamptz`
- `error_message text`

### Recommended indexes

- index on `status`
- index on `created_at desc`

## Prompt Status Model

Use explicit lifecycle statuses so the UI and backend can both reason about progress:

- `queued`
- `scanning`
- `deciding`
- `writing`
- `updating_canvas`
- `auditing`
- `committing`
- `pushing`
- `syncing_audit`
- `completed`
- `failed`

`metadata` should capture machine-readable execution details and decisions made by the coding agent.

`audit` should capture the parsed end-of-round audit record plus git metadata for that specific prompt.

## GraphQL Additions

Add a new `Prompt` type and prompt-focused query/mutation surface.

### Query additions

- `prompt(id: ID!): Prompt`
- `prompts(limit: Int): [Prompt!]!`

### Mutation additions

- `createPrompt(input: CreatePromptInput!): Prompt!`

### Prompt shape

- `id`
- `content`
- `status`
- `metadata`
- `audit`
- `createdAt`
- `updatedAt`
- optional `startedAt`
- optional `finishedAt`
- optional `errorMessage`

### Backend modules to add

- `packages/server/src/repositories/prompt-repository.ts`
- `packages/server/src/services/prompt-runner.ts`

## Frontend Changes

Add a prompt submission area to the existing interface.

### First-pass UI requirements

- a multiline text input
- a submit button
- disabled/loading state during mutation submission
- mutation error display
- a recent prompts list with status badges
- periodic polling for prompt progress

### Behavior

- submitting text creates a new `prompt` row via GraphQL
- the newly created prompt is shown immediately in the recent prompt list
- the interface polls `prompt(id)` or `prompts(limit)` every few seconds
- status and final audit details become visible without requiring a page refresh

### Implementation preference

Keep the first version simple:

- no subscriptions
- no optimistic complex UI beyond local insertion of the new prompt
- no separate dashboard route unless the current page becomes too crowded

## Codex CLI Integration

Codex CLI is the executor for the repo-organizing round.

### Runner responsibilities

The server-side prompt runner should:

1. find the oldest `queued` prompt
2. atomically mark it as started
3. invoke `codex exec` non-interactively in this repo
4. stream or capture execution output
5. advance prompt status as phases complete
6. parse the final structured output from Codex
7. run the audit sync helper
8. mark the prompt `completed` or `failed`

### Invocation strategy

Use `codex exec` with:

- repo root as working directory
- non-interactive execution
- a structured output schema
- an output file for the final message

Representative shape:

```bash
codex exec \
  -C /Users/josh/play/schizm \
  -s danger-full-access \
  --output-schema /Users/josh/play/schizm/schemas/codex-run-output.schema.json \
  --output-last-message /Users/josh/play/schizm/.codex-runs/<prompt-id>/final.json \
  -
```

Feed the prompt instructions through stdin so the backend can assemble them dynamically.

### Why `danger-full-access`

The agent needs to:

- inspect and modify arbitrary markdown files
- create, move, rename, and delete files
- update the Obsidian canvas JSON inside `obsidian-repository/`
- append `obsidian-repository/audit.md`
- run git commit and git push

Those tasks require broad write access within the repo.

## `program.md` Contract

Add a new root file:

- `/Users/josh/play/schizm/program.md`

It should follow the spirit and structure of `references/autoresearch/program.md`, but for this repository-maintenance workflow.

### Required sections

- `Purpose`
- `Scope`
- `Canonical Artifacts`
- `Decision Modes`
- `Markdown Operations`
- `Canvas Contract`
- `Audit Contract`
- `Git Contract`
- `Structured Final Output`
- `Failure Handling`

### Core behavioral contract

The coding agent should:

- read the submitted prompt content
- scan the existing markdown corpus inside `obsidian-repository/`
- scan the existing Obsidian canvas files inside `obsidian-repository/`, especially the canonical canvas
- decide whether to:
  1. create a new document
  2. integrate into an existing document, including removing invalidated content
  3. append and reorganize within an existing document
- update the main canvas to reflect the revised knowledge graph
- append a structured section to `obsidian-repository/audit.md`
- commit and push the resulting repo changes

### Allowed file operations

The contract should explicitly allow:

- create markdown files
- modify markdown files
- delete markdown files
- rename markdown files
- move markdown files
- merge markdown files
- update the canonical canvas file in `obsidian-repository/`

### Canonical canvas

Define one canonical canvas path in `program.md`.

Suggested first version:

- `/Users/josh/play/schizm/obsidian-repository/main.canvas`

## Audit Design

Create:

- `/Users/josh/play/schizm/obsidian-repository/audit.md`

Each run appends one strict section.

### Required audit fields

- date/time
- prompt id
- input prompt
- files added
- files modified
- files deleted
- files renamed or moved
- rationale for each change
- canvas updates performed
- git branch
- git commit SHA

### Recommended audit section format

Use both human-readable markdown and machine-parseable markers:

```md
<!-- PROMPT-AUDIT-START:<prompt-id> -->
## Prompt Round

- Date: ...
- Prompt ID: ...
- Input Prompt: ...

### Files Added
- `path`: rationale

### Files Modified
- `path`: rationale

### Files Deleted
- `path`: rationale

### Canvas Updates
- `obsidian-repository/main.canvas`: rationale

### Git
- Branch: ...
- Commit: ...

```json
{
  "promptId": "...",
  "branch": "...",
  "sha": "...",
  "added": [],
  "modified": [],
  "deleted": [],
  "moved": [],
  "canvas": [],
  "rationales": {}
}
```
<!-- PROMPT-AUDIT-END:<prompt-id> -->
```

This makes the file readable to humans while remaining reliable to parse.

## Audit Sync Helper

Add a local helper CLI invoked after each Codex run:

- `/Users/josh/play/schizm/scripts/sync-prompt-audit.ts`

### Responsibilities

- locate the audit section for the current prompt id
- parse the structured content from `obsidian-repository/audit.md`
- read the current git branch and commit SHA
- update `prompts.audit`
- enrich the audit JSON with branch and SHA if they were not already present

### Stored audit payload

The `audit` jsonb value should include:

- `promptId`
- `recordedAt`
- `branch`
- `sha`
- `added`
- `modified`
- `deleted`
- `moved`
- `canvas`
- `rationales`
- optional `rawSection`

## Metadata Design

Use `metadata` for machine-oriented execution and decision tracking.

Suggested shape:

```json
{
  "runner": {
    "claimedAt": "",
    "startedAt": "",
    "finishedAt": "",
    "codexCommand": ""
  },
  "scan": {
    "markdownFilesConsidered": [],
    "canvasFilesConsidered": []
  },
  "decision": {
    "mode": "create|integrate|append",
    "targetFiles": [],
    "notes": ""
  },
  "execution": {
    "statusTransitions": [],
    "finalSummary": {}
  }
}
```

The backend should own runner timestamps and status transitions.

The agent should own reasoning-oriented fields, target files, and final summary content.

## Runner Concurrency Model

Keep v1 single-threaded.

### Reasons

- all runs mutate the same repository
- all runs will touch shared markdown and canvas files
- all runs perform commit and push
- concurrent runs create unnecessary merge and branch contention

### Enforcement

- claim only one queued prompt at a time
- do not start another run while one prompt is in a non-terminal active status

## Git Strategy

The agent must commit and push at the end of each round.

### Recommended initial strategy

Use one managed automation branch, for example:

- `codex/mindmap`

### Why

- avoids mutating the user's incidental working branch
- makes automation history easier to inspect
- reduces surprise when the tool runs unattended

### Required git steps inside the agent contract

- inspect working tree
- stage intended changes
- create a commit with a predictable format including prompt id
- push to the configured remote branch

### Commit message suggestion

```text
prompt(<prompt-id>): reorganize knowledge base for submitted idea
```

## Failure Handling

Failure states need to be survivable and easy to inspect.

### On runner startup

Any prompt left in an active state from a previous crash should be moved to:

- `failed`

and annotated in `metadata` with a recovery note.

### On Codex CLI failure

- capture stderr/stdout references in `metadata`
- store a concise `error_message`
- leave partial file changes untouched for inspection unless a later cleanup policy is added

### On audit sync failure

- mark status `failed`
- preserve Codex output paths in `metadata`
- do not silently discard the run

## Rollout Plan

### Phase 1: prompt persistence and API

- add prompt migration
- add prompt repository
- add GraphQL `Prompt` type
- add `createPrompt`
- add `prompt` and `prompts` queries

### Phase 2: frontend prompt entry

- add prompt input UI
- wire mutation submission
- add recent prompt status list
- add polling

### Phase 3: repo-agent contract

- add `program.md`
- add `obsidian-repository/audit.md`
- add output JSON schema for Codex final response

### Phase 4: background execution

- add `prompt-runner.ts`
- add child-process integration for `codex exec`
- add status transitions
- capture structured final output

### Phase 5: audit reconciliation

- add `scripts/sync-prompt-audit.ts`
- parse `obsidian-repository/audit.md`
- sync audit JSON back into the prompt row
- append git branch/SHA

### Phase 6: hardening

- startup recovery
- failure telemetry
- canvas validation
- better prompt list/history UI

## Concrete File Additions and Changes

### New files

- `/Users/josh/play/schizm/program.md`
- `/Users/josh/play/schizm/obsidian-repository/audit.md`
- `/Users/josh/play/schizm/prompt-agent-implementation-plan.md`
- `/Users/josh/play/schizm/packages/server/src/repositories/prompt-repository.ts`
- `/Users/josh/play/schizm/packages/server/src/services/prompt-runner.ts`
- `/Users/josh/play/schizm/scripts/sync-prompt-audit.ts`
- `/Users/josh/play/schizm/schemas/codex-run-output.schema.json`

### Existing files likely to change

- `/Users/josh/play/schizm/packages/server/src/db/migrations.ts`
- `/Users/josh/play/schizm/packages/server/src/graphql/schema.ts`
- `/Users/josh/play/schizm/packages/server/src/graphql/resolvers.ts`
- `/Users/josh/play/schizm/packages/server/src/index.ts`
- `/Users/josh/play/schizm/packages/web/src/lib/graphql.ts`
- `/Users/josh/play/schizm/packages/web/src/components/canvas/idea-canvas.tsx`
- `/Users/josh/play/schizm/packages/server/package.json`
- `/Users/josh/play/schizm/package.json`

## Open Decisions

These should be resolved before full implementation or during Phase 1:

- exact canonical canvas path
- whether the automation should always use one fixed branch or a per-prompt branch
- whether pushes should go directly to the default remote or a dedicated automation remote/branch
- how much of the Codex final response is duplicated in `metadata` versus only kept in files
- whether prompt polling is sufficient or whether live updates are needed later

## Recommended First Deliverable

The first end-to-end milestone should be:

1. user submits a prompt
2. prompt row is created and visible in UI
3. background runner claims the row
4. Codex reads `program.md`
5. Codex makes a minimal markdown change inside `obsidian-repository/` and appends `obsidian-repository/audit.md`
6. Codex commits and pushes on the managed automation branch
7. audit sync helper stores parsed audit plus branch/SHA back into `prompt.audit`
8. UI shows `completed`

That milestone proves the full loop before more advanced canvas and knowledge-reorganization behavior is layered on top.
