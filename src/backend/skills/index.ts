import type { ToolDefinition, ToolResult } from "./types.js";
import { flatpakTools, buildFlatpakCommand } from "./flatpak.js";
import { shellTools, buildShellCommand } from "./shell.js";

const FLATPAK_NAMES = new Set(flatpakTools.map((t) => t.name));

export function getAllTools(): ToolDefinition[] {
  return [...flatpakTools, ...shellTools];
}

export function buildCommand(
  toolName: string,
  args: Record<string, unknown>,
): ToolResult {
  if (FLATPAK_NAMES.has(toolName)) {
    return buildFlatpakCommand(toolName, args);
  }
  if (toolName === "shell_exec") {
    return buildShellCommand(args);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
