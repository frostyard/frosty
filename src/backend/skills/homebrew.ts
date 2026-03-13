import type { ToolDefinition, ToolResult } from "./types.js";
import { shellEscape } from "./types.js";

export const brewTools: ToolDefinition[] = [
  { name: "brew_list", description: "List installed Homebrew formulae and casks", risk: "safe" },
  { name: "brew_search", description: "Search for Homebrew formulae or casks", risk: "safe" },
  { name: "brew_info", description: "Show details about a Homebrew formula or cask", risk: "safe" },
  { name: "brew_install", description: "Install a Homebrew formula or cask", risk: "mutating" },
  { name: "brew_uninstall", description: "Remove an installed Homebrew formula or cask", risk: "mutating" },
  { name: "brew_update", description: "Fetch the latest Homebrew package index", risk: "safe" },
  { name: "brew_upgrade", description: "Upgrade installed Homebrew packages. Optionally specify a formula or use --greedy for casks", risk: "mutating" },
  { name: "brew_doctor", description: "Run Homebrew diagnostic checks", risk: "safe" },
  { name: "brew_cleanup", description: "Remove old versions and clear the Homebrew cache", risk: "mutating" },
];

export function buildBrewCommand(toolName: string, args: Record<string, unknown>): ToolResult {
  const tool = brewTools.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Unknown brew tool: ${toolName}`);

  let command: string;
  switch (toolName) {
    case "brew_list": command = "brew list"; break;
    case "brew_search": command = `brew search ${shellEscape(String(args.query))}`; break;
    case "brew_info": command = `brew info ${shellEscape(String(args.name))}`; break;
    case "brew_install": command = `brew install ${shellEscape(String(args.name))}`; break;
    case "brew_uninstall": command = `brew uninstall ${shellEscape(String(args.name))}`; break;
    case "brew_update": command = "brew update"; break;
    case "brew_upgrade": {
      const parts = ["brew upgrade"];
      if (args.greedy) parts.push("--greedy");
      if (args.formula) parts.push(shellEscape(String(args.formula)));
      command = parts.join(" ");
      break;
    }
    case "brew_doctor": command = "brew doctor"; break;
    case "brew_cleanup": command = "brew cleanup"; break;
    default: throw new Error(`Unknown brew tool: ${toolName}`);
  }
  return { command, risk: tool.risk };
}
