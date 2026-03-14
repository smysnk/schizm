# Schizm

`schizm` is a Yarn monorepo with a full-screen Next.js canvas frontend and an Apollo GraphQL server backed by Postgres.

## Structure

- `packages/web`: Next.js app with runtime-hydrated config, Apollo Client, and themeable canvas UI.
- `packages/server`: Express + Apollo Server API with Postgres migrations and demo graph seeding.
- `references/personal-website`: reference app used to mirror the workspace shape.

## Quick start

1. Review `.env` or copy `.env.example` to `.env` if you need a fresh local file.
2. Start Postgres with `docker compose up -d`.
3. Install dependencies with `yarn install`.
4. Start both packages with `yarn dev`.

The root `dev` script runs through [mono-helper.yml](mono-helper.yml), and the other runtime scripts are wrapped with `mono-helper` through [scripts/mono-helper.sh](scripts/mono-helper.sh). In both cases, `.env` is exported first and then `mono-helper` assigns the first free `WEB_PORT` / `SERVER_PORT` block starting at `3000`. If you need to point the web app at a fixed external API instead, set `SERVER_URL` in `.env`.

## Prompt processing

Queued prompt-processing runs execute in isolated git worktrees created from the `codex/mindmap` automation branch, so each prompt can update markdown, canvas, and audit artifacts without mutating the primary checkout in place.
