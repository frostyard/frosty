import type { ToolDefinition, ToolResult } from "./types.js";

export const shellTools: ToolDefinition[] = [
  {
    name: "shell_exec",
    description: "Run an arbitrary shell command",
    risk: "mutating",
  },
];

const DANGEROUS_PIPE_PATTERN = /\|\s*(bash|sh|sudo)\b/;

export function buildShellCommand(args: Record<string, unknown>): ToolResult {
  const command = String(args.command);
  const risk = DANGEROUS_PIPE_PATTERN.test(command) ? "destructive" : "mutating";

  return { command, risk };
}
