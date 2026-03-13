import { z } from "zod";
import { run } from "one-agent-sdk";
import type { ToolDef, RunConfig, StreamChunk } from "one-agent-sdk";
import { buildSystemPrompt } from "./system-prompt.js";
import { getAllTools, buildCommand } from "./skills/index.js";
import { executeCommand } from "./executor.js";
import { loadSettings } from "./settings.js";
import { ConfirmationManager } from "./confirmations.js";
import type { SendFn } from "./ipc.js";

const confirmations = new ConfirmationManager();

export function resolveConfirmation(
  toolCallId: string,
  approved: boolean,
): void {
  confirmations.resolve(toolCallId, approved);
}

/**
 * Build one-agent-sdk ToolDef[] from the skill registry.
 *
 * Each handler performs the full lifecycle:
 *   1. Build the shell command from the skill registry
 *   2. Send a tool.request to the frontend
 *   3. Await confirmation for non-safe operations
 *   4. Execute the command, streaming output to the frontend
 *   5. Return the result string to the model
 */
function createAgentTools(send: SendFn): ToolDef[] {
  const skillDefs = getAllTools();
  return skillDefs.map((def) => {
    // Build a Zod schema from the tool name.
    // Tools with no args get an empty object schema; tools with known
    // params get the appropriate fields.
    const schema = buildParamsSchema(def.name);
    return {
      name: def.name,
      description: def.description,
      parameters: schema,
      handler: async (params: unknown): Promise<string> => {
        const args = (params ?? {}) as Record<string, unknown>;
        const { command, risk } = buildCommand(def.name, args);
        const toolCallId = crypto.randomUUID();

        send({
          type: "tool.request",
          toolCallId,
          name: def.name,
          args,
          risk,
        });

        if (risk !== "safe") {
          const approved = await confirmations.waitForConfirmation(toolCallId);
          if (!approved) {
            send({ type: "tool.done", toolCallId, exitCode: -1 });
            return "Tool execution was denied by the user.";
          }
        }

        send({ type: "tool.running", toolCallId });

        const result = await executeCommand(command, (chunk) => {
          send({ type: "tool.output", toolCallId, delta: chunk });
        });

        send({ type: "tool.done", toolCallId, exitCode: result.exitCode });

        const output = (result.stdout + result.stderr).trim();
        return output || `Command completed with exit code ${result.exitCode}`;
      },
    };
  });
}

/**
 * Map tool names to Zod parameter schemas.
 */
function buildParamsSchema(toolName: string): z.ZodType {
  switch (toolName) {
    case "flatpak_list":
    case "flatpak_update":
      return z.object({});

    case "flatpak_search":
      return z.object({
        query: z.string().describe("Search query"),
      });

    case "flatpak_info":
      return z.object({
        appId: z
          .string()
          .describe(
            "Flatpak application ID (e.g. org.mozilla.firefox)",
          ),
      });

    case "flatpak_install":
      return z.object({
        appId: z
          .string()
          .describe("Flatpak application ID to install"),
      });

    case "flatpak_uninstall":
      return z.object({
        appId: z
          .string()
          .describe("Flatpak application ID to remove"),
      });

    case "shell_exec":
      return z.object({
        command: z
          .string()
          .describe("The shell command to execute"),
      });

    case "brew_list":
    case "brew_update":
    case "brew_doctor":
    case "brew_cleanup":
      return z.object({});

    case "brew_search":
      return z.object({
        query: z.string().describe("Search query"),
      });

    case "brew_info":
      return z.object({
        name: z.string().describe("Formula or cask name"),
      });

    case "brew_install":
      return z.object({
        name: z.string().describe("Formula or cask name to install"),
      });

    case "brew_uninstall":
      return z.object({
        name: z.string().describe("Formula or cask name to remove"),
      });

    case "brew_upgrade":
      return z.object({
        formula: z.string().optional().describe("Specific formula to upgrade (omit for all)"),
        greedy: z.boolean().optional().describe("Use --greedy to upgrade casks with auto-updates"),
      });

    default:
      return z.object({});
  }
}

export async function handleUserMessage(
  text: string,
  send: SendFn,
): Promise<void> {
  const settings = loadSettings();
  const tools = createAgentTools(send);

  const config: RunConfig = {
    provider: (settings.provider || "claude-code") as RunConfig["provider"],
    agent: {
      name: "frosty",
      description: "Snow Linux system administration assistant",
      prompt: buildSystemPrompt(),
      tools,
      model: settings.model,
    },
    maxTurns: 20,
    providerOptions: settings.apiKey
      ? { apiKey: settings.apiKey }
      : undefined,
  };

  const agentRun = await run(text, config);

  try {
    for await (const chunk of agentRun.stream) {
      switch (chunk.type) {
        case "text":
          send({ type: "text", delta: chunk.text });
          break;

        case "error":
          send({ type: "error", message: chunk.error });
          break;

        // tool_call and tool_result are handled inside the tool handlers,
        // which stream output to the frontend via send(). We don't need
        // to act on them here — the provider loop drives them automatically.
        case "tool_call":
        case "tool_result":
        case "handoff":
        case "done":
          break;
      }
    }
  } finally {
    await agentRun.close();
  }
}
