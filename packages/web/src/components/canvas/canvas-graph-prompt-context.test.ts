import assert from "node:assert/strict";
import test from "node:test";
import type { PromptRecord } from "../../lib/graphql";
import { mockCanvasGraphSnapshot } from "./canvas-graph-layout";
import {
  getCanvasGraphHighlightedNodeIds,
  getCanvasGraphPromptRefreshToken,
  getPromptTouchedNotePaths
} from "./canvas-graph-prompt-context";

const createPromptRecord = (
  overrides: Partial<PromptRecord> = {}
): PromptRecord => ({
  id: "prompt-1",
  content: "Example prompt",
  status: "queued",
  metadata: {},
  audit: {},
  promptExecutions: [],
  startedAt: null,
  finishedAt: null,
  errorMessage: null,
  createdAt: "2026-03-20T00:00:00.000Z",
  updatedAt: "2026-03-20T00:00:00.000Z",
  ...overrides
});

test("getPromptTouchedNotePaths normalizes audit note paths across prompt audit sections", () => {
  const prompt = createPromptRecord({
    audit: {
      added: [
        "obsidian-repository/fragments/repeated-clock-time.md",
        "obsidian-repository/main.canvas"
      ],
      modified: ["concepts/frequency-illusion.md"],
      deleted: ["/obsidian-repository/practical/reminders.md"],
      moved: [
        {
          from: "obsidian-repository/fragments/old-name.md",
          to: "obsidian-repository/fragments/new-name.md"
        }
      ],
      contextualRelevance: [
        {
          path: "obsidian-repository/hypotheses/repeated-clock-time-may-relate-to-frequency-illusion.md",
          relationship: "related",
          disposition: "related_but_unproven"
        }
      ],
      hypotheses: {
        created: [
          "obsidian-repository/hypotheses/repeated-clock-time-may-relate-to-frequency-illusion.md"
        ],
        updated: ["./obsidian-repository/hypotheses/frequency-illusion-follow-up.md"]
      }
    }
  });

  assert.deepEqual(getPromptTouchedNotePaths(prompt), [
    "concepts/frequency-illusion.md",
    "fragments/new-name.md",
    "fragments/old-name.md",
    "fragments/repeated-clock-time.md",
    "hypotheses/frequency-illusion-follow-up.md",
    "hypotheses/repeated-clock-time-may-relate-to-frequency-illusion.md",
    "practical/reminders.md"
  ]);
});

test("getCanvasGraphHighlightedNodeIds matches touched note paths back to graph nodes", () => {
  const highlightedNodeIds = getCanvasGraphHighlightedNodeIds(mockCanvasGraphSnapshot, [
    "fragments/repeated-clock-time.md",
    "hypotheses/repeated-clock-time-may-relate-to-frequency-illusion.md",
    "missing/not-on-canvas.md"
  ]);

  assert.deepEqual(highlightedNodeIds.sort(), ["fragment-clock", "hypothesis-link"]);
});

test("getCanvasGraphPromptRefreshToken tracks the latest completed prompt", () => {
  const token = getCanvasGraphPromptRefreshToken([
    createPromptRecord({
      id: "prompt-old",
      status: "completed",
      finishedAt: "2026-03-20T00:01:00.000Z",
      updatedAt: "2026-03-20T00:01:00.000Z"
    }),
    createPromptRecord({
      id: "prompt-active",
      status: "writing",
      updatedAt: "2026-03-20T00:03:00.000Z"
    }),
    createPromptRecord({
      id: "prompt-new",
      status: "completed",
      finishedAt: "2026-03-20T00:02:00.000Z",
      updatedAt: "2026-03-20T00:02:00.000Z"
    })
  ]);

  assert.equal(token, "prompt-new:2026-03-20T00:02:00.000Z");
  assert.equal(getCanvasGraphPromptRefreshToken([]), null);
});
