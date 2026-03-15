import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const runGit = async (repoRoot: string, args: string[]) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8"
  });

  return stdout.trim();
};

export type ContainerRepoVerificationResult = {
  branch: string;
  remoteName: string;
  headSha: string;
  remoteSha: string;
};

export const verifyContainerDocumentRepoPush = async ({
  repoRoot,
  remoteName,
  branch,
  expectedCommitSha
}: {
  repoRoot: string;
  remoteName: string;
  branch: string;
  expectedCommitSha?: string | null;
}): Promise<ContainerRepoVerificationResult> => {
  const headSha = await runGit(repoRoot, ["rev-parse", "HEAD"]);
  const workingTreeStatus = await runGit(repoRoot, ["status", "--porcelain"]);

  if (expectedCommitSha && headSha !== expectedCommitSha) {
    throw new Error(
      `Container document store HEAD mismatch. Expected ${expectedCommitSha}, received ${headSha}.`
    );
  }

  if (workingTreeStatus) {
    throw new Error(
      `Container document store has uncommitted changes after Codex completed:\n${workingTreeStatus}`
    );
  }

  const remoteRef = `refs/heads/${branch}`;
  const remoteOutput = await runGit(repoRoot, ["ls-remote", remoteName, remoteRef]);

  if (!remoteOutput) {
    throw new Error(
      `Unable to resolve ${remoteName}/${branch} while verifying the container document store push.`
    );
  }

  const remoteSha = remoteOutput.split(/\s+/)[0] || "";

  if (!remoteSha) {
    throw new Error(
      `Remote ${remoteName}/${branch} did not return a commit SHA during verification.`
    );
  }

  if (remoteSha !== headSha) {
    throw new Error(
      `Container document store push verification failed. HEAD ${headSha} does not match ${remoteName}/${branch} ${remoteSha}.`
    );
  }

  return {
    branch,
    remoteName,
    headSha,
    remoteSha
  };
};
