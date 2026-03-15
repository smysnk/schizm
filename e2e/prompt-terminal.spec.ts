import { expect, test, type Page } from "@playwright/test";

const promptText =
  "I keep noticing that the thoughts I avoid all day only come back when I'm washing dishes at night, like the running water gives them permission to surface.";
const longWrapPromptText =
  "sometimesathoughtarrivesasasingleunbrokenthreadthatstillneedstowrapcleanlyinsidetheterminalwithoutspillingpastthelcdedge".repeat(
    6
  );
const firstPlaceholderQuestion = "What are you thinking about?";

type TerminalStyleSample = {
  userColor: string;
  userOpacity: string;
  userAnimationName: string;
  contentAnimationName: string;
  beforeAnimationName: string;
  afterAnimationName: string;
};

async function collectTerminalStyleSamples(page: Page): Promise<TerminalStyleSample[]> {
  return page.evaluate(async () => {
    const form = document.querySelector("[data-testid='prompt-zen-form']");
    const content = document.querySelector("[data-testid='prompt-terminal-content']");
    const userEntry = document.querySelector("[data-testid='prompt-terminal-user']");

    if (!(form instanceof HTMLElement) || !(content instanceof HTMLElement) || !(userEntry instanceof HTMLElement)) {
      throw new Error("Prompt terminal elements were not found.");
    }

    const readSample = () => {
      const userStyle = window.getComputedStyle(userEntry);
      return {
        userColor: userStyle.color,
        userOpacity: userStyle.opacity,
        userAnimationName: userStyle.animationName,
        contentAnimationName: window.getComputedStyle(content).animationName,
        beforeAnimationName: window.getComputedStyle(form, "::before").animationName,
        afterAnimationName: window.getComputedStyle(form, "::after").animationName
      };
    };

    const samples = [readSample()];

    for (let index = 0; index < 5; index += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      samples.push(readSample());
    }

    return samples;
  });
}

