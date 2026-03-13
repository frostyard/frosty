// === Risk levels for tool confirmation ===
export type RiskLevel = "safe" | "mutating" | "destructive";

// === Client → Server messages ===
export type ClientMessage =
  | UserMessage
  | ConfirmMessage
  | CancelMessage
  | SessionNewMessage
  | SessionLoadMessage;

export interface UserMessage {
  type: "message";
  text: string;
  sessionId: string;
}

export interface ConfirmMessage {
  type: "confirm";
  toolCallId: string;
  approved: boolean;
}

export interface CancelMessage {
  type: "cancel";
  toolCallId: string;
}

export interface SessionNewMessage {
  type: "session.new";
}

export interface SessionLoadMessage {
  type: "session.load";
  sessionId: string;
}

// === Server → Client messages ===
export type ServerMessage =
  | TextDeltaMessage
  | ToolRequestMessage
  | ToolRunningMessage
  | ToolOutputMessage
  | ToolDoneMessage
  | ErrorMessage;

export interface TextDeltaMessage {
  type: "text";
  delta: string;
}

export interface ToolRequestMessage {
  type: "tool.request";
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  risk: RiskLevel;
}

export interface ToolRunningMessage {
  type: "tool.running";
  toolCallId: string;
}

export interface ToolOutputMessage {
  type: "tool.output";
  toolCallId: string;
  delta: string;
}

export interface ToolDoneMessage {
  type: "tool.done";
  toolCallId: string;
  exitCode: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

// === Type guards ===
const CLIENT_TYPES = new Set([
  "message",
  "confirm",
  "cancel",
  "session.new",
  "session.load",
]);

export function isClientMessage(value: unknown): value is ClientMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as Record<string, unknown>).type === "string" &&
    CLIENT_TYPES.has((value as Record<string, unknown>).type as string)
  );
}

export function isUserMessage(msg: ClientMessage): msg is UserMessage {
  return msg.type === "message";
}

export function isConfirmMessage(msg: ClientMessage): msg is ConfirmMessage {
  return msg.type === "confirm";
}
