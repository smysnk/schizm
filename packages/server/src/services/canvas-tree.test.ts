import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getCanvasTreeSnapshot } from "./canvas-tree";

const createTempDirectory = async () => mkdtemp(path.join(os.tmpdir(), "schizm-canvas-tree-"));

test("getCanvasTreeSnapshot charts explicit canvas connections and keeps disconnected roots under the shared virtual root", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "fragments"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "concepts"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "practical"), { recursive: true });

    await writeFile(
      path.join(documentStoreRoot, "fragments", "focus.md"),
      "Focus note.\n",
      "utf8"
    );
    await writeFile(path.join(documentStoreRoot, "concepts", "canvas-child.md"), "Canvas child\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "tentative-child.md"), "Tentative child\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "fragments", "document-child.md"), "Document child\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "fragments", "context-parent-a.md"), "Context parent A\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "fragments", "context-parent-b.md"), "Context parent B\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "bridge-hub.md"), "Bridge hub\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "practical", "bridge-child.md"), "Bridge child\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "shared-desc.md"), "Shared descendant\n", "utf8");

    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            { id: "focus", type: "file", file: "fragments/focus.md", x: 40, y: 40 },
            { id: "canvas-child", type: "file", file: "concepts/canvas-child.md", x: 320, y: 40 },
            { id: "tentative-child", type: "file", file: "concepts/tentative-child.md", x: 320, y: 200 },
            { id: "document-child", type: "file", file: "fragments/document-child.md", x: 320, y: 360 },
            { id: "context-parent-a", type: "file", file: "fragments/context-parent-a.md", x: 320, y: 520 },
            { id: "context-parent-b", type: "file", file: "fragments/context-parent-b.md", x: 320, y: 680 },
            { id: "bridge-hub", type: "file", file: "concepts/bridge-hub.md", x: 320, y: 840 },
            { id: "bridge-child", type: "file", file: "practical/bridge-child.md", x: 600, y: 840 },
            { id: "shared-desc", type: "file", file: "concepts/shared-desc.md", x: 600, y: 520 }
          ],
          edges: [
            { id: "focus-canvas", fromNode: "focus", toNode: "canvas-child", label: "supports" },
            { id: "focus-tentative", fromNode: "focus", toNode: "tentative-child", label: "possible overlap" },
            { id: "focus-hub", fromNode: "focus", toNode: "bridge-hub", label: "feeds" },
            { id: "hub-bridge", fromNode: "bridge-hub", toNode: "bridge-child", label: "extends" },
            { id: "parent-a-shared", fromNode: "context-parent-a", toNode: "shared-desc", label: "supports" },
            { id: "parent-b-shared", fromNode: "context-parent-b", toNode: "shared-desc", label: "supports" }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasTreeSnapshot({
      documentStoreRoot,
      rootNodeId: "focus",
      maxDepth: 3,
      highlightedNotePaths: ["obsidian-repository/fragments/document-child.md", "concepts/shared-desc.md"]
    });

    assert.equal(snapshot.rootNodeId, "focus");
    assert.equal(snapshot.rootLabel, "focus");
    assert.equal(snapshot.maxDepthRequested, 3);
    assert.equal(snapshot.truncated, false);
    assert.equal(snapshot.summary.availableRootCount, 9);

    const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    assert.equal(nodeById.get("__virtual__/root")?.label, "root");
    assert.equal(nodeById.get("__virtual__/root")?.parentId, null);
    assert.equal(nodeById.get("__virtual__/root")?.virtual, true);

    assert.equal(nodeById.get("focus")?.depth, 0);
    assert.equal(nodeById.get("focus")?.parentId, "__virtual__/root");
    assert.equal(nodeById.get("canvas-child")?.relationshipFamily, "canvas");
    assert.equal(nodeById.get("tentative-child")?.relationshipFamily, "tentative-canvas");
    assert.equal(nodeById.get("tentative-child")?.tentative, true);
    assert.equal(nodeById.get("document-child")?.relationshipFamily, "root");
    assert.equal(nodeById.get("document-child")?.parentId, "__virtual__/root");
    assert.equal(nodeById.get("document-child")?.touchedByPrompt, true);
    assert.equal(nodeById.get("context-parent-a")?.relationshipFamily, "root");
    assert.equal(nodeById.get("context-parent-a")?.parentId, "__virtual__/root");
    assert.equal(nodeById.get("context-parent-b")?.relationshipFamily, "root");
    assert.equal(nodeById.get("context-parent-b")?.parentId, "__virtual__/root");
    assert.equal(nodeById.get("bridge-child")?.relationshipFamily, "canvas");
    assert.equal(nodeById.get("bridge-child")?.parentId, "bridge-hub");
    assert.equal(nodeById.get("shared-desc")?.depth, 1);
    assert.equal(nodeById.get("shared-desc")?.parentId, "context-parent-a");
    assert.deepEqual(nodeById.get("shared-desc")?.lineage, [
      "__virtual__/root",
      "context-parent-a"
    ]);
    assert.equal(nodeById.get("shared-desc")?.touchedByPrompt, true);

    assert.deepEqual(
      nodeById.get("focus")?.childIds,
      [
        "bridge-hub",
        "canvas-child",
        "tentative-child"
      ]
    );

    assert.equal(snapshot.summary.relationshipFamilyCounts.canvas, 4);
    assert.equal(snapshot.summary.relationshipFamilyCounts["tentative-canvas"], 1);
    assert.equal(snapshot.summary.relationshipFamilyCounts.document, 0);
    assert.equal(snapshot.summary.relationshipFamilyCounts.context, 0);
    assert.equal(snapshot.summary.relationshipFamilyCounts.bridge, 0);

    assert.equal(new Set(snapshot.nodes.map((node) => node.id)).size, snapshot.nodes.length);
    assert.equal(snapshot.links.length, snapshot.nodes.length - 1);
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasTreeSnapshot truncates descendants when maxDepth is reduced", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "concepts"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "branches"), { recursive: true });

    await writeFile(path.join(documentStoreRoot, "concepts", "root.md"), "Root\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "branches", "a.md"), "A\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "branches", "b.md"), "B\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "branches", "c.md"), "C\n", "utf8");

    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            { id: "root", type: "file", file: "concepts/root.md" },
            { id: "a", type: "file", file: "branches/a.md" },
            { id: "b", type: "file", file: "branches/b.md" },
            { id: "c", type: "file", file: "branches/c.md" }
          ],
          edges: [
            { id: "root-a", fromNode: "root", toNode: "a", label: "supports" },
            { id: "a-b", fromNode: "a", toNode: "b", label: "supports" },
            { id: "b-c", fromNode: "b", toNode: "c", label: "supports" }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasTreeSnapshot({
      documentStoreRoot,
      rootNodeId: "root",
      maxDepth: 1
    });

    assert.equal(snapshot.nodeCount, 3);
    assert.equal(snapshot.linkCount, 2);
    assert.equal(snapshot.maxDepthResolved, 1);
    assert.equal(snapshot.truncated, true);
    assert.equal(snapshot.summary.hiddenByDepthCount, 2);
    assert.deepEqual(
      snapshot.nodes.map((node) => node.id),
      ["__virtual__/root", "root", "a"]
    );
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasTreeSnapshot falls back to a stable default root when the requested root is missing", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "concepts"), { recursive: true });

    await writeFile(path.join(documentStoreRoot, "concepts", "alpha.md"), "Alpha\n", "utf8");

    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            { id: "text-z", type: "text", text: "Zed" },
            { id: "file-a", type: "file", file: "concepts/alpha.md" }
          ],
          edges: []
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasTreeSnapshot({
      documentStoreRoot,
      rootNodeId: "does-not-exist"
    });

    assert.equal(snapshot.rootNodeId, "file-a");
    assert.equal(snapshot.availableRoots[0]?.id, "file-a");
    assert.equal(snapshot.nodes[0]?.id, "__virtual__/root");
    assert.equal(snapshot.nodes[0]?.virtual, true);
    assert.equal(snapshot.nodes[0]?.label, "root");
    assert.equal(snapshot.nodes[1]?.id, "file-a");
    assert.equal(snapshot.nodes[1]?.parentId, "__virtual__/root");
    assert.equal(snapshot.nodes[2]?.id, "text-z");
    assert.equal(snapshot.nodes[2]?.parentId, "__virtual__/root");
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});