type TerminalBounds = {
  terminalRect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  userRectCount: number;
  visibleViolationCount: number;
  visibleViolations: Array<{
    entryIndex: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>;
};

async function collectTerminalBounds(page: Page): Promise<TerminalBounds> {
  return page.getByTestId("prompt-terminal").evaluate((terminal) => {
    const terminalRect = terminal.getBoundingClientRect();
    const entries = Array.from(terminal.querySelectorAll(".prompt-zen__terminal-entry"));
    const userEntry = terminal.querySelector("[data-testid='prompt-terminal-user']");

    const getRangeRects = (element: Element | null) => {
      if (!element) {
        return [];
      }

      const range = document.createRange();
      range.selectNodeContents(element);

      return Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        }));
    };

    const userRects = getRangeRects(userEntry);
    const visibleViolations: Array<{
      entryIndex: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    }> = [];

    entries.forEach((entry, entryIndex) => {
      for (const rect of getRangeRects(entry)) {
        const intersectsViewport =
          rect.bottom > terminalRect.top && rect.top < terminalRect.bottom;

        if (!intersectsViewport) {
          continue;
        }

        if (
          rect.left < terminalRect.left - 1 ||
          rect.right > terminalRect.right + 1 ||
          rect.top < terminalRect.top - 1 ||
          rect.bottom > terminalRect.bottom + 1
        ) {
          visibleViolations.push({
            entryIndex,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
          });
        }
      }
    });

    return {
      terminalRect: {
        left: terminalRect.left,
        right: terminalRect.right,
        top: terminalRect.top,
        bottom: terminalRect.bottom
      },
      userRectCount: userRects.length,
      visibleViolationCount: visibleViolations.length,
      visibleViolations
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = {
      prompts: [] as Array<Record<string, unknown>>,
      promptRunnerState: {
        paused: false,
        inFlight: false,
        activePromptId: null,
        activePromptStatus: null,
        pollMs: 5000,
        automationBranch: "codex/mindmap",
        worktreeRoot: ".codex-workdirs",
        runnerSessionId: "runner-e2e"
      },
      subscriptions: new Map<string, (payload: Record<string, unknown>) => void>(),
      nextId: 0
    };

    const now = () => new Date().toISOString();
    const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

    const buildWorkspacePayload = (reason: string, promptId: string | null = null) => ({
      emittedAt: now(),
      reason,
      promptId,
      promptRunnerState: clone(state.promptRunnerState),
      prompts: clone(state.prompts)
    });

    const emitWorkspace = (reason: string, promptId: string | null = null) => {
      const payload = buildWorkspacePayload(reason, promptId);

      for (const send of state.subscriptions.values()) {
        send(payload);
      }
    };

    const pushTransition = (
      prompt: Record<string, unknown>,
      status:
        | "scanning"
        | "deciding"
        | "writing"
        | "updating_canvas"
        | "auditing"
        | "syncing_audit"
        | "committing"
        | "pushing",
      reason: string
    ) => {
      const metadata = (prompt.metadata as Record<string, unknown>) || {};
      const runner = (metadata.runner as Record<string, unknown>) || {};
      const statusTransitions = Array.isArray(runner.statusTransitions)
        ? [...(runner.statusTransitions as Array<Record<string, unknown>>)]
        : [];

      statusTransitions.push({
        status,
        at: now(),
        reason
      });

      prompt.metadata = {
        ...metadata,
        runner: {
          ...runner,
          statusTransitions
        }
      };
    };

    const updatePromptStatus = (
      promptId: string,
      status:
        | "scanning"
        | "deciding"
        | "writing"
        | "updating_canvas"
        | "auditing"
        | "syncing_audit"
        | "committing"
        | "pushing"
        | "completed",
      reason: string
    ) => {
      const prompt = state.prompts.find((entry) => entry.id === promptId);

      if (!prompt) {
        return;
      }

      if (status === "completed") {
        prompt.status = "completed";
        prompt.finishedAt = now();
        prompt.updatedAt = now();
        prompt.audit = {
          branch: "codex/mindmap",
          sha: "14322c797065fa6ec19970b02ba6fd56c56140e7"
        };
        state.promptRunnerState.inFlight = false;
        state.promptRunnerState.activePromptId = null;
        state.promptRunnerState.activePromptStatus = null;
        emitWorkspace("Prompt updated to completed.", promptId);
        return;
      }

      prompt.status = status;
      prompt.startedAt = prompt.startedAt || now();
      prompt.updatedAt = now();
      pushTransition(prompt, status, reason);
      state.promptRunnerState.inFlight = true;
      state.promptRunnerState.activePromptId = promptId;
      state.promptRunnerState.activePromptStatus = status;
      emitWorkspace(`Prompt updated to ${status}.`, promptId);
    };

    const scheduleLifecycle = (promptId: string) => {
      const steps: Array<{
        delayMs: number;
        status:
          | "scanning"
          | "deciding"
          | "writing"
          | "updating_canvas"
          | "auditing"
          | "syncing_audit"
          | "committing"
          | "pushing"
          | "completed";
        reason: string;
      }> = [
        {
          delayMs: 220,
          status: "scanning",
          reason: "Preparing isolated git worktree."
        },
        {
          delayMs: 520,
          status: "deciding",
          reason: "Assembling Codex instruction payload."
        },
        {
          delayMs: 880,
          status: "writing",
          reason: "Launching Codex CLI."
        },
        {
          delayMs: 5200,
          status: "updating_canvas",
          reason: "Validating Obsidian canvas updates."
        },
        {
          delayMs: 5620,
          status: "auditing",
          reason: "Parsing Codex output."
        },
        {
          delayMs: 5980,
          status: "syncing_audit",
          reason: "Syncing audit.md back into the prompt row."
        },
        {
          delayMs: 6340,
          status: "committing",
          reason: "Promoting prompt branch onto codex/mindmap."
        },
        {
          delayMs: 6700,
          status: "pushing",
          reason: "Pushing codex/mindmap to origin."
        },
        {
          delayMs: 7060,
          status: "completed",
          reason: "Run complete."
        }
      ];

      for (const step of steps) {
        window.setTimeout(() => {
          updatePromptStatus(promptId, step.status, step.reason);
        }, step.delayMs);
      }
    };

    const jsonResponse = (payload: Record<string, unknown>) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (!url.includes("/graphql")) {
        return originalFetch(input, init);
      }

      const rawBody =
        typeof init?.body === "string"
          ? init.body
          : init?.body instanceof URLSearchParams
            ? init.body.toString()
            : "";
      const body = rawBody ? JSON.parse(rawBody) : {};
      const operationName = body.operationName || "";

      if (operationName === "Prompts") {
        return jsonResponse({
          data: {
            promptRunnerState: state.promptRunnerState,
            prompts: state.prompts
          }
        });
      }

      if (operationName === "CreatePrompt") {
        const createdAt = now();
        const promptId = `e2e-${String(++state.nextId).padStart(4, "0")}`;
        const prompt = {
          id: promptId,
          content: body.variables?.input?.content || "",
          status: "queued",
          metadata: {},
          audit: {},
          startedAt: null,
          finishedAt: null,
          errorMessage: null,
          createdAt,
          updatedAt: createdAt
        };

        state.prompts = [prompt];
        emitWorkspace("Prompt created and queued.", promptId);
        scheduleLifecycle(promptId);

        return jsonResponse({
          data: {
            createPrompt: clone(prompt)
          }
        });
      }

      if (operationName === "PausePromptRunner") {
        state.promptRunnerState.paused = true;
        emitWorkspace("Prompt runner paused by operator.");
        return jsonResponse({
          data: {
            pausePromptRunner: clone(state.promptRunnerState)
          }
        });
      }

      if (operationName === "ResumePromptRunner") {
        state.promptRunnerState.paused = false;
        emitWorkspace("Prompt runner resumed by operator.");
        return jsonResponse({
          data: {
            resumePromptRunner: clone(state.promptRunnerState)
          }
        });
      }

      return jsonResponse({ data: {} });
    };

    const NativeWebSocket = window.WebSocket;

    class MockGraphqlSocket extends EventTarget {
      url: string;
      readyState: number;
      onopen: ((event: Event) => void) | null;
      onmessage: ((event: MessageEvent<string>) => void) | null;
      onclose: ((event: CloseEvent) => void) | null;
      onerror: ((event: Event) => void) | null;

      constructor(url: string) {
        super();
        this.url = url;
        this.readyState = 0;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;

        window.setTimeout(() => {
          this.readyState = 1;
          const openEvent = new Event("open");
          this.dispatchEvent(openEvent);
          this.onopen?.(openEvent);
        }, 0);
      }

      send(rawMessage: string) {
        const message = JSON.parse(rawMessage);

        if (message.type === "connection_init") {
          window.setTimeout(() => {
            this.dispatchJson({ type: "connection_ack" });
          }, 0);
          return;
        }

        if (message.type === "subscribe") {
          const subscriptionId = message.id;
          state.subscriptions.set(subscriptionId, (payload) => {
            this.dispatchJson({
              id: subscriptionId,
              type: "next",
              payload: {
                data: {
                  promptWorkspace: payload
                }
              }
            });
          });
          this.dispatchJson({
            id: subscriptionId,
            type: "next",
            payload: {
              data: {
                promptWorkspace: buildWorkspacePayload("Initial workspace snapshot.")
              }
            }
          });
          return;
        }

        if (message.type === "complete") {
          state.subscriptions.delete(message.id);
        }
      }

      close() {
        this.readyState = 3;
        const closeEvent = new CloseEvent("close", { code: 1000 });
        this.dispatchEvent(closeEvent);
        this.onclose?.(closeEvent);
      }

      dispatchJson(payload: Record<string, unknown>) {
        const messageEvent = new MessageEvent("message", {
          data: JSON.stringify(payload)
        });
        this.dispatchEvent(messageEvent);
        this.onmessage?.(messageEvent);
      }
    }

    const GraphqlAwareWebSocket = function (
      this: unknown,
      url: string | URL,
      protocols?: string | string[]
    ) {
      const normalizedUrl = typeof url === "string" ? url : url.toString();

      if (normalizedUrl.includes("/graphql")) {
        return new MockGraphqlSocket(normalizedUrl);
      }

      return new NativeWebSocket(url, protocols);
    } as unknown as typeof WebSocket;

    GraphqlAwareWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    GraphqlAwareWebSocket.OPEN = NativeWebSocket.OPEN;
    GraphqlAwareWebSocket.CLOSING = NativeWebSocket.CLOSING;
    GraphqlAwareWebSocket.CLOSED = NativeWebSocket.CLOSED;
    GraphqlAwareWebSocket.prototype = NativeWebSocket.prototype;

    window.WebSocket = GraphqlAwareWebSocket;
  });
});

