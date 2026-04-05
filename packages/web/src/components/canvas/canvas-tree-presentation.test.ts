import assert from "node:assert/strict";
import test from "node:test";
import { mockCanvasTreeSnapshot } from "./canvas-tree-layout";
import type { CanvasTreeSnapshotRecord } from "./canvas-tree-types";
import {
  filterCanvasTreeRoots,
  getDefaultCollapsedCanvasTreeNodeIds,
  getCanvasTreeCollapsedDescendantIds,
  getCanvasTreeEmptyState,
  getCanvasTreeRelationRows,
  getVisibleCanvasTreeSnapshot
} from "./canvas-tree-presentation";

test("getCanvasTreeCollapsedDescendantIds collects all descendants beneath collapsed nodes", () => {
  const descendantIds = getCanvasTreeCollapsedDescendantIds(mockCanvasTreeSnapshot, ["concept-a"]);

  assert.deepEqual(Array.from(descendantIds), ["concept-c"]);
});

test("getVisibleCanvasTreeSnapshot hides collapsed descendants and recomputes visible counts", () => {
  const visibleSnapshot = getVisibleCanvasTreeSnapshot(mockCanvasTreeSnapshot, ["concept-a"]);

  assert.deepEqual(
    visibleSnapshot.nodes.map((node) => node.id),
    ["focus-note", "concept-a", "concept-b", "concept-d"]
  );
  assert.deepEqual(
    visibleSnapshot.links.map((link) => link.id),
    ["focus-note->concept-a", "focus-note->concept-b", "concept-b->concept-d"]
  );
  assert.equal(visibleSnapshot.summary.visibleLeafCount, 2);
  assert.equal(visibleSnapshot.summary.visibleBranchCount, 2);
});

test("getDefaultCollapsedCanvasTreeNodeIds returns nodes marked collapsed by default", () => {
  assert.deepEqual(
    getDefaultCollapsedCanvasTreeNodeIds({
      ...mockCanvasTreeSnapshot,
      nodes: mockCanvasTreeSnapshot.nodes.map((node, index) => ({
        ...node,
        defaultCollapsed: index === 1
      }))
    }),
    ["concept-a"]
  );
});

test("filterCanvasTreeRoots matches by label and path metadata", () => {
  assert.deepEqual(
    filterCanvasTreeRoots(mockCanvasTreeSnapshot.availableRoots, "dream").map((root) => root.id),
    ["focus-note"]
  );
  assert.deepEqual(
    filterCanvasTreeRoots(mockCanvasTreeSnapshot.availableRoots, "fragment").map((root) => root.id),
    ["focus-note"]
  );
});

test("getCanvasTreeEmptyState explains isolated roots and empty root searches", () => {
  assert.deepEqual(
    getCanvasTreeEmptyState({
      snapshot: {
        ...mockCanvasTreeSnapshot,
        summary: {
          ...mockCanvasTreeSnapshot.summary,
          hiddenByDepthCount: 0
        }
      },
      visibleSnapshot: {
        ...mockCanvasTreeSnapshot,
        nodeCount: 1,
        nodes: [mockCanvasTreeSnapshot.nodes[0]],
        links: [],
        summary: {
          ...mockCanvasTreeSnapshot.summary,
          visibleLeafCount: 1,
          visibleBranchCount: 0,
          hiddenByDepthCount: 0
        }
      },
      rootSearchQuery: "",
      filteredRootsCount: 1
    }),
    {
      title: "The selected root is isolated right now.",
      detail: "Choose a different root or enrich the canvas relationships around this note."
    }
  );

  assert.deepEqual(
    getCanvasTreeEmptyState({
      snapshot: mockCanvasTreeSnapshot,
      visibleSnapshot: mockCanvasTreeSnapshot,
      rootSearchQuery: "zzz",
      filteredRootsCount: 0
    }),
    {
      title: "No roots match the current search.",
      detail: "Clear the root search or try a broader phrase."
    }
  );
});

test("getCanvasTreeRelationRows returns a condensed parent and child table", () => {
  const rows = getCanvasTreeRelationRows({
    snapshot: mockCanvasTreeSnapshot,
    nodeId: "concept-a"
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.parent?.kind, "node");
  assert.equal(rows[0]?.child?.kind, "node");
  assert.equal(rows[0]?.parent?.label, "recurring dream fragment");
  assert.equal(rows[0]?.child?.label, "sleep cadence");
});

test("getCanvasTreeRelationRows shows a shared virtual parent and caps child rows with overflow", () => {
  const virtualSnapshot: CanvasTreeSnapshotRecord = {
    ...mockCanvasTreeSnapshot,
    nodeCount: 17,
    linkCount: 15,
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
        relationshipFamily: "virtual" as const,
        relationshipReason: "virtual parent for disconnected roots",
        lineage: [],
        childIds: Array.from({ length: 11 }, (_, index) => `orphan-${index + 1}`),
        descendantCount: 11,
        degree: 11,
        touchedByPrompt: false,
        tentative: false,
        score: -1,
        xHint: 260,
        yHint: 320,
        virtual: true,
        defaultCollapsed: true
      },
      ...Array.from({ length: 11 }, (_, index) => ({
        id: `orphan-${index + 1}`,
        parentId: "__virtual__/root",
        depth: 0,
        label: `orphan ${index + 1}`,
        notePath: `fragments/orphan-${index + 1}.md`,
        kind: "file" as const,
        category: "fragment" as const,
        canvasFile: "main.canvas",
        relationshipFamily: "root" as const,
        relationshipReason: "disconnected root",
        lineage: ["__virtual__/root"],
        childIds: [],
        descendantCount: 0,
        degree: 1,
        touchedByPrompt: false,
        tentative: false,
        score: 1,
        xHint: 520,
        yHint: 320 + index * 20,
        virtual: false,
        defaultCollapsed: false
      })),
      ...mockCanvasTreeSnapshot.nodes
    ],
    links: [
      {
        id: "__virtual__/root->orphan-1",
        sourceId: "__virtual__/root",
        targetId: "orphan-1",
        depth: 0,
        relationshipFamily: "virtual" as const,
        relationshipReason: "virtual parent for disconnected roots",
        tentative: false,
        weight: 0
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `__virtual__/root->orphan-${index + 2}`,
        sourceId: "__virtual__/root",
        targetId: `orphan-${index + 2}`,
        depth: 0,
        relationshipFamily: "virtual" as const,
        relationshipReason: "virtual parent for disconnected roots",
        tentative: false,
        weight: 0
      })),
      ...mockCanvasTreeSnapshot.links
    ]
  };

  const orphanRows = getCanvasTreeRelationRows({
    snapshot: virtualSnapshot,
    nodeId: "orphan-1"
  });
  assert.equal(orphanRows[0]?.parent?.kind, "node");
  assert.equal(orphanRows[0]?.parent?.label, "root");

  const virtualRows = getCanvasTreeRelationRows({
    snapshot: virtualSnapshot,
    nodeId: "__virtual__/root"
  });

  assert.equal(virtualRows.length, 10);
  assert.equal(virtualRows[0]?.child?.kind, "node");
  assert.equal(virtualRows[8]?.child?.kind, "node");
  assert.equal(virtualRows[9]?.child?.kind, "overflow");
  assert.equal(virtualRows[9]?.child?.label, "+2 more");
});
