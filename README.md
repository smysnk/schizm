# Schizm

Schizm is a prompt-driven knowledge operations workspace. It combines a Next.js frontend, a GraphQL API, Postgres-backed prompt state, and a Codex CLI runner to keep the contents of `./obsidian-repository` organized as a living Obsidian-style mind map.

## Purpose

The project is designed to turn a note repository into an actively maintained knowledge base rather than a passive document dump.

Each submitted prompt becomes a repository-maintenance round:

- related markdown files are reviewed
- ideas are integrated, appended, or split into new documents
- the canonical canvas in `obsidian-repository/` is updated to reflect the current concept map
- an audit entry is recorded in `obsidian-repository/audit.md`
- the result is committed and pushed through Git

## How It Works

1. A user submits a prompt from the web interface.
2. The API stores the prompt in Postgres and tracks its lifecycle status.
3. A background runner claims the next queued prompt and launches Codex CLI in an isolated git worktree created from the `codex/mindmap` automation branch.
4. Codex updates the relevant files inside `obsidian-repository/`, including `obsidian-repository/main.canvas` and `obsidian-repository/audit.md`, then commits and pushes the result.
5. A sync step writes the structured audit outcome, branch, and commit SHA back into the originating prompt record.

Only the document store under `obsidian-repository/` is intended to be modified by the coding agent. Application code and root-level project files remain read-only unless a human explicitly asks otherwise.

This keeps repository changes isolated, auditable, and tied to a specific prompt run.

## Repository Layout

- `packages/web`: Next.js application for the canvas UI, prompt submission, and prompt history.
- `packages/server`: Express and Apollo GraphQL server, Postgres access, migrations, and the prompt runner.
- `scripts/`: local helper scripts, including audit synchronization.
- `obsidian-repository/`: document store for markdown notes, the canonical canvas, and the append-only audit log.
- `obsidian-repository/main.canvas`: canonical Obsidian canvas that represents the current knowledge graph.
- `obsidian-repository/audit.md`: append-only log of completed prompt-processing rounds.

## Quick Start

1. Review `.env`, or copy `.env.example` to `.env` if you need a fresh local file.
2. Start Postgres with `docker compose up -d`.
3. Install dependencies with `yarn install`.
4. Start the app with `yarn dev`.

The root `dev` script runs through [mono-helper.yml](mono-helper.yml), and the runtime wrappers live in [scripts/mono-helper.sh](scripts/mono-helper.sh). `.env` is loaded first, then `mono-helper` assigns the first available `WEB_PORT` and `SERVER_PORT` block starting at `3000`. If the web app needs to target an external API instead of the local server, set `SERVER_URL` in `.env`.