test("types the live placeholder as a clean prefix sequence with no simulated typos", async ({
  page
}) => {
  await page.goto("/");

  const textarea = page.locator("#prompt-input");
  await expect(textarea).toBeVisible();

  const samples = await page.evaluate(async () => {
    const field = document.querySelector("#prompt-input");

    if (!(field instanceof HTMLTextAreaElement)) {
      throw new Error("Prompt input was not found.");
    }

    const values: string[] = [];

    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      values.push(field.getAttribute("placeholder") || "");
    }

    return values;
  });

  const nonEmptySamples = samples.filter((value) => value.length > 0);

  expect(nonEmptySamples.length).toBeGreaterThan(0);

  let previousLength = 0;
  for (const sample of nonEmptySamples) {
    expect(firstPlaceholderQuestion.startsWith(sample)).toBe(true);
    expect(sample.length).toBeGreaterThanOrEqual(previousLength);
    previousLength = sample.length;
  }
});

test("keeps terminal text stable while the live teletype response starts", async ({
  page
}) => {
  await page.goto("/");

  const textarea = page.locator("#prompt-input");
  await expect(textarea).toBeVisible();

  const placeholderColor = await textarea.evaluate((element) =>
    window.getComputedStyle(element, "::placeholder").color
  );
  const composeTextColor = await textarea.evaluate((element) => window.getComputedStyle(element).color);

  await textarea.click();
  await textarea.fill(promptText);

  const composeCursor = page.getByTestId("prompt-compose-cursor");
  await expect(composeCursor).toBeVisible();

  const composeCursorStyle = await composeCursor.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      borderTopStyle: style.borderTopStyle
    };
  });

  expect(composeCursorStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(composeCursorStyle.borderTopWidth).toBe("0px");
  expect(composeCursorStyle.borderTopStyle).toBe("none");

  await textarea.press("Enter");

  const promptTerminal = page.getByTestId("prompt-terminal");
  await expect(promptTerminal).toBeVisible();
  await expect(page.getByTestId("prompt-terminal-user")).toContainText(promptText);

  const terminalCursor = page.locator(".prompt-zen__terminal-cursor").first();
  await expect
    .poll(async () => terminalCursor.isVisible().catch(() => false))
    .toBe(true);

  const terminalCursorStyle = await terminalCursor.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      borderTopStyle: style.borderTopStyle,
      borderTopColor: style.borderTopColor
    };
  });

  expect(terminalCursorStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(terminalCursorStyle.borderTopWidth).not.toBe("0px");
  expect(terminalCursorStyle.borderTopStyle).toBe("solid");
  expect(terminalCursorStyle.borderTopColor).toBe(placeholderColor);

  const styleSamples = await collectTerminalStyleSamples(page);
  for (const sample of styleSamples) {
    expect(sample.userColor).toBe(composeTextColor);
    expect(sample.userOpacity).toBe("1");
    expect(sample.userAnimationName).toBe("none");
    expect(sample.contentAnimationName).toBe("none");
    expect(sample.beforeAnimationName).toBe("none");
    expect(sample.afterAnimationName).toBe("none");
  }

  await expect(promptTerminal).toContainText("OK");
  await expect(promptTerminal).toContainText("# queued for isolated git + codex run");
  await expect(promptTerminal).toContainText("# preparing isolated git worktree");
  await expect(promptTerminal).toContainText("# running codex cli");

  const ackColor = await page
    .locator("[data-kind='ack']")
    .first()
    .evaluate((element) => window.getComputedStyle(element).color);

  expect(ackColor).toBe(placeholderColor);

  await expect
    .poll(async () => {
      const working = page.getByTestId("prompt-terminal-working");
      return working.isVisible().catch(() => false);
    })
    .toBe(true);

  await expect
    .poll(async () =>
      promptTerminal.evaluate((element) => {
        const content = element.querySelector("[data-testid='prompt-terminal-content']");
        if (!(content instanceof HTMLElement)) {
          return false;
        }

        return content.scrollHeight > element.clientHeight;
      })
    )
    .toBe(true);

  await expect(page.locator(".history-surface")).toBeVisible({ timeout: 12_000 });
  await expect(page.locator(".surface-toggle__button[data-active='true']")).toContainText(
    "Prompt history"
  );
  await expect(page.locator(".prompt-history__grid")).toContainText(
    "I keep noticing that the thoughts I avoid all day"
  );
});

test("keeps terminal text inside the lcd bounds and wraps long prompt content", async ({
  page
}) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/");

  const textarea = page.locator("#prompt-input");
  await expect(textarea).toBeVisible();

  await textarea.click();
  await textarea.fill(longWrapPromptText);
  await textarea.press("Enter");

  const promptTerminal = page.getByTestId("prompt-terminal");
  await expect(promptTerminal).toBeVisible();
  await expect(promptTerminal).toContainText("OK");
  await expect(page.getByTestId("prompt-terminal-user")).toContainText(
    longWrapPromptText.slice(0, 48)
  );

  const bounds = await collectTerminalBounds(page);

  expect(bounds.userRectCount).toBeGreaterThan(1);
  expect(bounds.visibleViolationCount).toBe(0);
});
