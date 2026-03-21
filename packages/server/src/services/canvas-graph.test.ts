import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getCanvasGraphSnapshot, listCanvasGraphFiles } from "./canvas-graph";

const createTempDirectory = async () => mkdtemp(path.join(os.tmpdir(), "schizm-canvas-graph-"));

test("getCanvasGraphSnapshot maps explicit canvas nodes and edges into graph records", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(documentStoreRoot, { recursive: true });
    await mkdir(path.join(documentStoreRoot, "fragments"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "concepts"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "hypotheses"), { recursive: true });
    await writeFile(
      path.join(documentStoreRoot, "fragments", "repeated-clock-time.md"),
      "Clock fragment\n",
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "concepts", "frequency-illusion.md"),
      "Frequency concept\n",
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "hypotheses", "repeated-clock-time-may-relate-to-frequency-illusion.md"),
      "Hypothesis note\n",
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            {
              id: "fragment-clock",
              type: "file",
              file: "fragments/repeated-clock-time.md",
              x: 80,
              y: 80,
              width: 320,
              height: 180
            },
            {
              id: "concept-frequency",
              type: "file",
              file: "concepts/frequency-illusion.md",
              x: 520,
              y: 80,
              width: 320,
              height: 180
            },
            {
              id: "hypothesis-link",
              type: "file",
              file: "hypotheses/repeated-clock-time-may-relate-to-frequency-illusion.md",
              x: 300,
              y: 320,
              width: 360,
              height: 220
            }
          ],
          edges: [
            {
              id: "edge-clock-hypothesis",
              fromNode: "hypothesis-link",
              toNode: "fragment-clock",
              label: "possible explanation"
            },
            {
              id: "edge-frequency-hypothesis",
              fromNode: "hypothesis-link",
              toNode: "concept-frequency",
              label: "context"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasGraphSnapshot({ documentStoreRoot });

    assert.equal(snapshot.canvasPath, "main.canvas");
    assert.equal(snapshot.nodes.length, 3);
    assert.equal(snapshot.edges.length, 2);
    assert.match(snapshot.generatedAt, /^\d{4}-\d{2}-\d{2}T/);

    const fragmentNode = snapshot.nodes.find((node) => node.id === "fragment-clock");
    const hypothesisNode = snapshot.nodes.find((node) => node.id === "hypothesis-link");
    const tentativeEdge = snapshot.edges.find((edge) => edge.id === "edge-clock-hypothesis");

    assert.deepEqual(fragmentNode, {
      id: "fragment-clock",
      notePath: "fragments/repeated-clock-time.md",
      canvasNodeId: "fragment-clock",
      label: "repeated clock time",
      kind: "file",
      category: "fragment",
      canvasFile: "main.canvas",
      x: 80,
      y: 80,
      width: 320,
      height: 180,
      degree: 1,
      inboundLinkCount: 1,
      outboundLinkCount: 0,
      tags: []
    });
    assert.equal(hypothesisNode?.category, "hypothesis");
    assert.equal(hypothesisNode?.degree, 2);
    assert.equal(hypothesisNode?.outboundLinkCount, 2);
    assert.equal(tentativeEdge?.kind, "canvas");
    assert.equal(tentativeEdge?.tentative, true);
    assert.equal(tentativeEdge?.weight, 1);
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasGraphSnapshot overlays markdown links between existing canvas-backed notes only", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "fragments"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "concepts"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "notes"), { recursive: true });
    await writeFile(
      path.join(documentStoreRoot, "fragments", "repeated-clock-time.md"),
      [
        "I keep noticing [[concepts/frequency-illusion]] at night.",
        "It also links to [the concept](../concepts/frequency-illusion.md).",
        "And a missing note [[notes/not-on-canvas]].",
        "And an external link [docs](https://example.com/docs)."
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "concepts", "frequency-illusion.md"),
      "Concept note\n",
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "notes", "not-on-canvas.md"),
      "Hidden note\n",
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            {
              id: "fragment-clock",
              type: "file",
              file: "fragments/repeated-clock-time.md",
              x: 80,
              y: 80,
              width: 320,
              height: 180
            },
            {
              id: "concept-frequency",
              type: "file",
              file: "concepts/frequency-illusion.md",
              x: 520,
              y: 80,
              width: 320,
              height: 180
            }
          ],
          edges: []
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasGraphSnapshot({ documentStoreRoot });
    const markdownEdges = snapshot.edges.filter((edge) => edge.kind === "markdown-link");

    assert.equal(markdownEdges.length, 1);
    assert.deepEqual(markdownEdges[0], {
      id: "markdown:fragment-clock->concept-frequency",
      sourceId: "fragment-clock",
      targetId: "concept-frequency",
      kind: "markdown-link",
      label: null,
      weight: 0.65,
      tentative: false
    });
    assert.equal(snapshot.nodes.find((node) => node.id === "fragment-clock")?.outboundLinkCount, 1);
    assert.equal(snapshot.nodes.find((node) => node.id === "concept-frequency")?.inboundLinkCount, 1);
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasGraphSnapshot supports custom canvas paths and non-file node labels", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "maps"), { recursive: true });
    await writeFile(
      path.join(documentStoreRoot, "maps", "secondary.canvas"),
      JSON.stringify(
        {
          nodes: [
            {
              id: "summary-text",
              type: "text",
              text: "First line\nSecond line",
              x: 12,
              y: 18
            },
            {
              id: "group-cluster",
              type: "group",
              label: "Open Questions",
              x: 100,
              y: 140
            }
          ],
          edges: [{ id: "group-edge", fromNode: "group-cluster", toNode: "summary-text" }]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasGraphSnapshot({
      documentStoreRoot,
      canvasPath: "maps/secondary.canvas"
    });

    assert.equal(snapshot.canvasPath, "maps/secondary.canvas");
    assert.equal(snapshot.nodes.length, 2);
    assert.equal(snapshot.edges.length, 1);
    assert.equal(snapshot.nodes[0]?.label, "First line");
    assert.equal(snapshot.nodes[0]?.kind, "text");
    assert.equal(snapshot.nodes[1]?.label, "Open Questions");
    assert.equal(snapshot.nodes[1]?.kind, "group");
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasGraphSnapshot skips invalid edge references and tolerates unknown node kinds", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(documentStoreRoot, { recursive: true });
    await writeFile(
      path.join(documentStoreRoot, "main.canvas"),
      JSON.stringify(
        {
          nodes: [
            {
              id: "mystery-node",
              type: "portal",
              x: "bad",
              y: 14,
              width: 10,
              height: "bad"
            }
          ],
          edges: [{ id: "dangling-edge", fromNode: "mystery-node", toNode: "missing-node" }]
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = await getCanvasGraphSnapshot({ documentStoreRoot });

    assert.equal(snapshot.nodes.length, 1);
    assert.equal(snapshot.edges.length, 0);
    assert.deepEqual(snapshot.nodes[0], {
      id: "mystery-node",
      notePath: null,
      canvasNodeId: "mystery-node",
      label: "mystery-node",
      kind: "missing",
      category: "other",
      canvasFile: "main.canvas",
      x: null,
      y: 14,
      width: 10,
      height: null,
      degree: 0,
      inboundLinkCount: 0,
      outboundLinkCount: 0,
      tags: []
    });
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("getCanvasGraphSnapshot throws a clear error when the target canvas does not exist", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(documentStoreRoot, { recursive: true });

    await assert.rejects(
      () => getCanvasGraphSnapshot({ documentStoreRoot, canvasPath: "missing.canvas" }),
      /missing\.canvas/
    );
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});

test("listCanvasGraphFiles returns sorted relative canvas paths and skips ignored directories", async () => {
  const documentStoreRoot = await createTempDirectory();

  try {
    await mkdir(path.join(documentStoreRoot, "maps"), { recursive: true });
    await mkdir(path.join(documentStoreRoot, "node_modules", "fake"), { recursive: true });
    await writeFile(path.join(documentStoreRoot, "main.canvas"), '{"nodes":[],"edges":[]}\n', "utf8");
    await writeFile(
      path.join(documentStoreRoot, "maps", "secondary.canvas"),
      '{"nodes":[],"edges":[]}\n',
      "utf8"
    );
    await writeFile(
      path.join(documentStoreRoot, "node_modules", "fake", "ignored.canvas"),
      '{"nodes":[],"edges":[]}\n',
      "utf8"
    );

    const files = await listCanvasGraphFiles({ documentStoreRoot });

    assert.deepEqual(files, ["main.canvas", "maps/secondary.canvas"]);
  } finally {
    await rm(documentStoreRoot, { recursive: true, force: true });
  }
});
