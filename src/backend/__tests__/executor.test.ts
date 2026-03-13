import { describe, it, expect, vi } from "vitest";
import { executeCommand } from "../executor.js";

describe("executeCommand", () => {
  it("captures stdout from a simple command", async () => {
    const chunks: string[] = [];
    const result = await executeCommand("echo hello", (chunk) => {
      chunks.push(chunk);
    });

    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toContain("hello");
  });

  it("returns non-zero exit code on failure", async () => {
    const result = await executeCommand("exit 42", () => {});
    expect(result.exitCode).toBe(42);
  });

  it("captures stderr in output", async () => {
    const chunks: string[] = [];
    const result = await executeCommand(
      "echo err >&2",
      (chunk) => chunks.push(chunk),
    );

    expect(result.exitCode).toBe(0);
    expect(chunks.join("")).toContain("err");
  });
});
