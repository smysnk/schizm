import assert from "node:assert/strict";
import test from "node:test";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { createResolvers } from "./resolvers";
import { typeDefs } from "./schema";

test("canvasLanes GraphQL query returns the live lane snapshot", async () => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers({
      listCanvasGraphFiles: async () => ["main.canvas", "research.canvas"],
      getCanvasLanesSnapshot: async () => ({
        generatedAt: "2026-03-23T20:10:00.000Z",
        canvasPath: "main.canvas",
        focusNodeId: "focus-note",
        focusHistory: ["older-note"],
        lanes: [
          {
            id: "focus",
            label: "Main frame",
            description: "Focused note.",
            cards: [
              {
                nodeId: "focus-note",
                label: "Recurring dream fragment",
                kind: "file",
                category: "fragment",
                notePath: "fragments/recurring-dream-fragment.md",
                canvasNodeId: "focus-note",
                canvasFile: "main.canvas",
                reason: "current focus",
                score: 9999,
                tentative: false,
                touchedByPrompt: true
              }
            ]
          },
          {
            id: "canvas",
            label: "Explicit canvas links",
            description: "Direct links.",
            cards: [
              {
                nodeId: "concept-a",
                label: "Sleep fragmentation",
                kind: "file",
                category: "concept",
                notePath: "concepts/sleep-fragmentation.md",
                canvasNodeId: "concept-a",
                canvasFile: "main.canvas",
                reason: "canvas edge: supports",
                score: 410.5,
                tentative: false,
                touchedByPrompt: false
              }
            ]
          }
        ]
      })
    })
  });

  const result = await graphql({
    schema,
    source: `
      query CanvasLanesSnapshot(
        $canvasPath: String
        $focusNodeId: ID
        $focusHistory: [ID!]
        $highlightedNotePaths: [String!]
      ) {
        canvasFiles
        canvasLanes(
          canvasPath: $canvasPath
          focusNodeId: $focusNodeId
          focusHistory: $focusHistory
          highlightedNotePaths: $highlightedNotePaths
        ) {
          generatedAt
          canvasPath
          focusNodeId
          focusHistory
          lanes {
            id
            label
            cards {
              nodeId
              label
              reason
              touchedByPrompt
            }
          }
        }
      }
    `,
    variableValues: {
      canvasPath: "main.canvas",
      focusNodeId: "focus-note",
      focusHistory: ["older-note"],
      highlightedNotePaths: ["fragments/recurring-dream-fragment.md"]
    }
  });

  assert.equal(result.errors, undefined);

  const payload = result.data as {
    canvasFiles: string[];
    canvasLanes: {
      canvasPath: string;
      focusNodeId: string;
      focusHistory: string[];
      lanes: Array<{
        id: string;
        cards: Array<{ nodeId: string; touchedByPrompt: boolean }>;
      }>;
    };
  };

  assert.deepEqual(payload.canvasFiles, ["main.canvas", "research.canvas"]);
  assert.equal(payload.canvasLanes.canvasPath, "main.canvas");
  assert.equal(payload.canvasLanes.focusNodeId, "focus-note");
  assert.deepEqual(payload.canvasLanes.focusHistory, ["older-note"]);
  assert.deepEqual(
    payload.canvasLanes.lanes.map((lane) => lane.id),
    ["focus", "canvas"]
  );
  assert.equal(payload.canvasLanes.lanes[0]?.cards[0]?.touchedByPrompt, true);
});
