# Prompt Audit Log

This file is append-only.

Each prompt-processing run must append exactly one section using the boundaries:

- `<!-- PROMPT-AUDIT-START:<prompt-id> -->`
- `<!-- PROMPT-AUDIT-END:<prompt-id> -->`

Each section must include:

- the date
- the prompt id
- the input prompt
- files added, modified, deleted, and moved
- canvas updates
- git branch and commit SHA
- rationale for every changed artifact
- one fenced `json` block with the machine-readable audit summary

No prompt rounds have been recorded yet.
