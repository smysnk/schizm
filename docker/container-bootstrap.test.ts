import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bootstrapScript = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "container-bootstrap.sh"
);

const runGit = async (cwd: string, args: string[]) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: process.env,
    encoding: "utf8"
  });

  return stdout.trim();
};

const runBootstrapCommand = async (
  command: string,
  envOverrides: Record<string, string>
) => {
  await execFileAsync(
    "bash",
    ["-lc", `. "${bootstrapScript}"; ${command}`],
    {
      env: {
        ...process.env,
        ...envOverrides
      }
    }
  );
};

test("configure_ssh writes ~/.ssh/id_ed25519 with secure permissions", async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "schizm-container-bootstrap-ssh-"));
  const homeDirectory = path.join(rootDirectory, "home");
  const privateKey = [
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "demo-private-key",
    "-----END OPENSSH PRIVATE KEY-----",
    ""
  ].join("\n");

  try {
    await mkdir(homeDirectory, { recursive: true });

    await runBootstrapCommand("configure_ssh", {
      HOME: homeDirectory,
      PATH: "/usr/bin:/bin",
      DOCUMENT_STORE_SSH_PRIVATE_KEY_BASE64: Buffer.from(privateKey, "utf8").toString("base64"),
      DOCUMENT_STORE_GIT_URL: ""
    });

    const keyPath = path.join(homeDirectory, ".ssh", "id_ed25519");
    const keyStat = await stat(keyPath);

    assert.equal(await readFile(keyPath, "utf8"), privateKey);
    assert.equal(keyStat.mode & 0o777, 0o600);
    assert.equal(await readFile(path.join(homeDirectory, ".ssh", "config"), "utf8").then((value) => value.includes("IdentityFile")), true);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("configure_codex_auth restores ~/.codex/auth.json from base64", async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "schizm-container-bootstrap-codex-"));
  const homeDirectory = path.join(rootDirectory, "home");
  const codexHome = path.join(homeDirectory, ".codex");
  const authJson = JSON.stringify({ access_token: "demo-token" }, null, 2);

  try {
    await mkdir(homeDirectory, { recursive: true });

    await runBootstrapCommand("configure_codex_auth", {
      HOME: homeDirectory,
      PATH: "/usr/bin:/bin",
      CODEX_HOME: codexHome,
      CODEX_AUTH_JSON_BASE64: Buffer.from(authJson, "utf8").toString("base64")
    });

    const authPath = path.join(codexHome, "auth.json");
    const authStat = await stat(authPath);

    assert.equal(await readFile(authPath, "utf8"), authJson);
    assert.equal(authStat.mode & 0o777, 0o600);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("sync_document_store_repo clones and refreshes the configured branch in container mode", async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "schizm-container-bootstrap-clone-"));
  const remoteRoot = path.join(rootDirectory, "origin.git");
  const seedRoot = path.join(rootDirectory, "seed");
  const cloneRoot = path.join(rootDirectory, "obsidian-repository");

  try {
    await mkdir(seedRoot, { recursive: true });
    await runGit(seedRoot, ["init", "-b", "main"]);
    await runGit(seedRoot, ["config", "user.name", "Schizm Tests"]);
    await runGit(seedRoot, ["config", "user.email", "schizm-tests@example.com"]);
    await writeFile(path.join(seedRoot, "audit.md"), "# Audit\n", "utf8");
    await runGit(seedRoot, ["add", "audit.md"]);
    await runGit(seedRoot, ["commit", "-m", "Initial commit"]);

    await runGit(rootDirectory, ["init", "--bare", remoteRoot]);
    await runGit(seedRoot, ["remote", "add", "origin", remoteRoot]);
    await runGit(seedRoot, ["push", "-u", "origin", "main"]);

    await runBootstrapCommand("sync_document_store_repo", {
      HOME: rootDirectory,
      PROMPT_RUNNER_EXECUTION_MODE: "container",
      DOCUMENT_STORE_GIT_URL: remoteRoot,
      DOCUMENT_STORE_GIT_BRANCH: "main",
      DOCUMENT_STORE_DIR: cloneRoot,
      DOCUMENT_STORE_GIT_AUTHOR_NAME: "Schizm Bot",
      DOCUMENT_STORE_GIT_AUTHOR_EMAIL: "schizm-bot@example.com"
    });

    assert.equal(await readFile(path.join(cloneRoot, "audit.md"), "utf8"), "# Audit\n");
    assert.equal(await runGit(cloneRoot, ["config", "user.name"]), "Schizm Bot");
    assert.equal(
      await runGit(cloneRoot, ["config", "user.email"]),
      "schizm-bot@example.com"
    );

    await writeFile(path.join(cloneRoot, "local-only.md"), "temp\n", "utf8");
    await chmod(path.join(cloneRoot, "local-only.md"), 0o644);

    await writeFile(path.join(seedRoot, "note.md"), "Remote update.\n", "utf8");
    await runGit(seedRoot, ["add", "note.md"]);
    await runGit(seedRoot, ["commit", "-m", "Add remote note"]);
    await runGit(seedRoot, ["push", "origin", "main"]);

    await runBootstrapCommand("sync_document_store_repo", {
      HOME: rootDirectory,
      PROMPT_RUNNER_EXECUTION_MODE: "container",
      DOCUMENT_STORE_GIT_URL: remoteRoot,
      DOCUMENT_STORE_GIT_BRANCH: "main",
      DOCUMENT_STORE_DIR: cloneRoot,
      DOCUMENT_STORE_GIT_AUTHOR_NAME: "Schizm Bot",
      DOCUMENT_STORE_GIT_AUTHOR_EMAIL: "schizm-bot@example.com"
    });

    assert.equal(await readFile(path.join(cloneRoot, "note.md"), "utf8"), "Remote update.\n");
    await assert.rejects(() => readFile(path.join(cloneRoot, "local-only.md"), "utf8"), /ENOENT/);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
