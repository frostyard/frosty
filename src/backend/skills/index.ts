import type { ToolDefinition, ToolResult } from "./types.js";
import { flatpakTools, buildFlatpakCommand } from "./flatpak.js";
import { shellTools, buildShellCommand } from "./shell.js";
import { brewTools, buildBrewCommand } from "./homebrew.js";

const FLATPAK_NAMES = new Set(flatpakTools.map((t) => t.name));
const BREW_NAMES = new Set(brewTools.map((t) => t.name));

export function getAllTools(): ToolDefinition[] {
  return [...flatpakTools, ...shellTools, ...brewTools];
}

export function buildCommand(toolName: string, args: Record<string, unknown>): ToolResult {
  if (FLATPAK_NAMES.has(toolName)) return buildFlatpakCommand(toolName, args);
  if (BREW_NAMES.has(toolName)) return buildBrewCommand(toolName, args);
  if (toolName === "shell_exec") return buildShellCommand(args);
  throw new Error(`Unknown tool: ${toolName}`);
}
