# Frosty MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working AI system administration assistant for Snow Linux with a GTK4/LibAdwaita chat UI, a Node.js agent backend using one-agent-sdk, and Flatpak + Shell skills.

**Architecture:** Two-process design — a Gjs/GTK4 frontend communicates with a Node.js backend over a Unix domain socket using newline-delimited JSON. The backend uses one-agent-sdk to route to the user's chosen AI provider and executes system commands via typed tool definitions.

**Tech Stack:** TypeScript (Node.js backend, one-agent-sdk, Zod), JavaScript/Gjs (GTK4/LibAdwaita frontend), Unix domain sockets, JSON-line IPC.

**Spec:** `docs/superpowers/specs/2026-03-13-frosty-design.md`

---

## Chunk 1: Project Scaffolding & Backend Core

### Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize npm project**

```bash
cd /home/bjk/projects/scratch/frosty
npm init -y
```

- [ ] **Step 2: Install backend dependencies**

```bash
npm install one-agent-sdk zod
npm install -D typescript @types/node tsx
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/backend/**/*.ts"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 5: Update package.json scripts**

Add to `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "backend": "tsx src/backend/main.ts",
    "build": "tsc"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "feat: initialize project with TypeScript and one-agent-sdk"
```

---

### Task 2: IPC Protocol Types

**Files:**
- Create: `src/backend/ipc-types.ts`
- Test: `src/backend/__tests__/ipc-types.test.ts`

This file defines the shared message types for the Unix socket protocol. Both frontend and backend reference these types.

- [ ] **Step 1: Write the test for message type guards**

Create `src/backend/__tests__/ipc-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isClientMessage,
  isUserMessage,
  isConfirmMessage,
  type ClientMessage,
  type ServerMessage,
} from "../ipc-types.js";

