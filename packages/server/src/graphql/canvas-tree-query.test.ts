import assert from "node:assert/strict";
import test from "node:test";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { createResolvers } from "./resolvers";
import { typeDefs } from "./schema";

test("canvasTree GraphQL query returns the live tree snapshot", async () => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers({
      getCanvasTreeSnapshot: async () => ({
        contractVersion: 1 as const,
        generatedAt: "2026-03-30T18:20:00.000Z",
        canvasPath: "main.canvas",
        rootNodeId: "focus-note",
        rootLabel: "recurring dream fragment",
        maxDepthRequested: 3,
        maxDepthResolved: 2,
        nodeCount: 4,
        linkCount: 3,
        truncated: true,
        availableRoots: [
          {
            id: "focus-note",
            label: "recurring dream fragment",
            kind: "file",
            category: "fragment",
            notePath: "fragments/recurring-dream-fragment.md",
            canvasFile: "main.canvas"
          },
          {
            id: "concept-a",
            label: "sleep fragmentation",
            kind: "file",
            category: "concept",
            notePath: "concepts/sleep-fragmentation.md",
            canvasFile: "main.canvas"
          }
        ],
        nodes: [
          {
            id: "focus-note",
            parentId: null,
            depth: 0,
            label: "recurring dream fragment",
            notePath: "fragments/recurring-dream-fragment.md",
            kind: "file",
            category: "fragment",
            canvasFile: "main.canvas",
            relationshipFamily: "root",
            relationshipReason: "selected root",
            lineage: [],
            childIds: ["concept-a", "concept-b"],
            descendantCount: 3,
            degree: 5,
            touchedByPrompt: true,
            tentative: false,
            score: Number.MAX_SAFE_INTEGER,
            xHint: 80,
            yHint: 120
          },
          {
            id: "concept-a",
            parentId: "focus-note",
            depth: 1,
            label: "sleep fragmentation",
            notePath: "concepts/sleep-fragmentation.md",
            kind: "file",
            category: "concept",
            canvasFile: "main.canvas",
            relationshipFamily: "canvas",
            relationshipReason: "canvas edge: supports",
            lineage: ["focus-note"],
            childIds: ["concept-c"],
            descendantCount: 1,
            degree: 4,
            touchedByPrompt: false,
            tentative: false,
            score: 512,
            xHint: 360,
            yHint: 120
          },
          {
            id: "concept-b",
            parentId: "focus-note",
            depth: 1,
            label: "frequency illusion",
            notePath: "concepts/frequency-illusion.md",
            kind: "file",
            category: "concept",
            canvasFile: "main.canvas",
            relationshipFamily: "tentative-canvas",
            relationshipReason: "tentative canvas edge: possible overlap",
            lineage: ["focus-note"],
            childIds: [],
            descendantCount: 0,
            degree: 2,
            touchedByPrompt: false,
            tentative: true,
            score: 412,
            xHint: 360,
            yHint: 260
          },
          {
            id: "concept-c",
            parentId: "concept-a",
            depth: 2,
            label: "sleep cadence",
            notePath: "concepts/sleep-cadence.md",
            kind: "file",
            category: "concept",
            canvasFile: "main.canvas",
            relationshipFamily: "document",
            relationshipReason: "document link from parent note",
            lineage: ["focus-note", "concept-a"],
            childIds: [],
            descendantCount: 0,
            degree: 1,
            touchedByPrompt: true,
            tentative: false,
            score: 305,
            xHint: 620,
            yHint: 120
          }
        ],
        links: [
          {
            id: "focus-note->concept-a",
            sourceId: "focus-note",
            targetId: "concept-a",
            depth: 1,
            relationshipFamily: "canvas",
            relationshipReason: "canvas edge: supports",
            tentative: false,
            weight: 1
          },
          {
            id: "focus-note->concept-b",
            sourceId: "focus-note",
            targetId: "concept-b",
            depth: 1,
            relationshipFamily: "tentative-canvas",
            relationshipReason: "tentative canvas edge: possible overlap",
            tentative: true,
            weight: 1
          },
          {
            id: "concept-a->concept-c",
            sourceId: "concept-a",
            targetId: "concept-c",
            depth: 2,
            relationshipFamily: "document",
            relationshipReason: "document link from parent note",
            tentative: false,
            weight: 0.65
          }
        ],
        summary: {
          availableRootCount: 2,
          visibleLeafCount: 2,
          visibleBranchCount: 2,
          hiddenByDepthCount: 5,
          relationshipFamilyCounts: {
            canvas: 1,
            "tentative-canvas": 1,
            document: 1,
            context: 0,
            bridge: 0
          }
        }
      })
    })
  });

  const result = await graphql({
    schema,
    source: `
      query CanvasTreeSnapshot(
        $canvasPath: String
        $rootNodeId: ID
        $maxDepth: Int
        $highlightedNotePaths: [String!]
      ) {
        canvasTree(
          canvasPath: $canvasPath
          rootNodeId: $rootNodeId
          maxDepth: $maxDepth
          highlightedNotePaths: $highlightedNotePaths
        ) {
          contractVersion
          canvasPath
          rootNodeId
          rootLabel
          maxDepthRequested
          maxDepthResolved
          truncated
          availableRoots {
            id
            label
          }
          nodes {
            id
            parentId
            depth
            relationshipFamily
            touchedByPrompt
          }
          links {
            id
            relationshipFamily
            tentative
          }
          summary {
            availableRootCount
            hiddenByDepthCount
            relationshipFamilyCounts {
              canvas
              tentativeCanvas
              document
              context
              bridge
            }
          }
        }
      }
    `,
    variableValues: {
      canvasPath: "main.canvas",
      rootNodeId: "focus-note",
      maxDepth: 3,
      highlightedNotePaths: ["fragments/recurring-dream-fragment.md"]
    }
  });

  assert.equal(result.errors, undefined);

  const payload = result.data as {
    canvasTree: {
      contractVersion: number;
      canvasPath: string;
      rootNodeId: string;
      rootLabel: string;
      maxDepthRequested: number;
      maxDepthResolved: number;
      truncated: boolean;
      availableRoots: Array<{ id: string; label: string }>;
      nodes: Array<{
        id: string;
        parentId: string | null;
        depth: number;
        relationshipFamily: string;
        touchedByPrompt: boolean;
      }>;
      links: Array<{ id: string; relationshipFamily: string; tentative: boolean }>;
      summary: {
        availableRootCount: number;
        hiddenByDepthCount: number;
        relationshipFamilyCounts: {
          canvas: number;
          tentativeCanvas: number;
          document: number;
          context: number;
          bridge: number;
        };
      };
    };
  };

  assert.equal(payload.canvasTree.contractVersion, 1);
  assert.equal(payload.canvasTree.canvasPath, "main.canvas");
  assert.equal(payload.canvasTree.rootNodeId, "focus-note");
  assert.equal(payload.canvasTree.rootLabel, "recurring dream fragment");
  assert.equal(payload.canvasTree.maxDepthRequested, 3);
  assert.equal(payload.canvasTree.maxDepthResolved, 2);
  assert.equal(payload.canvasTree.truncated, true);
  assert.deepEqual(
    payload.canvasTree.availableRoots.map((root) => root.id),
    ["focus-note", "concept-a"]
  );
  assert.equal(payload.canvasTree.nodes[0]?.touchedByPrompt, true);
  assert.equal(
    payload.canvasTree.nodes.find((node) => node.id === "concept-b")?.relationshipFamily,
    "tentative-canvas"
  );
  assert.equal(payload.canvasTree.links[1]?.tentative, true);
  assert.equal(payload.canvasTree.summary.availableRootCount, 2);
  assert.equal(payload.canvasTree.summary.hiddenByDepthCount, 5);
  assert.deepEqual({ ...payload.canvasTree.summary.relationshipFamilyCounts }, {
    canvas: 1,
    tentativeCanvas: 1,
    document: 1,
    context: 0,
    bridge: 0
  });
});
