import type { RiskLevel } from "../ipc-types.js";

export interface ToolDefinition {
  name: string;
  description: string;
  risk: RiskLevel;
}

export interface ToolResult {
  command: string;
  risk: RiskLevel;
}
