import { env, getRuntimeConfig, resolveDocumentStoreRoot } from "../config/env";
import { ensureDemoGraph, getGraphSnapshot, moveIdea } from "../repositories/graph-repository";
import {
  cancelPrompt,
  createPrompt,
  getPrompt,
  listPrompts,
  retryPrompt
} from "../repositories/prompt-repository";
import { listPromptExecutions } from "../repositories/prompt-execution-repository";
import { getCanvasGraphSnapshot, listCanvasGraphFiles } from "../services/canvas-graph";
import { getPromptRunner } from "../services/prompt-runner-registry";
import { buildSystemCanvasSnapshot } from "../services/system-canvas";
import { subscribePromptWorkspaceEvents } from "../services/prompt-workspace-events";
import { jsonScalar } from "./json-scalar";

const SYSTEM_CANVAS_PROMPT_LIMIT = 50;

const getPromptRunnerState = () =>
  getPromptRunner()?.getState() || {
    paused: true,
    inFlight: false,
    activePromptId: null,
    activePromptStatus: null,
    pollMs: 0,
    automationBranch: "unavailable",
    worktreeRoot: "unavailable",
    runnerSessionId: "unavailable"
  };

type ResolverDependencies = {
  getRuntimeConfig: typeof getRuntimeConfig;
  getGraphSnapshot: typeof getGraphSnapshot;
  moveIdea: typeof moveIdea;
  ensureDemoGraph: typeof ensureDemoGraph;
  listCanvasGraphFiles: typeof listCanvasGraphFiles;
  getCanvasGraphSnapshot: typeof getCanvasGraphSnapshot;
  getPrompt: typeof getPrompt;
  listPrompts: typeof listPrompts;
  createPrompt: typeof createPrompt;
  cancelPrompt: typeof cancelPrompt;
  retryPrompt: typeof retryPrompt;
  listPromptExecutions: typeof listPromptExecutions;
  getPromptRunnerState: typeof getPromptRunnerState;
  subscribePromptWorkspaceEvents: typeof subscribePromptWorkspaceEvents;
  pausePromptRunner: () => ReturnType<NonNullable<ReturnType<typeof getPromptRunner>>["pause"]>;
  resumePromptRunner: () => ReturnType<NonNullable<ReturnType<typeof getPromptRunner>>["resume"]>;
};

const defaultDependencies: ResolverDependencies = {
  getRuntimeConfig,
  getGraphSnapshot,
  moveIdea,
  ensureDemoGraph,
  listCanvasGraphFiles,
  getCanvasGraphSnapshot,
  getPrompt,
  listPrompts,
  createPrompt,
  cancelPrompt,
  retryPrompt,
  listPromptExecutions,
  getPromptRunnerState,
  subscribePromptWorkspaceEvents,
  pausePromptRunner: () => {
    const runner = getPromptRunner();

    if (!runner) {
      throw new Error("Prompt runner is not available.");
    }

    return runner.pause();
  },
  resumePromptRunner: () => {
    const runner = getPromptRunner();

    if (!runner) {
      throw new Error("Prompt runner is not available.");
    }

    return runner.resume();
  }
};

export const buildSystemCanvasQuerySnapshot = async (
  {
    selectedPromptId
  }: {
    selectedPromptId?: string | null;
  },
  dependencies: Pick<
    ResolverDependencies,
    "getPrompt" | "getPromptRunnerState" | "listPromptExecutions" | "listPrompts"
  >
) => {
  const recentPrompts = await dependencies.listPrompts(SYSTEM_CANVAS_PROMPT_LIMIT);
  const promptById = new Map(recentPrompts.map((prompt) => [prompt.id, prompt]));

  if (selectedPromptId && !promptById.has(selectedPromptId)) {
    const selectedPrompt = await dependencies.getPrompt(selectedPromptId);

    if (selectedPrompt) {
      promptById.set(selectedPrompt.id, selectedPrompt);
    }
  }

  const prompts = Array.from(promptById.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const promptExecutions = (
    await Promise.all(prompts.map((prompt) => dependencies.listPromptExecutions(prompt.id)))
  ).flat();

  return buildSystemCanvasSnapshot({
    prompts,
    promptExecutions,
    promptRunnerState: dependencies.getPromptRunnerState(),
    selectedPromptId
  });
};

export const createResolvers = (overrides: Partial<ResolverDependencies> = {}) => {
  const dependencies: ResolverDependencies = {
    ...defaultDependencies,
    ...overrides
  };

  return {
    JSON: jsonScalar,
    Prompt: {
      promptExecutions: async (prompt: { id: string }) =>
        dependencies.listPromptExecutions(prompt.id)
    },
    Query: {
      health: () => "ok",
      runtimeConfig: () => dependencies.getRuntimeConfig(),
      graphSnapshot: async () => dependencies.getGraphSnapshot(),
      canvasFiles: async () =>
        dependencies.listCanvasGraphFiles({
          documentStoreRoot: resolveDocumentStoreRoot(env.promptRunnerRepoRoot)
        }),
      canvasGraph: async (_: unknown, args: { canvasPath?: string | null }) => {
        try {
          return await dependencies.getCanvasGraphSnapshot({
            documentStoreRoot: resolveDocumentStoreRoot(env.promptRunnerRepoRoot),
            canvasPath: args.canvasPath
          });
        } catch (error) {
          if (error instanceof Error && /does not exist\.$/u.test(error.message)) {
            return null;
          }

          throw error;
        }
      },
      systemCanvas: async (_: unknown, args: { selectedPromptId?: string | null }) =>
        buildSystemCanvasQuerySnapshot(args, dependencies),
      prompt: async (_: unknown, args: { id: string }) => dependencies.getPrompt(args.id),
      prompts: async (_: unknown, args: { limit?: number | null }) =>
        dependencies.listPrompts(args.limit),
      promptRunnerState: () => dependencies.getPromptRunnerState()
    },
    Mutation: {
      moveIdea: async (
        _: unknown,
        args: { input: { id: string; x: number; y: number } }
      ) => dependencies.moveIdea(args.input.id, args.input.x, args.input.y),
      createPrompt: async (
        _: unknown,
        args: { input: { content: string } }
      ) => dependencies.createPrompt(args.input.content),
      cancelPrompt: async (_: unknown, args: { id: string }) => dependencies.cancelPrompt(args.id),
      retryPrompt: async (_: unknown, args: { id: string }) => dependencies.retryPrompt(args.id),
      pausePromptRunner: async () => dependencies.pausePromptRunner(),
      resumePromptRunner: async () => dependencies.resumePromptRunner(),
      seedDemoGraph: async () => {
        await dependencies.ensureDemoGraph();
        return dependencies.getGraphSnapshot();
      }
    },
    Subscription: {
      promptWorkspace: {
        subscribe: () => dependencies.subscribePromptWorkspaceEvents(),
        resolve: async (
          event: { emittedAt: string; reason: string; promptId: string | null },
          args: { limit?: number | null }
        ) => ({
          emittedAt: event.emittedAt,
          reason: event.reason,
          promptId: event.promptId,
          promptRunnerState: dependencies.getPromptRunnerState(),
          prompts: await dependencies.listPrompts(args.limit)
        })
      }
    }
  };
};

export const resolvers = createResolvers();
