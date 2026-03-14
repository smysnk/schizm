import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  formatCanvasValidationError,
  validateCanvasState
} from "./canvas-validator";

const createTempDirectory = async () =>
  mkdtemp(path.join(os.tmpdir(), "schizm-canvas-validator-"));

test("validateCanvasState reports a missing canonical canvas when required", async () => {
  const repoRoot = await createTempDirectory();
  const knowledgeRoot = path.join(repoRoot, "obsidian-repository");

  try {
    await mkdir(knowledgeRoot, { recursive: true });

    const report = await validateCanvasState({
      repoRoot,
      knowledgeRoot,
      requireCanonical: true
    });

    assert.equal(report.valid, false);
    assert.equal(report.canonicalExists, false);
    assert.match(
      formatCanvasValidationError(report, "Canvas validation failed"),
      /Canonical canvas is required/
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("validateCanvasState accepts a well-formed canonical canvas", async () => {
  const repoRoot = await createTempDirectory();
  const knowledgeRoot = path.join(repoRoot, "obsidian-repository");

  try {
    await mkdir(knowledgeRoot, { recursive: true });

    await writeFile(
      path.join(knowledgeRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            { id: "hub", type: "text", text: "Hub", x: 0, y: 0, width: 320, height: 180 },
            { id: "doc", type: "file", file: "README.md", x: 420, y: 0, width: 320, height: 220 }
          ],
          edges: [{ id: "edge-hub-doc", fromNode: "hub", toNode: "doc" }]
        },
        null,
        2
      )
    );

    const report = await validateCanvasState({
      repoRoot,
      knowledgeRoot,
      requireCanonical: true
    });

    assert.equal(report.valid, true);
    assert.equal(report.canonicalExists, true);
    assert.deepEqual(report.issues, []);
    assert.deepEqual(report.files, ["obsidian-repository/main.canvas"]);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("validateCanvasState flags canvas edges that reference missing nodes", async () => {
  const repoRoot = await createTempDirectory();
  const knowledgeRoot = path.join(repoRoot, "obsidian-repository");

  try {
    await mkdir(knowledgeRoot, { recursive: true });

    await writeFile(
      path.join(knowledgeRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [{ id: "hub", type: "text", text: "Hub", x: 0, y: 0 }],
          edges: [{ id: "edge-bad", fromNode: "hub", toNode: "missing" }]
        },
        null,
        2
      )
    );

    const report = await validateCanvasState({ repoRoot, knowledgeRoot });

    assert.equal(report.valid, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.message.includes('references missing toNode "missing"')
      )
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
