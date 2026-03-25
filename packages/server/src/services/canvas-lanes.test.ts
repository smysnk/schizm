import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getCanvasLanesSnapshot } from "./canvas-lanes";

const createTempDirectory = async () => mkdtemp(path.join(os.tmpdir(), "schizm-canvas-lanes-"));

test("getCanvasLanesSnapshot groups related nodes into deterministic relationship lanes", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "fragments"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "concepts"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "practical"), { recursive: true });

    await writeFile(
      path.join(documentStoreRoot, "fragments", "focus.md"),
      [
        "Focus note.",
        "Links to [[concepts/document-neighbor]].",
        "Also links to [[concepts/canvas-and-document]]."
      ].join("\n"),
      "utf8"
    );
    await writeFile(path.join(documentStoreRoot, "concepts", "canvas-neighbor.md"), "Canvas only\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "document-neighbor.md"), "Document only\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "canvas-and-document.md"), "Both direct modes\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "fragments", "shared-context.md"), "Same folder family\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "bridge-hub.md"), "Bridge hub\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "practical", "bridge-target.md"), "Indirect target\n", "utf8");
    await writeFile(path.join(documentStoreRoot, "concepts", "tentative-neighbor.md"), "Tentative note\n", "utf8");

    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            { id: "focus", type: "file", file: "fragments/focus.md", x: 40, y: 40, width: 260, height: 160 },
            { id: "canvas-neighbor", type: "file", file: "concepts/canvas-neighbor.md", x: 420, y: 30, width: 260, height: 160 },
            { id: "document-neighbor", type: "file", file: "concepts/document-neighbor.md", x: 420, y: 210, width: 260, height: 160 },
            { id: "canvas-and-document", type: "file", file: "concepts/canvas-and-document.md", x: 420, y: 390, width: 260, height: 160 },
            { id: "shared-context", type: "file", file: "fragments/shared-context.md", x: 760, y: 30, width: 260, height: 160 },
            { id: "bridge-hub", type: "file", file: "concepts/bridge-hub.md", x: 760, y: 210, width: 260, height: 160 },
            { id: "bridge-target", type: "file", file: "practical/bridge-target.md", x: 1080, y: 210, width: 260, height: 160 },
            { id: "tentative-neighbor", type: "file", file: "concepts/tentative-neighbor.md", x: 760, y: 390, width: 260, height: 160 }
          ],
          edges: [
            { id: "edge-focus-canvas", fromNode: "focus", toNode: "canvas-neighbor", label: "supports" },
            { id: "edge-focus-both", fromNode: "focus", toNode: "canvas-and-document", label: "same pattern" },
            { id: "edge-focus-hub", fromNode: "focus", toNode: "bridge-hub", label: "feeds" },
            { id: "edge-hub-target", fromNode: "bridge-hub", toNode: "bridge-target", label: "extends" },
            { id: "edge-focus-tentative", fromNode: "focus", toNode: "tentative-neighbor", label: "possible overlap" }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasLanesSnapshot({
      documentStoreRoot,
      focusNodeId: "focus",
      focusHistory: ["canvas-neighbor"],
      highlightedNotePaths: [
        "obsidian-repository/fragments/focus.md",
        "concepts/document-neighbor.md",
        "./hypotheses/does-not-exist.md"
      ]
    });

    assert.equal(snapshot.focusNodeId, "focus");
    assert.deepEqual(snapshot.focusHistory, ["canvas-neighbor"]);

    const laneById = new Map(snapshot.lanes.map((lane) => [lane.id, lane]));

    assert.deepEqual(laneById.get("focus")?.cards.map((card) => card.nodeId), ["focus"]);
    assert.deepEqual(
      laneById.get("canvas")?.cards.map((card) => card.nodeId),
      ["bridge-hub", "canvas-and-document", "canvas-neighbor"]
    );
    assert.deepEqual(
      laneById.get("document")?.cards.map((card) => card.nodeId),
      ["document-neighbor"]
    );
    assert.deepEqual(
      laneById.get("context")?.cards.map((card) => card.nodeId),
      ["shared-context"]
    );
    assert.deepEqual(
      laneById.get("bridge")?.cards.map((card) => card.nodeId),
      ["bridge-target"]
    );
    assert.deepEqual(
      laneById.get("tentative")?.cards.map((card) => card.nodeId),
      ["tentative-neighbor"]
    );

    assert.match(
      laneById.get("canvas")?.cards.find((card) => card.nodeId === "canvas-and-document")?.reason || "",
      /canvas edge/i
    );
    assert.match(
      laneById.get("document")?.cards[0]?.reason || "",
      /links with focus note/i
    );
    assert.match(
      laneById.get("context")?.cards[0]?.reason || "",
      /shared (dir|top|category|kind)/i
    );
    assert.match(
      laneById.get("bridge")?.cards[0]?.reason || "",
      /shared via/i
    );
    assert.equal(laneById.get("tentative")?.cards[0]?.tentative, true);
    assert.equal(laneById.get("focus")?.cards[0]?.touchedByPrompt, true);
    assert.equal(laneById.get("document")?.cards[0]?.touchedByPrompt, true);
    assert.equal(laneById.get("canvas")?.cards.find((card) => card.nodeId === "canvas-neighbor")?.touchedByPrompt, false);
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasLanesSnapshot picks a stable initial focus node when none is provided", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            { id: "text-z", type: "text", text: "Zed", x: 80, y: 80 },
            { id: "group-a", type: "group", label: "Alpha", x: 240, y: 80 }
          ],
          edges: []
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasLanesSnapshot({ documentStoreRoot });

    assert.equal(snapshot.focusNodeId, "group-a");
    assert.equal(snapshot.lanes[0]?.cards[0]?.label, "Alpha");
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});
