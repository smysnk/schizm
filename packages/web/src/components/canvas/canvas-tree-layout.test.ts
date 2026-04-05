import assert from "node:assert/strict";
import test from "node:test";
import {
  CANVAS_TREE_DOT_RADIUS,
  buildCanvasTreeDefaultViewBox,
  buildCanvasTreeLayout,
  getCanvasTreeEdgeGeometry,
  getCanvasTreeLineageEdgeIds,
  getCanvasTreeLineageNodeIds,
  mockCanvasTreeSnapshot
} from "./canvas-tree-layout";
import type { CanvasTreeSnapshotRecord } from "./canvas-tree-types";

test("buildCanvasTreeLayout places nodes into deterministic depth columns", () => {
  const layout = buildCanvasTreeLayout(mockCanvasTreeSnapshot);
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  assert.equal(layout.columns.length, 3);
  assert.equal(layout.columns[0]?.label, "Root");
  assert.equal(layout.columns[1]?.label, "Depth 1");
  assert.equal(layout.columns[2]?.label, "Depth 2");

  assert.ok((nodeById.get("concept-a")?.x || 0) > (nodeById.get("focus-note")?.x || 0));
  assert.ok((nodeById.get("concept-c")?.x || 0) > (nodeById.get("concept-a")?.x || 0));
  assert.equal(nodeById.get("focus-note")?.y, 95);
  assert.equal(nodeById.get("concept-a")?.y, 84);
  assert.equal(nodeById.get("concept-b")?.y, 106);
});

test("buildCanvasTreeLayout builds curved lineage paths and a bounded default view box", () => {
  const layout = buildCanvasTreeLayout(mockCanvasTreeSnapshot);
  const viewBox = buildCanvasTreeDefaultViewBox(layout);

  assert.equal(layout.edges.length, 4);
  assert.match(layout.edges[0]?.path || "", /^M /);
  assert.ok(layout.edges[0]?.labelX);
  assert.ok(layout.edges[0]?.labelY);
  assert.deepEqual(viewBox, {
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height
  });
});

test("buildCanvasTreeLayout supports a deterministic radial mode", () => {
  const layout = buildCanvasTreeLayout(mockCanvasTreeSnapshot, "radial");
  const rootNode = layout.nodes.find((node) => node.id === "focus-note");
  const conceptANode = layout.nodes.find((node) => node.id === "concept-a");
  const conceptCNode = layout.nodes.find((node) => node.id === "concept-c");

  assert.equal(layout.mode, "radial");
  assert.equal(layout.columns.length, 0);
  assert.equal(layout.rings.length, 3);
  assert.equal(rootNode?.x, layout.centerX);
  assert.equal(rootNode?.y, layout.centerY);
  assert.ok((conceptANode?.x || 0) > layout.centerX);
  assert.ok((conceptCNode?.x || 0) > (conceptANode?.x || 0));
  assert.match(layout.edges[0]?.path || "", /^M /);
});

test("buildCanvasTreeLayout uses the shared virtual root as the structural root when present", () => {
  const virtualRootSnapshot: CanvasTreeSnapshotRecord = {
    ...mockCanvasTreeSnapshot,
    nodeCount: 6,
    linkCount: 5,
    nodes: [
      {
        id: "__virtual__/root",
        parentId: null,
        depth: -1,
        label: "root",
        notePath: null,
        kind: "group",
        category: "other",
        canvasFile: "main.canvas",
        relationshipFamily: "virtual",
        relationshipReason: "virtual parent for 1 root node",
        lineage: [],
        childIds: ["focus-note"],
        descendantCount: 5,
        degree: 1,
        touchedByPrompt: true,
        tentative: false,
        score: Number.MAX_SAFE_INTEGER,
        xHint: 0,
        yHint: 0,
        virtual: true,
        defaultCollapsed: false
      },
      ...mockCanvasTreeSnapshot.nodes.map((node) => ({
        ...node,
        parentId: node.parentId ?? "__virtual__/root",
        lineage: node.id === "focus-note" ? ["__virtual__/root"] : ["__virtual__/root", ...node.lineage]
      }))
    ],
    links: [
      {
        id: "__virtual__/root->focus-note",
        sourceId: "__virtual__/root",
        targetId: "focus-note",
        depth: 0,
        relationshipFamily: "virtual",
        relationshipReason: "virtual parent for 1 root node",
        tentative: false,
        weight: 0
      },
      ...mockCanvasTreeSnapshot.links
    ]
  };

  const phylogenyLayout = buildCanvasTreeLayout(virtualRootSnapshot);
  const radialLayout = buildCanvasTreeLayout(virtualRootSnapshot, "radial");
  const phylogenyNodeById = new Map(phylogenyLayout.nodes.map((node) => [node.id, node]));
  const radialNodeById = new Map(radialLayout.nodes.map((node) => [node.id, node]));

  assert.equal(phylogenyLayout.columns[0]?.label, "Root");
  assert.equal(phylogenyLayout.columns[1]?.label, "Depth 0");
  assert.ok(
    (phylogenyNodeById.get("__virtual__/root")?.x || 0) <
      (phylogenyNodeById.get("focus-note")?.x || 0)
  );
  assert.equal(radialLayout.rings[0]?.label, "Root");
  assert.equal(radialLayout.rings[1]?.label, "Depth 0");
  assert.equal(radialNodeById.get("__virtual__/root")?.x, radialLayout.centerX);
  assert.equal(radialNodeById.get("__virtual__/root")?.y, radialLayout.centerY);
});

test("getCanvasTreeEdgeGeometry trims edges to dots unless a node is expanded", () => {
  const layout = buildCanvasTreeLayout(mockCanvasTreeSnapshot);
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const edge = layout.edges[0];

  assert.ok(edge);

  const compactGeometry = getCanvasTreeEdgeGeometry({
    layout,
    edge: edge!,
    nodeById,
    expandedNodeIds: new Set<string>()
  });
  const expandedGeometry = getCanvasTreeEdgeGeometry({
    layout,
    edge: edge!,
    nodeById,
    expandedNodeIds: new Set<string>(["focus-note", "concept-a"])
  });

  assert.match(compactGeometry.path, /^M /);
  assert.match(expandedGeometry.path, /^M /);
  assert.notEqual(compactGeometry.path, expandedGeometry.path);
  assert.ok(compactGeometry.labelX < expandedGeometry.labelX + CANVAS_TREE_DOT_RADIUS * 10);
});

test("lineage helpers return the selected node path back to the root", () => {
  const lineageNodeIds = getCanvasTreeLineageNodeIds(mockCanvasTreeSnapshot, "concept-c");
  const lineageEdgeIds = getCanvasTreeLineageEdgeIds(mockCanvasTreeSnapshot, "concept-c");

  assert.deepEqual(Array.from(lineageNodeIds), ["focus-note", "concept-a", "concept-c"]);
  assert.deepEqual(Array.from(lineageEdgeIds), [
    "focus-note->concept-a",
    "concept-a->concept-c"
  ]);
  assert.equal(getCanvasTreeLineageNodeIds(mockCanvasTreeSnapshot, null).size, 0);
});
