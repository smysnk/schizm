# Program Battle-Test Scenarios

This directory contains formal scenario packs for testing the behavioral contract in `program.md`.

Each scenario pack lives in its own directory and contains:

- `scenario.json`: machine-readable scenario definition
- `seed/` or a shared seed reference: starting repository state used by the future harness

Shared reusable seeds live in `_shared/`.

Scenario packs currently target schema:

- `/Users/josh/play/schizm/schemas/program-battletest-scenario.schema.json`

These packs are intentionally declarative. They define:

- the prompt sequence
- the scenario theme
- round-level expectations
- checkpoints
- final semantic assertions

Phase 1 provides the spec and starter packs. Later phases will add the execution harness and evaluator that actually run these scenarios end to end.
