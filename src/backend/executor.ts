import { spawn } from "node:child_process";

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function executeCommand(
  command: string,
  onOutput: (chunk: string) => void,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdoutChunks.push(text);
      onOutput(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderrChunks.push(text);
      onOutput(text);
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
  });
}
