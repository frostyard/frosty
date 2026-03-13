import type { ToolDefinition, ToolResult } from "./types.js";

export const flatpakTools: ToolDefinition[] = [
  {
    name: "flatpak_list",
    description: "List installed Flatpak applications",
    risk: "safe",
  },
  {
    name: "flatpak_search",
    description: "Search Flathub for applications",
    risk: "safe",
  },
  {
    name: "flatpak_info",
    description: "Show details about an installed Flatpak application",
    risk: "safe",
  },
  {
    name: "flatpak_install",
    description: "Install a Flatpak application from Flathub",
    risk: "mutating",
  },
  {
    name: "flatpak_uninstall",
    description: "Remove an installed Flatpak application",
    risk: "mutating",
  },
  {
    name: "flatpak_update",
    description: "Update all installed Flatpak applications",
    risk: "mutating",
  },
];

export function buildFlatpakCommand(
  toolName: string,
  args: Record<string, unknown>,
): ToolResult {
  const tool = flatpakTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown flatpak tool: ${toolName}`);
  }

  let command: string;

  switch (toolName) {
    case "flatpak_list":
      command = "flatpak list --app --columns=application,name,version";
      break;
    case "flatpak_search":
      command = `flatpak search ${String(args.query)}`;
      break;
    case "flatpak_info":
      command = `flatpak info ${String(args.appId)}`;
      break;
    case "flatpak_install":
      command = `flatpak install -y flathub ${String(args.appId)}`;
      break;
    case "flatpak_uninstall":
      command = `flatpak uninstall -y ${String(args.appId)}`;
      break;
    case "flatpak_update":
      command = "flatpak update -y";
      break;
    default:
      throw new Error(`Unknown flatpak tool: ${toolName}`);
  }

  return { command, risk: tool.risk };
}