describe("isClientMessage", () => {
  it("accepts a valid user message", () => {
    const msg = { type: "message", text: "hello", sessionId: "abc" };
    expect(isClientMessage(msg)).toBe(true);
    expect(isUserMessage(msg as ClientMessage)).toBe(true);
  });

  it("accepts a valid confirm message", () => {
    const msg = { type: "confirm", toolCallId: "t1", approved: true };
    expect(isClientMessage(msg)).toBe(true);
    expect(isConfirmMessage(msg as ClientMessage)).toBe(true);
  });

  it("accepts a cancel message", () => {
    const msg = { type: "cancel", toolCallId: "t1" };
    expect(isClientMessage(msg)).toBe(true);
  });

  it("accepts session.new", () => {
    const msg = { type: "session.new" };
    expect(isClientMessage(msg)).toBe(true);
  });

  it("accepts session.load", () => {
    const msg = { type: "session.load", sessionId: "abc" };
    expect(isClientMessage(msg)).toBe(true);
  });

  it("rejects unknown type", () => {
    expect(isClientMessage({ type: "unknown" })).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isClientMessage("hello")).toBe(false);
    expect(isClientMessage(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Install vitest and run test to verify it fails**

```bash
npm install -D vitest
npx vitest run src/backend/__tests__/ipc-types.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ipc-types.ts**

Create `src/backend/ipc-types.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/ipc-types.test.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/ipc-types.ts src/backend/__tests__/ipc-types.test.ts
git commit -m "feat: add IPC protocol message types with type guards"
```

---

### Task 3: Command Executor

**Files:**
- Create: `src/backend/executor.ts`
- Test: `src/backend/__tests__/executor.test.ts`

The executor spawns shell commands, captures stdout/stderr, and streams output line-by-line via a callback. It returns the exit code when done.

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/executor.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/executor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement executor.ts**

Create `src/backend/executor.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/executor.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/executor.ts src/backend/__tests__/executor.test.ts
git commit -m "feat: add command executor with streaming output"
```

---

### Task 4: IPC Server

**Files:**
- Create: `src/backend/ipc.ts`
- Test: `src/backend/__tests__/ipc.test.ts`

The IPC server listens on a Unix domain socket, accepts a single client connection, parses incoming JSON lines into `ClientMessage` objects, and provides a `send()` method to write `ServerMessage` objects back.

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/ipc.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createIPCServer } from "../ipc.js";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ClientMessage, ServerMessage } from "../ipc-types.js";

function tmpSocket(): string {
  return join(tmpdir(), `frosty-test-${randomUUID()}.sock`);
}

function connectAndSend(
  socketPath: string,
  msg: ClientMessage,
): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const client = connect(socketPath, () => {
      client.write(JSON.stringify(msg) + "\n");
    });

    const chunks: string[] = [];
    client.on("data", (data) => chunks.push(data.toString()));
    client.on("error", reject);

    // Give the server time to respond, then close
    setTimeout(() => {
      client.end();
      const messages = chunks
        .join("")
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as ServerMessage);
      resolve(messages);
    }, 200);
  });
}

describe("IPC Server", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it("receives a client message and sends a response", async () => {
    const socketPath = tmpSocket();
    const received: ClientMessage[] = [];

    const server = await createIPCServer(socketPath, async (msg, send) => {
      received.push(msg);
      send({ type: "text", delta: "got it" });
    });
    cleanup = server.close;

    const responses = await connectAndSend(socketPath, {
      type: "message",
      text: "hello",
      sessionId: "s1",
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("message");
    expect(responses).toHaveLength(1);
    expect(responses[0]).toEqual({ type: "text", delta: "got it" });
  });

  it("ignores invalid JSON lines", async () => {
    const socketPath = tmpSocket();
    const received: ClientMessage[] = [];

    const server = await createIPCServer(socketPath, async (msg, send) => {
      received.push(msg);
    });
    cleanup = server.close;

    await new Promise<void>((resolve) => {
      const client = connect(socketPath, () => {
        client.write("not json\n");
        client.write('{"type":"unknown"}\n');
        setTimeout(() => {
          client.end();
          resolve();
        }, 100);
      });
    });

    expect(received).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/ipc.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ipc.ts**

Create `src/backend/ipc.ts`:

```typescript
import { createServer, type Socket } from "node:net";
import { unlinkSync } from "node:fs";
import {
  isClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "./ipc-types.js";

export type SendFn = (msg: ServerMessage) => void;
export type MessageHandler = (msg: ClientMessage, send: SendFn) => Promise<void>;

export interface IPCServer {
  socketPath: string;
  close: () => Promise<void>;
}

export async function createIPCServer(
  socketPath: string,
  onMessage: MessageHandler,
): Promise<IPCServer> {
  // Clean up stale socket file
  try {
    unlinkSync(socketPath);
  } catch {
    // Doesn't exist, fine
  }

  const server = createServer((socket: Socket) => {
    let buffer = "";

    const send: SendFn = (msg) => {
      socket.write(JSON.stringify(msg) + "\n");
    };

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.length === 0) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // Skip malformed JSON
        }

        if (isClientMessage(parsed)) {
          onMessage(parsed, send).catch((err) => {
            send({ type: "error", message: String(err) });
          });
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(socketPath, () => {
      resolve({
        socketPath,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => {
              try {
                unlinkSync(socketPath);
              } catch {
                // Already gone
              }
              res();
            });
          }),
      });
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/ipc.test.ts
```

Expected: PASS — all 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/ipc.ts src/backend/__tests__/ipc.test.ts
git commit -m "feat: add Unix socket IPC server with JSON-line protocol"
```

---

### Task 5: System Prompt

**Files:**
- Create: `src/backend/system-prompt.ts`
- Test: `src/backend/__tests__/system-prompt.test.ts`

Constructs the system prompt string that gives the AI agent Snow Linux context, tool selection guidance, and safety rules.

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/system-prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt.js";

describe("buildSystemPrompt", () => {
  it("includes Snow Linux identity", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Frosty");
    expect(prompt).toContain("Snow Linux");
    expect(prompt).toContain("atomic");
  });

  it("includes tool selection guidance", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Flatpak");
    expect(prompt).toContain("Homebrew");
    expect(prompt).toContain("updex");
    expect(prompt).toContain("nbc");
  });

  it("includes safety rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("/usr");
    expect(prompt).toContain("read-only");
    expect(prompt).toContain("reboot");
  });

  it("includes available tool names", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("flatpak_list");
    expect(prompt).toContain("shell_exec");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/system-prompt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement system-prompt.ts**

Create `src/backend/system-prompt.ts`:

```typescript
export function buildSystemPrompt(): string {
  return `You are Frosty, a system administration assistant for Snow Linux.

## About Snow Linux

Snow Linux is an atomic, immutable Debian-based operating system using A/B root partitions.

- \`/usr\` is read-only and updated atomically
- \`/etc\` overlays onto \`/usr/etc\` — user changes are preserved separately
- \`/var\` and \`/home\` are persistent and writable
- System updates are managed by \`nbc\` (A/B partition updates)
- System extensions (sysexts) are managed by \`updex\`
- Desktop apps are installed via Flatpak
- CLI tools and dev dependencies are installed via Homebrew

## Tool Selection

When the user asks to install or manage software, choose the right tool:

- **Desktop applications** → use \`flatpak_install\`. Flatpak apps are sandboxed and don't touch the base OS.
- **CLI tools and dev dependencies** → use Homebrew (\`brew_install\`). Installs to \`/home/linuxbrew/\`.
- **System-level components** → use \`updex_features_enable\`. Extends \`/usr\` atomically via sysexts.
- **OS updates** → use \`nbc_update\`. Writes to the inactive A/B partition. Requires reboot to activate.

If no built-in tool covers the need, use \`shell_exec\` to propose an ad-hoc shell command.

## Available Tools

### Flatpak (MVP)
- \`flatpak_list\` — List installed flatpaks
- \`flatpak_search\` — Search Flathub for apps
- \`flatpak_info\` — Show details about an installed app
- \`flatpak_install\` — Install an app from Flathub
- \`flatpak_uninstall\` — Remove an installed app
- \`flatpak_update\` — Update installed apps

### Shell (MVP)
- \`shell_exec\` — Run an arbitrary shell command

### Coming Soon
- Homebrew tools (\`brew_list\`, \`brew_search\`, \`brew_install\`, etc.)
- nbc tools (\`nbc_status\`, \`nbc_update\`, etc.)
- updex tools (\`updex_features_list\`, \`updex_features_enable\`, etc.)

## Safety Rules

1. Never run commands outside the tool/confirmation flow.
2. Never attempt to modify \`/usr\` directly — it is read-only.
3. Always use \`--json\` flags when available for parsing tool output.
4. For \`nbc update\`: always warn the user that a reboot is required to activate the update.
5. For destructive operations: explain what will happen before requesting confirmation.
6. If you are unsure which tool to use, explain the options and ask the user.
7. When using \`shell_exec\`, classify the risk level honestly. Never downgrade risk to avoid confirmation.
8. Pipe-to-shell patterns (\`curl | bash\`, \`wget | sh\`) are always destructive-risk.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/system-prompt.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/system-prompt.ts src/backend/__tests__/system-prompt.test.ts
git commit -m "feat: add Snow Linux system prompt for the agent"
```

---

### Task 6: Flatpak Skill

**Files:**
- Create: `src/backend/skills/flatpak.ts`
- Create: `src/backend/skills/types.ts`
- Test: `src/backend/__tests__/skills/flatpak.test.ts`

Defines the Flatpak tools with Zod schemas and risk classifications. Each tool function builds and returns a shell command string plus its risk level — the agent core handles actual execution and confirmation flow.

- [ ] **Step 1: Write skill types**

Create `src/backend/skills/types.ts`:

```typescript
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
```

- [ ] **Step 2: Write the test**

Create `src/backend/__tests__/skills/flatpak.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { flatpakTools, buildFlatpakCommand } from "../../skills/flatpak.js";

describe("flatpakTools", () => {
  it("defines 6 tools", () => {
    expect(flatpakTools).toHaveLength(6);
  });

  it("classifies list as safe", () => {
    const list = flatpakTools.find((t) => t.name === "flatpak_list");
    expect(list?.risk).toBe("safe");
  });

  it("classifies install as mutating", () => {
    const install = flatpakTools.find((t) => t.name === "flatpak_install");
    expect(install?.risk).toBe("mutating");
  });
});

describe("buildFlatpakCommand", () => {
  it("builds a list command", () => {
    const result = buildFlatpakCommand("flatpak_list", {});
    expect(result.command).toBe("flatpak list --app --columns=application,name,version");
    expect(result.risk).toBe("safe");
  });

  it("builds a search command", () => {
    const result = buildFlatpakCommand("flatpak_search", { query: "firefox" });
    expect(result.command).toBe("flatpak search firefox");
    expect(result.risk).toBe("safe");
  });

  it("builds an install command", () => {
    const result = buildFlatpakCommand("flatpak_install", {
      appId: "org.mozilla.firefox",
    });
    expect(result.command).toBe("flatpak install -y flathub org.mozilla.firefox");
    expect(result.risk).toBe("mutating");
  });

  it("builds an uninstall command", () => {
    const result = buildFlatpakCommand("flatpak_uninstall", {
      appId: "org.mozilla.firefox",
    });
    expect(result.command).toBe("flatpak uninstall -y org.mozilla.firefox");
    expect(result.risk).toBe("mutating");
  });

  it("builds an update command with no args", () => {
    const result = buildFlatpakCommand("flatpak_update", {});
    expect(result.command).toBe("flatpak update -y");
    expect(result.risk).toBe("mutating");
  });

  it("builds an info command", () => {
    const result = buildFlatpakCommand("flatpak_info", {
      appId: "org.mozilla.firefox",
    });
    expect(result.command).toBe("flatpak info org.mozilla.firefox");
    expect(result.risk).toBe("safe");
  });

  it("throws on unknown tool name", () => {
    expect(() => buildFlatpakCommand("unknown", {})).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/skills/flatpak.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement flatpak.ts**

Create `src/backend/skills/flatpak.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/skills/flatpak.test.ts
```

Expected: PASS — all 9 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/backend/skills/types.ts src/backend/skills/flatpak.ts src/backend/__tests__/skills/flatpak.test.ts
git commit -m "feat: add Flatpak skill with tool definitions and command builder"
```

---

### Task 7: Shell Skill

**Files:**
- Create: `src/backend/skills/shell.ts`
- Test: `src/backend/__tests__/skills/shell.test.ts`

The shell skill wraps arbitrary commands with pipe-to-shell detection for risk escalation.

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/skills/shell.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildShellCommand, shellTools } from "../../skills/shell.js";

describe("shellTools", () => {
  it("defines 1 tool", () => {
    expect(shellTools).toHaveLength(1);
    expect(shellTools[0].name).toBe("shell_exec");
  });
});

describe("buildShellCommand", () => {
  it("returns mutating risk for normal commands", () => {
    const result = buildShellCommand({ command: "ls -la" });
    expect(result.command).toBe("ls -la");
    expect(result.risk).toBe("mutating");
  });

  it("escalates pipe-to-bash to destructive", () => {
    const result = buildShellCommand({ command: "curl https://example.com | bash" });
    expect(result.risk).toBe("destructive");
  });

  it("escalates pipe-to-sh to destructive", () => {
    const result = buildShellCommand({ command: "wget -O- https://example.com | sh" });
    expect(result.risk).toBe("destructive");
  });

  it("escalates pipe-to-sudo to destructive", () => {
    const result = buildShellCommand({ command: "echo password | sudo -S rm -rf /" });
    expect(result.risk).toBe("destructive");
  });

  it("does not escalate safe pipes", () => {
    const result = buildShellCommand({ command: "ls | grep foo" });
    expect(result.risk).toBe("mutating");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/skills/shell.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement shell.ts**

Create `src/backend/skills/shell.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/skills/shell.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/skills/shell.ts src/backend/__tests__/skills/shell.test.ts
git commit -m "feat: add shell skill with pipe-to-shell risk escalation"
```

---

### Task 8: Skill Registry

**Files:**
- Create: `src/backend/skills/index.ts`
- Test: `src/backend/__tests__/skills/index.test.ts`

Collects all skill tool definitions and command builders into a single registry. The agent core queries this to find tool metadata and build commands.

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/skills/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getAllTools, buildCommand } from "../../skills/index.js";

describe("getAllTools", () => {
  it("returns all tool definitions from all skills", () => {
    const tools = getAllTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("flatpak_list");
    expect(names).toContain("flatpak_install");
    expect(names).toContain("shell_exec");
    expect(tools.length).toBe(7); // 6 flatpak + 1 shell
  });
});

describe("buildCommand", () => {
  it("delegates to flatpak skill", () => {
    const result = buildCommand("flatpak_list", {});
    expect(result.command).toContain("flatpak list");
  });

  it("delegates to shell skill", () => {
    const result = buildCommand("shell_exec", { command: "whoami" });
    expect(result.command).toBe("whoami");
  });

  it("throws on unknown tool", () => {
    expect(() => buildCommand("unknown_tool", {})).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/skills/index.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement skills/index.ts**

Create `src/backend/skills/index.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/skills/index.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/skills/index.ts src/backend/__tests__/skills/index.test.ts
git commit -m "feat: add skill registry collecting all tools and command builders"
```

---

### Task 9: Settings Module

**Files:**
- Create: `src/backend/settings.ts`
- Test: `src/backend/__tests__/settings.test.ts`

Manages reading and writing the Frosty settings file (provider, API key, model).

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSettings, saveSettings } from "../settings.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("settings", () => {
  let originalEnv: string | undefined;
  let tempDir: string;

  beforeEach(() => {
    originalEnv = process.env.XDG_CONFIG_HOME;
    tempDir = mkdtempSync(join(tmpdir(), "frosty-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
  });

  afterEach(() => {
    process.env.XDG_CONFIG_HOME = originalEnv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when no settings file exists", () => {
    const settings = loadSettings();
    expect(settings.provider).toBe("anthropic");
    expect(settings.apiKey).toBe("");
  });

  it("round-trips save and load", () => {
    saveSettings({ provider: "openai", apiKey: "sk-test", model: "gpt-4o" });
    const loaded = loadSettings();
    expect(loaded.provider).toBe("openai");
    expect(loaded.apiKey).toBe("sk-test");
    expect(loaded.model).toBe("gpt-4o");
  });

  it("merges with defaults on partial file", () => {
    saveSettings({ provider: "openrouter", apiKey: "", model: undefined });
    const loaded = loadSettings();
    expect(loaded.provider).toBe("openrouter");
    expect(loaded.apiKey).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/settings.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement settings.ts**

Create `src/backend/settings.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export interface FrostySettings {
  provider: string;
  apiKey: string;
  model?: string;
}

const DEFAULT_SETTINGS: FrostySettings = {
  provider: "anthropic",
  apiKey: "",
};

function settingsPath(): string {
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "frosty",
    "settings.json",
  );
}

export function loadSettings(): FrostySettings {
  try {
    const raw = readFileSync(settingsPath(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: FrostySettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/settings.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/settings.ts src/backend/__tests__/settings.test.ts
git commit -m "feat: add settings module for provider configuration"
```

---

### Task 10: Confirmation Manager

**Files:**
- Create: `src/backend/confirmations.ts`
- Test: `src/backend/__tests__/confirmations.test.ts`

Manages pending tool confirmations as a separate module. The agent core and IPC handler both interact with this.

- [ ] **Step 1: Write the test**

Create `src/backend/__tests__/confirmations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ConfirmationManager } from "../confirmations.js";

describe("ConfirmationManager", () => {
  it("resolves a pending confirmation with true", async () => {
    const mgr = new ConfirmationManager();
    const promise = mgr.waitForConfirmation("t1");
    mgr.resolve("t1", true);
    expect(await promise).toBe(true);
  });

  it("resolves a pending confirmation with false", async () => {
    const mgr = new ConfirmationManager();
    const promise = mgr.waitForConfirmation("t1");
    mgr.resolve("t1", false);
    expect(await promise).toBe(false);
  });

  it("ignores resolve for unknown toolCallId", () => {
    const mgr = new ConfirmationManager();
    // Should not throw
    mgr.resolve("unknown", true);
  });

  it("cleans up after resolution", async () => {
    const mgr = new ConfirmationManager();
    const promise = mgr.waitForConfirmation("t1");
    mgr.resolve("t1", true);
    await promise;
    // Resolving again should be a no-op
    mgr.resolve("t1", false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/backend/__tests__/confirmations.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement confirmations.ts**

Create `src/backend/confirmations.ts`:

```typescript
export class ConfirmationManager {
  private pending = new Map<string, (approved: boolean) => void>();

  waitForConfirmation(toolCallId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pending.set(toolCallId, resolve);
    });
  }

  resolve(toolCallId: string, approved: boolean): void {
    const resolver = this.pending.get(toolCallId);
    if (resolver) {
      resolver(approved);
      this.pending.delete(toolCallId);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/backend/__tests__/confirmations.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/backend/confirmations.ts src/backend/__tests__/confirmations.test.ts
git commit -m "feat: add confirmation manager for pending tool approvals"
```

---

### Task 11: Agent Core

**Files:**
- Create: `src/backend/agent.ts`

The agent core wires one-agent-sdk with the skill registry. It registers each tool using the SDK's `tool()` function with Zod schemas, creates an MCP server, and provides a `handleMessage()` function that the IPC server calls when a user message arrives. Uses `ConfirmationManager` for confirmation state.

**Important:** The one-agent-sdk tool handlers return a sentinel value because the SDK manages tool execution internally via MCP. The actual command execution happens in the agent's message loop when it detects `tool_use` blocks. During implementation, verify the exact message format the SDK emits and adjust the streaming loop accordingly — the SDK's behavior may differ from what's shown here. Add a step to test against the real SDK and fix the integration.

- [ ] **Step 1: Create agent.ts**

Create `src/backend/agent.ts`:

```typescript
import { query, tool, createSdkMcpServer } from "one-agent-sdk";
import { z } from "zod";
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

// Build one-agent-sdk tools from skill definitions.
// Tool handlers return a placeholder — actual execution is handled
// in the message loop after confirmation.
function createAgentTools() {
  return [
    tool("flatpak_list", "List installed Flatpak applications", {},
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
    tool("flatpak_search", "Search Flathub for applications",
      { query: z.string().describe("Search query") },
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
    tool("flatpak_info", "Show details about an installed Flatpak application",
      { appId: z.string().describe("Flatpak application ID (e.g. org.mozilla.firefox)") },
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
    tool("flatpak_install", "Install a Flatpak application from Flathub",
      { appId: z.string().describe("Flatpak application ID to install") },
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
    tool("flatpak_uninstall", "Remove an installed Flatpak application",
      { appId: z.string().describe("Flatpak application ID to remove") },
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
    tool("flatpak_update", "Update all installed Flatpak applications", {},
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
    tool("shell_exec", "Run an arbitrary shell command on the host system",
      { command: z.string().describe("The shell command to execute") },
      async () => ({ content: [{ type: "text" as const, text: "" }] })),
  ];
}

export async function handleUserMessage(
  text: string,
  send: SendFn,
): Promise<void> {
  const settings = loadSettings();

  const agentTools = createAgentTools();
  const mcpServer = createSdkMcpServer({
    name: "frosty-tools",
    version: "1.0.0",
    tools: agentTools,
  });

  const toolNames = getAllTools().map((t) => `mcp__frosty-tools__${t.name}`);

  const conversation = query({
    prompt: text,
    options: {
      systemPrompt: buildSystemPrompt(),
      provider: settings.provider as any,
      model: settings.model,
      mcpServers: { "frosty-tools": mcpServer },
      allowedTools: toolNames,
    },
  });

  for await (const msg of conversation) {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if ("text" in block && block.text) {
          send({ type: "text", delta: block.text });
        }

        if ("type" in block && block.type === "tool_use") {
          const toolBlock = block as {
            id: string;
            name: string;
            input: Record<string, unknown>;
          };

          const rawName = toolBlock.name.replace("mcp__frosty-tools__", "");

          try {
            const { command, risk } = buildCommand(rawName, toolBlock.input);
            const toolCallId = toolBlock.id;

            send({
              type: "tool.request",
              toolCallId,
              name: rawName,
              args: toolBlock.input,
              risk,
            });

            let approved = true;
            if (risk !== "safe") {
              approved = await confirmations.waitForConfirmation(toolCallId);
            }

            if (!approved) {
              send({ type: "tool.done", toolCallId, exitCode: -1 });
              continue;
            }

            send({ type: "tool.running", toolCallId });

            const result = await executeCommand(command, (chunk) => {
              send({ type: "tool.output", toolCallId, delta: chunk });
            });

            send({ type: "tool.done", toolCallId, exitCode: result.exitCode });
          } catch (err) {
            send({ type: "error", message: `Tool error: ${String(err)}` });
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Verify the SDK integration works**

Start the backend with a valid API key configured and send a test message via a simple client script to verify the streaming loop produces expected output. If the SDK's message format differs from what's implemented, fix the loop.

```bash
# Quick integration check — configure settings first
mkdir -p ~/.config/frosty
echo '{"provider":"anthropic","apiKey":"your-key-here"}' > ~/.config/frosty/settings.json
npm run backend &
sleep 2
echo '{"type":"message","text":"list my flatpaks","sessionId":"test"}' | socat - UNIX-CONNECT:$XDG_RUNTIME_DIR/frosty.sock
kill %1
```

Examine the output. Fix any issues with how the SDK surfaces messages or tool calls.

- [ ] **Step 3: Run all backend tests to verify nothing is broken**

```bash
npx vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/backend/agent.ts
git commit -m "feat: add agent core wiring one-agent-sdk with skill registry"
```

---

### Task 12: Backend Entry Point

**Files:**
- Create: `src/backend/main.ts`

Wires everything together: loads settings, starts the IPC server, and routes incoming messages to the agent.

- [ ] **Step 1: Implement main.ts**

Create `src/backend/main.ts`:

```typescript
import { join } from "node:path";
import { createIPCServer } from "./ipc.js";
import {
  handleUserMessage,
  resolveConfirmation,
} from "./agent.js";
import type { ClientMessage } from "./ipc-types.js";
import type { SendFn } from "./ipc.js";

const socketPath =
  join(process.env.XDG_RUNTIME_DIR || "/tmp", "frosty.sock");

async function handleMessage(
  msg: ClientMessage,
  send: SendFn,
): Promise<void> {
  switch (msg.type) {
    case "message":
      await handleUserMessage(msg.text, send);
      break;

    case "confirm":
      resolveConfirmation(msg.toolCallId, msg.approved);
      break;

    case "cancel":
      resolveConfirmation(msg.toolCallId, false);
      break;

    case "session.new":
      // MVP: no-op, each message is independent
      break;

    case "session.load":
      // MVP: no-op, deferred to iteration 3
      break;
  }
}

async function main(): Promise<void> {
  const server = await createIPCServer(socketPath, handleMessage);
  console.log(`Frosty backend listening on ${server.socketPath}`);

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Frosty backend failed to start:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test — start and stop the backend**

```bash
timeout 3 npm run backend || true
```

Expected: Prints `Frosty backend listening on /run/user/.../frosty.sock` then exits on timeout. No crash.

- [ ] **Step 3: Commit**

```bash
git add src/backend/main.ts
git commit -m "feat: add backend entry point wiring IPC server to agent"
```

---

## Chunk 2: GTK4/LibAdwaita Frontend

### Task 13: Frontend Project Structure

**Files:**
- Create: `src/frontend/main.js`

The Gjs entry point: creates an `Adw.Application`, connects the `activate` signal to create the main window, and runs the app.

- [ ] **Step 1: Create main.js**

Create `src/frontend/main.js`:

```javascript
#!/usr/bin/env gjs -m

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

// Promisify async methods we'll use
Gio._promisify(Gio.DataInputStream.prototype, "read_line_async", "read_line_finish_utf8");
Gio._promisify(Gio.OutputStream.prototype, "write_bytes_async");
Gio._promisify(Gio.SocketClient.prototype, "connect_async");

import { FrostyWindow } from "./window.js";

const application = new Adw.Application({
  application_id: "com.frostyard.Frosty",
  flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
});

let frostyWindow = null;
application.connect("activate", (app) => {
  if (!frostyWindow) {
    frostyWindow = new FrostyWindow(app);
  }
  frostyWindow.present();
});

application.run([imports.system.programInvocationName].concat(ARGV));
```

- [ ] **Step 2: Verify Gjs and GTK4/Adw are available**

```bash
gjs -c "imports.gi.versions.Gtk = '4.0'; imports.gi.versions.Adw = '1'; const Gtk = imports.gi.Gtk; const Adw = imports.gi.Adw; print('GTK4 + Adw available');"
```

Expected: Prints `GTK4 + Adw available`.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/main.js
git commit -m "feat: add Gjs application entry point with GTK4 and LibAdwaita"
```

---

### Task 14: IPC Client

**Files:**
- Create: `src/frontend/ipc-client.js`

Connects to the backend's Unix socket, sends JSON-line messages, and emits parsed `ServerMessage` objects via callbacks. Uses `Gio.SocketClient` and `Gio.DataInputStream` for async line reading.

- [ ] **Step 1: Implement ipc-client.js**

Create `src/frontend/ipc-client.js`:

```javascript
import GLib from "gi://GLib";
import Gio from "gi://Gio";

/**
 * IPC client that connects to the Frosty backend over a Unix socket.
 *
 * @param {object} callbacks - Message handlers
 * @param {function} callbacks.onText - Called with {delta: string}
 * @param {function} callbacks.onToolRequest - Called with {toolCallId, name, args, risk}
 * @param {function} callbacks.onToolRunning - Called with {toolCallId}
 * @param {function} callbacks.onToolOutput - Called with {toolCallId, delta}
 * @param {function} callbacks.onToolDone - Called with {toolCallId, exitCode}
 * @param {function} callbacks.onError - Called with {message: string}
 * @param {function} callbacks.onDisconnect - Called when connection drops
 */
export class IPCClient {
  constructor(callbacks) {
    this._callbacks = callbacks;
    this._connection = null;
    this._outputStream = null;
    this._reading = false;
  }

  /**
   * Connect to the backend socket with retry logic.
   * @param {string} socketPath - Path to the Unix domain socket
   * @param {number} maxRetries - Maximum connection attempts
   * @param {number} intervalMs - Milliseconds between retries
   * @returns {Promise<boolean>} true if connected
   */
  async connect(socketPath, maxRetries = 50, intervalMs = 100) {
    const client = new Gio.SocketClient();
    const address = Gio.UnixSocketAddress.new(socketPath);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this._connection = await client.connect_async(address, null);
        this._outputStream = this._connection.get_output_stream();
        this._startReading();
        return true;
      } catch {
        await new Promise((resolve) =>
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
          }),
        );
      }
    }

    return false;
  }

  /**
   * Send a message to the backend.
   * @param {object} msg - A ClientMessage object
   */
  send(msg) {
    if (!this._outputStream) return;
    const line = JSON.stringify(msg) + "\n";
    const bytes = new GLib.Bytes(new TextEncoder().encode(line));
    this._outputStream.write_bytes_async(bytes, GLib.PRIORITY_DEFAULT, null).catch((err) => {
      log(`IPC send error: ${err.message}`);
    });
  }

  _startReading() {
    if (this._reading || !this._connection) return;
    this._reading = true;

    const inputStream = new Gio.DataInputStream({
      base_stream: this._connection.get_input_stream(),
      close_base_stream: true,
    });

    this._readLoop(inputStream);
  }

  async _readLoop(stream) {
    while (this._reading) {
      try {
        const [line] = await stream.read_line_async(GLib.PRIORITY_DEFAULT, null);
        if (line === null) {
          this._reading = false;
          this._callbacks.onDisconnect?.();
          return;
        }

        const text = new TextDecoder().decode(line);
        if (text.length === 0) continue;

        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          continue;
        }

        this._dispatch(msg);
      } catch (err) {
        log(`IPC read error: ${err.message}`);
        this._reading = false;
        this._callbacks.onDisconnect?.();
        return;
      }
    }
  }

  _dispatch(msg) {
    switch (msg.type) {
      case "text":
        this._callbacks.onText?.(msg);
        break;
      case "tool.request":
        this._callbacks.onToolRequest?.(msg);
        break;
      case "tool.running":
        this._callbacks.onToolRunning?.(msg);
        break;
      case "tool.output":
        this._callbacks.onToolOutput?.(msg);
        break;
      case "tool.done":
        this._callbacks.onToolDone?.(msg);
        break;
      case "error":
        this._callbacks.onError?.(msg);
        break;
    }
  }

  disconnect() {
    this._reading = false;
    if (this._connection) {
      this._connection.close(null);
      this._connection = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/ipc-client.js
git commit -m "feat: add IPC client for Gjs using Gio.SocketClient"
```

---

### Task 15: Message Row Widget

**Files:**
- Create: `src/frontend/widgets/message-row.js`

A single chat message bubble. Displays differently for user vs. agent messages.

- [ ] **Step 1: Implement message-row.js**

Create `src/frontend/widgets/message-row.js`:

```javascript
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

/**
 * Creates a message row widget for the chat view.
 *
 * @param {"user"|"agent"} role - Who sent the message
 * @param {string} text - The message content
 * @returns {Gtk.Box} The message row widget
 */
export function createMessageRow(role, text) {
  const row = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_start: 12,
    margin_end: 12,
    margin_top: 4,
    margin_bottom: 4,
  });

  const label = new Gtk.Label({
    label: text,
    wrap: true,
    wrap_mode: 2, // WORD_CHAR
    xalign: 0,
    selectable: true,
    css_classes: [role === "user" ? "user-message" : "agent-message"],
    margin_start: 8,
    margin_end: 8,
    margin_top: 8,
    margin_bottom: 8,
  });

  const bubble = new Gtk.Box({
    css_classes: ["card", role === "user" ? "user-bubble" : "agent-bubble"],
  });
  bubble.append(label);

  if (role === "user") {
    // Right-align user messages
    const spacer = new Gtk.Box({ hexpand: true });
    row.append(spacer);
    row.append(bubble);
  } else {
    // Left-align agent messages
    row.append(bubble);
    const spacer = new Gtk.Box({ hexpand: true });
    row.append(spacer);
  }

  return row;
}

/**
 * Creates an agent message row that can be appended to (for streaming).
 * Returns both the row widget and a function to append text.
 *
 * @returns {{ row: Gtk.Box, append: (text: string) => void, getText: () => string }}
 */
export function createStreamingMessageRow() {
  const row = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_start: 12,
    margin_end: 12,
    margin_top: 4,
    margin_bottom: 4,
  });

  let content = "";

  const label = new Gtk.Label({
    label: "",
    wrap: true,
    wrap_mode: 2,
    xalign: 0,
    selectable: true,
    css_classes: ["agent-message"],
    margin_start: 8,
    margin_end: 8,
    margin_top: 8,
    margin_bottom: 8,
  });

  const bubble = new Gtk.Box({
    css_classes: ["card", "agent-bubble"],
  });
  bubble.append(label);
  row.append(bubble);

  const spacer = new Gtk.Box({ hexpand: true });
  row.append(spacer);

  return {
    row,
    append(text) {
      content += text;
      label.set_label(content);
    },
    getText() {
      return content;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/widgets/message-row.js
git commit -m "feat: add chat message row widget with streaming support"
```

---

### Task 16: Confirm Bar Widget

**Files:**
- Create: `src/frontend/widgets/confirm-bar.js`

Inline confirmation widget shown in chat for mutating commands. Shows the command and Run/Cancel buttons.

- [ ] **Step 1: Implement confirm-bar.js**

Create `src/frontend/widgets/confirm-bar.js`:

```javascript
import Gtk from "gi://Gtk?version=4.0";

/**
 * Creates an inline confirmation bar for a tool request.
 *
 * @param {string} toolName - The tool being called
 * @param {object} args - Tool arguments
 * @param {function} onApprove - Called when user clicks Run
 * @param {function} onCancel - Called when user clicks Cancel
 * @returns {Gtk.Box} The confirmation bar widget
 */
export function createConfirmBar(toolName, args, onApprove, onCancel) {
  const bar = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    margin_start: 12,
    margin_end: 12,
    margin_top: 4,
    margin_bottom: 4,
    css_classes: ["card"],
  });

  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_start: 8,
    margin_end: 8,
    margin_top: 8,
    spacing: 8,
  });

  const icon = new Gtk.Label({
    label: "⚡",
  });
  headerBox.append(icon);

  const title = new Gtk.Label({
    label: `Run ${toolName}?`,
    css_classes: ["heading"],
    xalign: 0,
    hexpand: true,
  });
  headerBox.append(title);
  bar.append(headerBox);

  // Show command/args
  const argsText = Object.entries(args)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  if (argsText) {
    const argsLabel = new Gtk.Label({
      label: argsText,
      wrap: true,
      wrap_mode: 2,
      xalign: 0,
      css_classes: ["dim-label", "monospace"],
      margin_start: 8,
      margin_end: 8,
      margin_top: 4,
    });
    bar.append(argsLabel);
  }

  // Buttons
  const buttonBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
    margin_start: 8,
    margin_end: 8,
    margin_top: 8,
    margin_bottom: 8,
    halign: Gtk.Align.END,
  });

  const cancelBtn = new Gtk.Button({
    label: "Cancel",
  });
  cancelBtn.connect("clicked", () => {
    onCancel();
    bar.set_sensitive(false);
  });
  buttonBox.append(cancelBtn);

  const runBtn = new Gtk.Button({
    label: "Run",
    css_classes: ["suggested-action"],
  });
  runBtn.connect("clicked", () => {
    onApprove();
    bar.set_sensitive(false);
  });
  buttonBox.append(runBtn);

  bar.append(buttonBox);

  return bar;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/widgets/confirm-bar.js
git commit -m "feat: add inline confirmation bar widget for mutating commands"
```

---

### Task 17: Activity Panel Widget

**Files:**
- Create: `src/frontend/widgets/activity-panel.js`

Right-side panel showing running and completed commands with their status.

- [ ] **Step 1: Implement activity-panel.js**

Create `src/frontend/widgets/activity-panel.js`:

```javascript
import Gtk from "gi://Gtk?version=4.0";

/**
 * Activity panel showing running and completed tool executions.
 */
export class ActivityPanel {
  constructor() {
    this._entries = new Map(); // toolCallId -> { row, statusLabel }

    this.widget = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      width_request: 220,
      css_classes: ["activity-panel"],
    });

    const header = new Gtk.Label({
      label: "Activity",
      css_classes: ["heading"],
      xalign: 0,
      margin_start: 12,
      margin_top: 12,
      margin_bottom: 8,
    });
    this.widget.append(header);

    const separator = new Gtk.Separator({
      orientation: Gtk.Orientation.HORIZONTAL,
    });
    this.widget.append(separator);

    this._list = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      vexpand: true,
    });

    const scrolled = new Gtk.ScrolledWindow({
      vexpand: true,
      hscrollbar_policy: Gtk.PolicyType.NEVER,
    });
    scrolled.set_child(this._list);
    this.widget.append(scrolled);
  }

  /**
   * Add a tool request to the activity panel.
   * @param {string} toolCallId
   * @param {string} toolName
   */
  addRequest(toolCallId, toolName) {
    const row = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_start: 12,
      margin_end: 12,
      margin_top: 6,
      margin_bottom: 6,
      css_classes: ["card"],
    });

    const statusLabel = new Gtk.Label({
      label: "PENDING",
      css_classes: ["caption", "warning"],
      xalign: 0,
      margin_start: 8,
      margin_top: 4,
    });
    row.append(statusLabel);

    const nameLabel = new Gtk.Label({
      label: toolName,
      css_classes: ["monospace", "caption"],
      xalign: 0,
      margin_start: 8,
      margin_end: 8,
      margin_bottom: 4,
      ellipsize: 3, // END
    });
    row.append(nameLabel);

    this._list.prepend(row);
    this._entries.set(toolCallId, { row, statusLabel });
  }

  /**
   * Mark a tool as running.
   * @param {string} toolCallId
   */
  setRunning(toolCallId) {
    const entry = this._entries.get(toolCallId);
    if (entry) {
      entry.statusLabel.set_label("RUNNING");
      entry.statusLabel.set_css_classes(["caption", "accent"]);
    }
  }

  /**
   * Mark a tool as done.
   * @param {string} toolCallId
   * @param {number} exitCode
   */
  setDone(toolCallId, exitCode) {
    const entry = this._entries.get(toolCallId);
    if (entry) {
      if (exitCode === 0) {
        entry.statusLabel.set_label("✓ DONE");
        entry.statusLabel.set_css_classes(["caption", "success"]);
      } else {
        entry.statusLabel.set_label(`✗ FAILED (${exitCode})`);
        entry.statusLabel.set_css_classes(["caption", "error"]);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/widgets/activity-panel.js
git commit -m "feat: add activity panel widget for tracking command execution"
```

---

### Task 18: Chat View Widget

**Files:**
- Create: `src/frontend/widgets/chat-view.js`

The main chat panel: a scrollable message list with a text input bar at the bottom.

- [ ] **Step 1: Implement chat-view.js**

Create `src/frontend/widgets/chat-view.js`:

```javascript
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import { createMessageRow, createStreamingMessageRow } from "./message-row.js";
import { createConfirmBar } from "./confirm-bar.js";

/**
 * Chat view with message list and input bar.
 */
export class ChatView {
  /**
   * @param {function} onSendMessage - Called with (text: string) when user sends a message
   */
  constructor(onSendMessage) {
    this._onSendMessage = onSendMessage;
    this._streamingRow = null;

    this.widget = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      hexpand: true,
    });

    // Message list in a scrolled window
    this._messageList = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      vexpand: true,
    });

    this._scrolledWindow = new Gtk.ScrolledWindow({
      vexpand: true,
      hscrollbar_policy: Gtk.PolicyType.NEVER,
    });
    this._scrolledWindow.set_child(this._messageList);
    this.widget.append(this._scrolledWindow);

    // Input bar
    const inputBar = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      margin_start: 12,
      margin_end: 12,
      margin_top: 8,
      margin_bottom: 12,
      spacing: 8,
    });

    this._entry = new Gtk.Entry({
      hexpand: true,
      placeholder_text: "Type a message...",
    });
    this._entry.connect("activate", () => this._sendCurrentMessage());
    inputBar.append(this._entry);

    const sendBtn = new Gtk.Button({
      icon_name: "go-next-symbolic",
      css_classes: ["suggested-action", "circular"],
    });
    sendBtn.connect("clicked", () => this._sendCurrentMessage());
    inputBar.append(sendBtn);

    this.widget.append(inputBar);
  }

  _sendCurrentMessage() {
    const text = this._entry.get_text().trim();
    if (text.length === 0) return;

    this.addUserMessage(text);
    this._entry.set_text("");
    this._onSendMessage(text);
  }

  _scrollToBottom() {
    // Use idle_add so the adjustment upper is updated after layout
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      const adj = this._scrolledWindow.get_vadjustment();
      adj.set_value(adj.get_upper());
      return GLib.SOURCE_REMOVE;
    });
  }

  /**
   * Add a complete user message to the chat.
   * @param {string} text
   */
  addUserMessage(text) {
    this._finalizeStreaming();
    const row = createMessageRow("user", text);
    this._messageList.append(row);
    this._scrollToBottom();
  }

  /**
   * Start a new streaming agent message or append to the current one.
   * @param {string} delta
   */
  appendAgentText(delta) {
    if (!this._streamingRow) {
      this._streamingRow = createStreamingMessageRow();
      this._messageList.append(this._streamingRow.row);
    }
    this._streamingRow.append(delta);
    this._scrollToBottom();
  }

  /**
   * Finalize the current streaming message (if any).
   */
  _finalizeStreaming() {
    this._streamingRow = null;
  }

  /**
   * Show an inline confirmation bar.
   * @param {string} toolCallId
   * @param {string} toolName
   * @param {object} args
   * @param {function} onApprove
   * @param {function} onCancel
   */
  showConfirmation(toolCallId, toolName, args, onApprove, onCancel) {
    this._finalizeStreaming();
    const bar = createConfirmBar(toolName, args, onApprove, onCancel);
    this._messageList.append(bar);
    this._scrollToBottom();
  }

  /**
   * Show an error message in the chat.
   * @param {string} message
   */
  showError(message) {
    this._finalizeStreaming();
    const row = createMessageRow("agent", `Error: ${message}`);
    this._messageList.append(row);
    this._scrollToBottom();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/widgets/chat-view.js
git commit -m "feat: add chat view widget with message list and input bar"
```

---

### Task 19: Main Window

**Files:**
- Create: `src/frontend/window.js`

The main application window. Composes the chat view and activity panel side by side. Manages the backend subprocess lifecycle and IPC connection.

- [ ] **Step 1: Implement window.js**

Create `src/frontend/window.js`:

```javascript
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

import { IPCClient } from "./ipc-client.js";
import { ChatView } from "./widgets/chat-view.js";
import { ActivityPanel } from "./widgets/activity-panel.js";
import { showPreferences } from "./preferences.js";

const SOCKET_PATH = GLib.build_filenamev([
  GLib.getenv("XDG_RUNTIME_DIR") || "/tmp",
  "frosty.sock",
]);

// Store the window reference on the app to avoid duplicate creation
let _windowInstance = null;

export class FrostyWindow {
  constructor(app) {
    if (_windowInstance) return _windowInstance;
    _windowInstance = this;

    this._app = app;
    this._backendPid = null;
    this._sessionId = GLib.uuid_string_random();

    // Build the window
    this._window = new Adw.ApplicationWindow({
      application: app,
      default_width: 900,
      default_height: 600,
      title: "Frosty",
    });

    // Header bar with preferences button
    const headerBar = new Adw.HeaderBar();
    const prefsBtn = new Gtk.Button({
      icon_name: "preferences-system-symbolic",
      tooltip_text: "Preferences",
    });
    prefsBtn.connect("clicked", () => showPreferences(this._window));
    headerBar.pack_end(prefsBtn);

    // Content: chat + activity panel
    const contentBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
    });

    // Chat view
    this._chatView = new ChatView((text) => this._onSendMessage(text));
    contentBox.append(this._chatView.widget);

    // Separator
    const separator = new Gtk.Separator({
      orientation: Gtk.Orientation.VERTICAL,
    });
    contentBox.append(separator);

    // Activity panel
    this._activityPanel = new ActivityPanel();
    contentBox.append(this._activityPanel.widget);

    // Assemble with toolbar view
    const toolbarView = new Adw.ToolbarView();
    toolbarView.add_top_bar(headerBar);
    toolbarView.set_content(contentBox);
    this._window.set_content(toolbarView);

    // IPC client
    this._ipc = new IPCClient({
      onText: (msg) => this._chatView.appendAgentText(msg.delta),
      onToolRequest: (msg) => this._handleToolRequest(msg),
      onToolRunning: (msg) => this._activityPanel.setRunning(msg.toolCallId),
      onToolOutput: (_msg) => {
        // MVP: tool output not displayed (deferred to Iteration 3)
      },
      onToolDone: (msg) =>
        this._activityPanel.setDone(msg.toolCallId, msg.exitCode),
      onError: (msg) => this._chatView.showError(msg.message),
      onDisconnect: () =>
        this._chatView.showError(
          "Backend disconnected. Restart Frosty to reconnect.",
        ),
    });

    // Start backend and connect
    this._startBackend();

    // Cleanup on close
    this._window.connect("close-request", () => {
      this._stopBackend();
      _windowInstance = null;
      return false;
    });
  }

  _startBackend() {
    try {
      const backendCmd = ["node", "--import", "tsx", "src/backend/main.ts"];
      const [, pid] = GLib.spawn_async(
        null,
        backendCmd,
        null,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null,
      );
      this._backendPid = pid;

      // Watch for backend crashes
      GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (_pid, status) => {
        this._backendPid = null;
        if (status !== 0) {
          this._chatView.showError(
            `Backend exited unexpectedly (status ${status}). Restart Frosty to reconnect.`,
          );
        }
      });

      // Connect immediately — IPCClient has built-in retry with 100ms intervals
      this._ipc.connect(SOCKET_PATH).then((connected) => {
        if (!connected) {
          this._chatView.showError(
            "Could not connect to backend. Check that Node.js is installed.",
          );
        }
      });
    } catch (err) {
      this._chatView.showError(`Failed to start backend: ${err.message}`);
    }
  }

  _stopBackend() {
    this._ipc.disconnect();
    if (this._backendPid) {
      try {
        // Use POSIX signal directly via GLib
        imports.system.exit
          ? GLib.spawn_command_line_sync(`kill ${this._backendPid}`)
          : null;
      } catch {
        // Process may have already exited
      }
    }
  }

  _onSendMessage(text) {
    this._ipc.send({
      type: "message",
      text,
      sessionId: this._sessionId,
    });
  }

  _handleToolRequest(msg) {
    this._activityPanel.addRequest(msg.toolCallId, msg.name);

    if (msg.risk === "safe") {
      this._ipc.send({
        type: "confirm",
        toolCallId: msg.toolCallId,
        approved: true,
      });
    } else if (msg.risk === "destructive") {
      const dialog = new Adw.AlertDialog({
        heading: `Run ${msg.name}?`,
        body: `This is a destructive operation.\n\n${JSON.stringify(msg.args, null, 2)}`,
      });
      dialog.add_response("cancel", "Cancel");
      dialog.add_response("run", "Run");
      dialog.set_response_appearance("run", Adw.ResponseAppearance.DESTRUCTIVE);

      dialog.connect("response", (_dialog, response) => {
        this._ipc.send({
          type: response === "run" ? "confirm" : "cancel",
          toolCallId: msg.toolCallId,
          approved: response === "run",
        });
      });

      dialog.present(this._window);
    } else {
      this._chatView.showConfirmation(
        msg.toolCallId,
        msg.name,
        msg.args,
        () =>
          this._ipc.send({
            type: "confirm",
            toolCallId: msg.toolCallId,
            approved: true,
          }),
        () =>
          this._ipc.send({
            type: "cancel",
            toolCallId: msg.toolCallId,
          }),
      );
    }
  }

  present() {
    this._window.present();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/window.js
git commit -m "feat: add main window composing chat view, activity panel, and backend lifecycle"
```

---

### Task 20: Session Store

**Files:**
- Create: `src/frontend/session-store.js`

Persists conversation sessions to `~/.local/share/frosty/sessions/` as JSON files.

- [ ] **Step 1: Implement session-store.js**

Create `src/frontend/session-store.js`:

```javascript
import GLib from "gi://GLib";
import Gio from "gi://Gio";

const DATA_DIR = GLib.build_filenamev([
  GLib.get_user_data_dir(),
  "frosty",
  "sessions",
]);

/**
 * Ensures the sessions directory exists.
 */
function ensureDir() {
  GLib.mkdir_with_parents(DATA_DIR, 0o755);
}

/**
 * Save a session to disk.
 * @param {string} sessionId
 * @param {Array<{role: string, text: string, timestamp: number}>} messages
 */
export function saveSession(sessionId, messages) {
  ensureDir();
  const path = GLib.build_filenamev([DATA_DIR, `${sessionId}.json`]);
  const data = JSON.stringify({ sessionId, messages }, null, 2);
  GLib.file_set_contents(path, data);
}

/**
 * Load a session from disk.
 * @param {string} sessionId
 * @returns {Array<{role: string, text: string, timestamp: number}>|null}
 */
export function loadSession(sessionId) {
  const path = GLib.build_filenamev([DATA_DIR, `${sessionId}.json`]);
  try {
    const [ok, contents] = GLib.file_get_contents(path);
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(contents));
    return data.messages;
  } catch {
    return null;
  }
}

/**
 * List all saved session IDs.
 * @returns {string[]}
 */
export function listSessions() {
  ensureDir();
  const dir = Gio.File.new_for_path(DATA_DIR);
  const enumerator = dir.enumerate_children(
    "standard::name",
    Gio.FileQueryInfoFlags.NONE,
    null,
  );

  const sessions = [];
  let info;
  while ((info = enumerator.next_file(null))) {
    const name = info.get_name();
    if (name.endsWith(".json")) {
      sessions.push(name.replace(".json", ""));
    }
  }
  return sessions;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/session-store.js
git commit -m "feat: add session store for persisting conversation history"
```

---

### Task 21: CSS Styling

**Files:**
- Create: `src/frontend/style.css`

Minimal CSS for chat bubbles and layout. LibAdwaita handles most styling; this just adds chat-specific customization.

- [ ] **Step 1: Create style.css**

Create `src/frontend/style.css`:

```css
.user-bubble {
  background-color: @accent_bg_color;
  color: @accent_fg_color;
  border-radius: 12px;
  max-width: 70%;
}

.agent-bubble {
  background-color: @card_bg_color;
  border-radius: 12px;
  max-width: 80%;
}

.user-message,
.agent-message {
  padding: 4px;
}

.activity-panel {
  background-color: @sidebar_bg_color;
  min-width: 220px;
}

.monospace {
  font-family: monospace;
}
```

- [ ] **Step 2: Load CSS in main.js**

Update `src/frontend/main.js` to load the stylesheet. Add `import Gdk from "gi://Gdk?version=4.0";` to the imports at the top, then add this before the `activate` handler:

```javascript
application.connect("startup", (_app) => {
  const cssProvider = new Gtk.CssProvider();
  // Use import.meta.url for reliable path resolution in ESM Gjs
  const thisDir = GLib.path_get_dirname(
    GLib.filename_from_uri(import.meta.url)[0],
  );
  const cssPath = GLib.build_filenamev([thisDir, "style.css"]);
  cssProvider.load_from_path(cssPath);
  Gtk.StyleContext.add_provider_for_display(
    Gdk.Display.get_default(),
    cssProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/style.css src/frontend/main.js
git commit -m "feat: add CSS styling for chat bubbles and activity panel"
```

---

### Task 22: End-to-End Smoke Test

**Files:**
- No new files

Verify the full stack works: start the backend, launch the frontend, send a message, see a response.

- [ ] **Step 1: Start the backend in the background**

```bash
npm run backend &
sleep 2
```

- [ ] **Step 2: Launch the frontend**

```bash
gjs -m src/frontend/main.js
```

Expected: A GTK4 window opens with a chat panel on the left and activity panel on the right. The input bar is visible at the bottom.

- [ ] **Step 3: Manual test**

Type "list my flatpaks" in the input bar and press Enter. Verify:
1. The message appears as a user bubble (right-aligned)
2. The agent responds with streamed text (left-aligned)
3. If the agent calls `flatpak_list`, it auto-runs (safe risk) and output appears
4. The activity panel shows the tool execution status

- [ ] **Step 4: Fix any issues found during smoke test**

Address any integration issues between frontend and backend.

- [ ] **Step 5: Commit any fixes (if changes were made)**

```bash
git diff --quiet || (git add -u && git commit -m "fix: address integration issues from smoke test")
```

---

## Chunk 3: Settings & Polish

### Task 23: Preferences Dialog

**Files:**
- Create: `src/frontend/preferences.js`
- Modify: `src/frontend/window.js`

A simple preferences dialog for configuring the AI provider and API key.

- [ ] **Step 1: Implement preferences.js**

Create `src/frontend/preferences.js`:

```javascript
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

const SETTINGS_PATH = GLib.build_filenamev([
  GLib.get_user_config_dir(),
  "frosty",
  "settings.json",
]);

function ensureConfigDir() {
  const dir = GLib.path_get_dirname(SETTINGS_PATH);
  GLib.mkdir_with_parents(dir, 0o755);
}

function loadSettings() {
  try {
    const [ok, contents] = GLib.file_get_contents(SETTINGS_PATH);
    if (!ok) return { provider: "anthropic", apiKey: "", model: "" };
    return JSON.parse(new TextDecoder().decode(contents));
  } catch {
    return { provider: "anthropic", apiKey: "", model: "" };
  }
}

function saveSettings(settings) {
  ensureConfigDir();
  GLib.file_set_contents(
    SETTINGS_PATH,
    JSON.stringify(settings, null, 2),
  );
}

/**
 * Show the preferences dialog.
 * @param {Gtk.Window} parent
 */
export function showPreferences(parent) {
  const settings = loadSettings();

  const dialog = new Adw.PreferencesDialog();

  const page = new Adw.PreferencesPage({
    title: "Settings",
    icon_name: "preferences-system-symbolic",
  });
  dialog.add(page);

  const group = new Adw.PreferencesGroup({
    title: "AI Provider",
  });
  page.add(group);

  // Provider dropdown
  const providerRow = new Adw.ComboRow({
    title: "Provider",
  });
  const providers = ["anthropic", "openai", "openrouter", "claude-code", "codex"];
  const providerListModel = Gtk.StringList.new(providers);
  providerRow.set_model(providerListModel);
  const currentIdx = providers.indexOf(settings.provider);
  if (currentIdx >= 0) providerRow.set_selected(currentIdx);
  group.add(providerRow);

  // API Key (masked)
  const apiKeyRow = new Adw.PasswordEntryRow({
    title: "API Key",
    text: settings.apiKey || "",
  });
  group.add(apiKeyRow);

  // Model override
  const modelRow = new Adw.EntryRow({
    title: "Model (optional)",
    text: settings.model || "",
  });
  group.add(modelRow);

  // Save on close
  dialog.connect("closed", () => {
    const selected = providerRow.get_selected();
    saveSettings({
      provider: providers[selected] || "anthropic",
      apiKey: apiKeyRow.get_text(),
      model: modelRow.get_text() || undefined,
    });
  });

  dialog.present(parent);
}
```

- [ ] **Step 2: Verify preferences button is in window.js**

The preferences button and import were already added to `window.js` in Task 19. Verify the import `import { showPreferences } from "./preferences.js";` is present and the button is wired to `headerBar.pack_end(prefsBtn)`.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/preferences.js src/frontend/window.js
git commit -m "feat: add preferences dialog for provider and API key configuration"
```

---

### Task 24: Destructive Confirmation Dialog

**Files:**
- Modify: `src/frontend/window.js`

The destructive confirmation dialog is already implemented in Task 19 (window.js `_handleToolRequest`). This task verifies all three confirmation tiers work.

- [ ] **Step 1: Test safe tier (auto-approve)**

With the app running, type: "list my installed flatpaks"

Expected:
1. The agent calls `flatpak_list` (risk: safe)
2. No confirmation prompt appears — the command runs automatically
3. Activity panel shows RUNNING then DONE

- [ ] **Step 2: Manual test — destructive tier**

With the app running, type: "run this command: curl https://example.com | bash"

Expected:
1. The agent proposes `shell_exec` with the command
2. The shell skill classifies it as `destructive`
3. A modal `Adw.AlertDialog` appears with a red "Run" button
4. Clicking "Cancel" aborts the command

- [ ] **Step 3: Verify inline confirmation (mutating tier)**

Type: "install firefox as a flatpak"

Expected:
1. The agent calls `flatpak_install`
2. An inline confirmation bar appears in the chat with "Run" and "Cancel" buttons

- [ ] **Step 4: Commit any fixes (if changes were made)**

```bash
git diff --quiet || (git add -u && git commit -m "fix: address confirmation dialog issues from testing")
```

---

### Task 25: Final Integration Test & Cleanup

**Files:**
- No new files

Final verification that the complete MVP works end-to-end.

- [ ] **Step 1: Run all backend tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Full manual test sequence**

1. Launch `gjs -m src/frontend/main.js`
2. Open preferences, set provider and API key, close dialog
3. Type "what flatpaks do I have installed?" — verify `flatpak_list` auto-runs
4. Type "install GIMP" — verify inline confirmation for `flatpak_install`
5. Type "what's my disk usage?" — verify shell_exec fallback with mutating confirmation
6. Verify activity panel shows all commands with correct status
7. Close the window — verify clean shutdown (no orphan processes)

- [ ] **Step 3: Final commit (if changes were made)**

```bash
git diff --quiet || (git add -u && git commit -m "chore: final MVP integration cleanup")
```
