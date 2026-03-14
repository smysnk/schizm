import type { PromptRunner } from "./prompt-runner";

let promptRunner: PromptRunner | null = null;

export const setPromptRunner = (runner: PromptRunner) => {
  promptRunner = runner;
};

export const getPromptRunner = () => promptRunner;
