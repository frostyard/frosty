# Homebrew Skill + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Homebrew skill, streaming command output with ANSI colors in the activity panel, syntax-highlighted code blocks in chat messages, and a toggleable session sidebar.

**Architecture:** Three vertical slices executed in order. Slice 1 (Homebrew) is backend-only, following the existing Flatpak skill pattern. Slice 2 (streaming + highlighting) wires the existing `tool.output` IPC messages into the activity panel and replaces plain code blocks with GtkSourceView widgets. Slice 3 (session sidebar) wraps the main content area in `Adw.OverlaySplitView` and adds session management UI.

**Tech Stack:** TypeScript (backend), Gjs/GTK4/LibAdwaita (frontend), GtkSourceView 5 (syntax highlighting), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-13-homebrew-ui-polish-design.md`

---

## Chunk 1: Homebrew Skill

### Task 1: Homebrew tool definitions and command builder

**Files:**
- Create: `src/backend/skills/homebrew.ts`
- Test: `src/backend/__tests__/skills/homebrew.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/backend/__tests__/skills/homebrew.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { brewTools, buildBrewCommand } from "../../skills/homebrew.js";

describe("brewTools", () => {
  it("defines 9 tools", () => {
    expect(brewTools).toHaveLength(9);
  });

  it("classifies list as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_list");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies search as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_search");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies info as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_info");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies install as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_install");
    expect(tool?.risk).toBe("mutating");
  });

  it("classifies uninstall as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_uninstall");
    expect(tool?.risk).toBe("mutating");
  });

  it("classifies update as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_update");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies upgrade as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_upgrade");
    expect(tool?.risk).toBe("mutating");
  });

  it("classifies doctor as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_doctor");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies cleanup as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_cleanup");
    expect(tool?.risk).toBe("mutating");
  });
});

describe("buildBrewCommand", () => {
  it("builds a list command", () => {
    const result = buildBrewCommand("brew_list", {});
    expect(result.command).toBe("brew list");
    expect(result.risk).toBe("safe");
  });

  it("builds a search command", () => {
    const result = buildBrewCommand("brew_search", { query: "git" });
    expect(result.command).toBe("brew search 'git'");
    expect(result.risk).toBe("safe");
  });

  it("escapes single quotes in search query", () => {
    const result = buildBrewCommand("brew_search", { query: "it's" });
    expect(result.command).toBe("brew search 'it'\\''s'");
  });

  it("builds an info command", () => {
    const result = buildBrewCommand("brew_info", { name: "git" });
    expect(result.command).toBe("brew info 'git'");
    expect(result.risk).toBe("safe");
  });

  it("builds an install command", () => {
    const result = buildBrewCommand("brew_install", { name: "git" });
    expect(result.command).toBe("brew install 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds an uninstall command", () => {
    const result = buildBrewCommand("brew_uninstall", { name: "git" });
    expect(result.command).toBe("brew uninstall 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds an update command", () => {
    const result = buildBrewCommand("brew_update", {});
    expect(result.command).toBe("brew update");
    expect(result.risk).toBe("safe");
  });

  it("builds an upgrade command with no args", () => {
    const result = buildBrewCommand("brew_upgrade", {});
    expect(result.command).toBe("brew upgrade");
    expect(result.risk).toBe("mutating");
  });

  it("builds an upgrade command for a specific formula", () => {
    const result = buildBrewCommand("brew_upgrade", { formula: "git" });
    expect(result.command).toBe("brew upgrade 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds an upgrade command with --greedy", () => {
    const result = buildBrewCommand("brew_upgrade", { greedy: true });
    expect(result.command).toBe("brew upgrade --greedy");
    expect(result.risk).toBe("mutating");
  });

  it("builds an upgrade command with formula and --greedy", () => {
    const result = buildBrewCommand("brew_upgrade", { formula: "git", greedy: true });
    expect(result.command).toBe("brew upgrade --greedy 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds a doctor command", () => {
    const result = buildBrewCommand("brew_doctor", {});
    expect(result.command).toBe("brew doctor");
    expect(result.risk).toBe("safe");
  });

  it("builds a cleanup command", () => {
    const result = buildBrewCommand("brew_cleanup", {});
    expect(result.command).toBe("brew cleanup");
    expect(result.risk).toBe("mutating");
  });

  it("throws on unknown tool name", () => {
    expect(() => buildBrewCommand("unknown", {})).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/backend/__tests__/skills/homebrew.test.ts`
Expected: FAIL — cannot find module `../../skills/homebrew.js`

- [ ] **Step 3: Write the implementation**

Create `src/backend/skills/homebrew.ts`:

```typescript
import type { ToolDefinition, ToolResult } from "./types.js";

function shellEscape(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

export const brewTools: ToolDefinition[] = [
  {
    name: "brew_list",
    description: "List installed Homebrew formulae and casks",
    risk: "safe",
  },
  {
    name: "brew_search",
    description: "Search for Homebrew formulae or casks",
    risk: "safe",
  },
  {
    name: "brew_info",
    description: "Show details about a Homebrew formula or cask",
    risk: "safe",
  },
  {
    name: "brew_install",
    description: "Install a Homebrew formula or cask",
    risk: "mutating",
  },
  {
    name: "brew_uninstall",
    description: "Remove an installed Homebrew formula or cask",
    risk: "mutating",
  },
  {
    name: "brew_update",
    description: "Fetch the latest Homebrew package index",
    risk: "safe",
  },
  {
    name: "brew_upgrade",
    description:
      "Upgrade installed Homebrew packages. Optionally specify a formula or use --greedy for casks",
    risk: "mutating",
  },
  {
    name: "brew_doctor",
    description: "Run Homebrew diagnostic checks",
    risk: "safe",
  },
  {
    name: "brew_cleanup",
    description: "Remove old versions and clear the Homebrew cache",
    risk: "mutating",
  },
];

export function buildBrewCommand(
  toolName: string,
  args: Record<string, unknown>,
): ToolResult {
  const tool = brewTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown brew tool: ${toolName}`);
  }

  let command: string;

  switch (toolName) {
    case "brew_list":
      command = "brew list";
      break;
    case "brew_search":
      command = `brew search ${shellEscape(String(args.query))}`;
      break;
    case "brew_info":
      command = `brew info ${shellEscape(String(args.name))}`;
      break;
    case "brew_install":
      command = `brew install ${shellEscape(String(args.name))}`;
      break;
    case "brew_uninstall":
      command = `brew uninstall ${shellEscape(String(args.name))}`;
      break;
    case "brew_update":
      command = "brew update";
      break;
    case "brew_upgrade": {
      const parts = ["brew upgrade"];
      if (args.greedy) parts.push("--greedy");
      if (args.formula) parts.push(shellEscape(String(args.formula)));
      command = parts.join(" ");
      break;
    }
    case "brew_doctor":
      command = "brew doctor";
      break;
    case "brew_cleanup":
      command = "brew cleanup";
      break;
    default:
      throw new Error(`Unknown brew tool: ${toolName}`);
  }

  return { command, risk: tool.risk };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/backend/__tests__/skills/homebrew.test.ts`
Expected: All 23 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/skills/homebrew.ts src/backend/__tests__/skills/homebrew.test.ts
git commit -m "feat: add Homebrew skill with tool definitions and command builder"
```

### Task 2: Register Homebrew skill and add Zod schemas

**Files:**
- Modify: `src/backend/skills/index.ts`
- Modify: `src/backend/__tests__/skills/index.test.ts`
- Modify: `src/backend/agent.ts:80-123` (buildParamsSchema switch)

- [ ] **Step 1: Update the index.test.ts to expect Homebrew tools**

In `src/backend/__tests__/skills/index.test.ts`, update:

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
    expect(names).toContain("brew_list");
    expect(names).toContain("brew_install");
    expect(names).toContain("brew_upgrade");
    expect(tools.length).toBe(16); // 6 flatpak + 1 shell + 9 brew
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

  it("delegates to brew skill", () => {
    const result = buildCommand("brew_list", {});
    expect(result.command).toBe("brew list");
  });

  it("throws on unknown tool", () => {
    expect(() => buildCommand("unknown_tool", {})).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/backend/__tests__/skills/index.test.ts`
Expected: FAIL — `brew_list` not found in tools, count is 7 not 16

- [ ] **Step 3: Update `src/backend/skills/index.ts`**

Replace the entire file with:

```typescript
import type { ToolDefinition, ToolResult } from "./types.js";
import { flatpakTools, buildFlatpakCommand } from "./flatpak.js";
import { shellTools, buildShellCommand } from "./shell.js";
import { brewTools, buildBrewCommand } from "./homebrew.js";

const FLATPAK_NAMES = new Set(flatpakTools.map((t) => t.name));
const BREW_NAMES = new Set(brewTools.map((t) => t.name));

export function getAllTools(): ToolDefinition[] {
  return [...flatpakTools, ...shellTools, ...brewTools];
}

export function buildCommand(
  toolName: string,
  args: Record<string, unknown>,
): ToolResult {
  if (FLATPAK_NAMES.has(toolName)) {
    return buildFlatpakCommand(toolName, args);
  }
  if (BREW_NAMES.has(toolName)) {
    return buildBrewCommand(toolName, args);
  }
  if (toolName === "shell_exec") {
    return buildShellCommand(args);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
```

- [ ] **Step 4: Add Brew Zod schemas in `src/backend/agent.ts`**

Add these cases to the `buildParamsSchema` switch statement, before the `default` case:

```typescript
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
        formula: z
          .string()
          .optional()
          .describe("Specific formula to upgrade (omit for all)"),
        greedy: z
          .boolean()
          .optional()
          .describe("Use --greedy to upgrade casks with auto-updates"),
      });
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/backend/skills/index.ts src/backend/__tests__/skills/index.test.ts src/backend/agent.ts
git commit -m "feat: register Homebrew skill in tool registry and add Zod schemas"
```

---

## Chunk 2: ANSI Parser + Streaming Activity Panel Output

### Task 3: ANSI escape sequence parser

**Files:**
- Create: `src/frontend/widgets/ansi-parser.js`
- Test: `src/frontend/widgets/__tests__/ansi-parser.test.js`

Note: These tests run in Node.js via Vitest. The parser is pure logic with no GTK dependencies, so it's fully testable outside the GTK runtime.

- [ ] **Step 1: Write the failing tests**

Create `src/frontend/widgets/__tests__/ansi-parser.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { parseAnsi } from "../ansi-parser.js";

describe("parseAnsi", () => {
  it("returns plain text unchanged", () => {
    const segments = parseAnsi("hello world");
    expect(segments).toEqual([{ text: "hello world", attrs: {} }]);
  });

  it("strips reset sequence", () => {
    const segments = parseAnsi("hello\x1b[0m world");
    expect(segments).toEqual([
      { text: "hello", attrs: {} },
      { text: " world", attrs: {} },
    ]);
  });

  it("parses foreground color", () => {
    const segments = parseAnsi("\x1b[31mred text\x1b[0m");
    expect(segments).toEqual([
      { text: "red text", attrs: { fg: 1 } },
      // reset produces no text segment if nothing follows
    ]);
  });

  it("parses bright foreground color", () => {
    const segments = parseAnsi("\x1b[91mbright red\x1b[0m");
    expect(segments).toEqual([
      { text: "bright red", attrs: { fg: 9 } },
    ]);
  });

  it("parses background color", () => {
    const segments = parseAnsi("\x1b[42mgreen bg\x1b[0m");
    expect(segments).toEqual([
      { text: "green bg", attrs: { bg: 2 } },
    ]);
  });

  it("parses bold", () => {
    const segments = parseAnsi("\x1b[1mbold\x1b[0m");
    expect(segments).toEqual([
      { text: "bold", attrs: { bold: true } },
    ]);
  });

  it("parses italic", () => {
    const segments = parseAnsi("\x1b[3mitalic\x1b[0m");
    expect(segments).toEqual([
      { text: "italic", attrs: { italic: true } },
    ]);
  });

  it("parses underline", () => {
    const segments = parseAnsi("\x1b[4munderline\x1b[0m");
    expect(segments).toEqual([
      { text: "underline", attrs: { underline: true } },
    ]);
  });

  it("combines multiple attributes", () => {
    const segments = parseAnsi("\x1b[1;31mbold red\x1b[0m");
    expect(segments).toEqual([
      { text: "bold red", attrs: { bold: true, fg: 1 } },
    ]);
  });

  it("gracefully strips 256-color sequences", () => {
    const segments = parseAnsi("\x1b[38;5;196mcolored\x1b[0m");
    expect(segments).toEqual([
      { text: "colored", attrs: {} },
    ]);
  });

  it("gracefully strips truecolor sequences", () => {
    const segments = parseAnsi("\x1b[38;2;255;0;0mcolored\x1b[0m");
    expect(segments).toEqual([
      { text: "colored", attrs: {} },
    ]);
  });

  it("handles text with no trailing reset", () => {
    const segments = parseAnsi("\x1b[32mgreen");
    expect(segments).toEqual([
      { text: "green", attrs: { fg: 2 } },
    ]);
  });

  it("handles empty input", () => {
    const segments = parseAnsi("");
    expect(segments).toEqual([]);
  });

  it("handles consecutive escape sequences", () => {
    const segments = parseAnsi("\x1b[31mred\x1b[32mgreen\x1b[0m");
    expect(segments).toEqual([
      { text: "red", attrs: { fg: 1 } },
      { text: "green", attrs: { fg: 2 } },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/frontend/widgets/__tests__/ansi-parser.test.js`
Expected: FAIL — cannot find module `../ansi-parser.js`

- [ ] **Step 3: Write the implementation**

Create `src/frontend/widgets/ansi-parser.js`:

```javascript
/**
 * Parse a string containing ANSI SGR escape sequences into styled segments.
 *
 * Each segment has { text, attrs } where attrs may contain:
 *   fg: number (0-7 standard, 8-15 bright)
 *   bg: number (0-7 standard, 8-15 bright)
 *   bold: boolean
 *   dim: boolean
 *   italic: boolean
 *   underline: boolean
 *
 * 256-color and truecolor sequences are stripped (attrs remain unchanged).
 * Non-SGR sequences (cursor movement etc.) are stripped.
 *
 * @param {string} input
 * @returns {Array<{text: string, attrs: Record<string, unknown>}>}
 */
export function parseAnsi(input) {
  if (!input) return [];

  const segments = [];
  let attrs = {};

  // Match: ESC [ <params> <final byte>
  // SGR is ESC [ <numbers separated by ;> m
  const regex = /\x1b\[([0-9;]*)([A-Za-z])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(input)) !== null) {
    // Text before this escape sequence
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) segments.push({ text, attrs: { ...attrs } });
    }
    lastIndex = regex.lastIndex;

    const finalChar = match[2];
    if (finalChar !== "m") {
      // Not an SGR sequence — strip it
      continue;
    }

    const paramStr = match[1];
    const params = paramStr === "" ? [0] : paramStr.split(";").map(Number);

    let i = 0;
    while (i < params.length) {
      const p = params[i];

      if (p === 0) {
        attrs = {};
      } else if (p === 1) {
        attrs = { ...attrs, bold: true };
      } else if (p === 2) {
        attrs = { ...attrs, dim: true };
      } else if (p === 3) {
        attrs = { ...attrs, italic: true };
      } else if (p === 4) {
        attrs = { ...attrs, underline: true };
      } else if (p >= 30 && p <= 37) {
        attrs = { ...attrs, fg: p - 30 };
      } else if (p >= 40 && p <= 47) {
        attrs = { ...attrs, bg: p - 40 };
      } else if (p >= 90 && p <= 97) {
        attrs = { ...attrs, fg: p - 90 + 8 };
      } else if (p >= 100 && p <= 107) {
        attrs = { ...attrs, bg: p - 100 + 8 };
      } else if (p === 38 || p === 48) {
        // 256-color or truecolor — skip sub-params
        if (i + 1 < params.length && params[i + 1] === 5) {
          i += 2; // skip ;5;N
        } else if (i + 1 < params.length && params[i + 1] === 2) {
          i += 4; // skip ;2;R;G;B
        }
      }
      i++;
    }
  }

  // Remaining text after last escape
  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text) segments.push({ text, attrs: { ...attrs } });
  }

  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/frontend/widgets/__tests__/ansi-parser.test.js`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/frontend/widgets/ansi-parser.js src/frontend/widgets/__tests__/ansi-parser.test.js
git commit -m "feat: add ANSI escape sequence parser for activity panel output"
```

### Task 4: Activity panel streaming output

**Files:**
- Modify: `src/frontend/widgets/activity-panel.js`
- Modify: `src/frontend/window.js:75-77`
- Modify: `src/frontend/style.css`

This task modifies GTK widgets — no unit tests (GTK requires the display server). Verified manually by running the app.

- [ ] **Step 1: Add output styles to `src/frontend/style.css`**

Append to the end of the file:

```css
.tool-output {
  font-family: monospace;
  font-size: 0.85em;
  padding: 6px 8px;
  background-color: @view_bg_color;
  border-radius: 6px;
}

.tool-output-scroll {
  max-height: 200px;
  margin-top: 4px;
  margin-start: 8px;
  margin-end: 8px;
  margin-bottom: 4px;
}
```

- [ ] **Step 2: Update `ActivityPanel` in `src/frontend/widgets/activity-panel.js`**

Replace the entire file with:

```javascript
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import { parseAnsi } from "./ansi-parser.js";

/**
 * ANSI color index → GDK RGBA string.
 * Standard 8 colors + 8 bright variants.
 */
const ANSI_COLORS = [
  "#2e3436", "#cc0000", "#4e9a06", "#c4a000",
  "#3465a4", "#75507b", "#06989a", "#d3d7cf",
  "#555753", "#ef2929", "#8ae234", "#fce94f",
  "#729fcf", "#ad7fa8", "#34e2e2", "#eeeeec",
];

/**
 * Activity panel showing running and completed tool executions.
 */
export class ActivityPanel {
  constructor() {
    this._entries = new Map(); // toolCallId -> { row, statusLabel, textView, buffer, scrolledWindow, toggleBtn, tagTable }

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
   * Mark a tool as running and create the output area.
   * @param {string} toolCallId
   */
  setRunning(toolCallId) {
    const entry = this._entries.get(toolCallId);
    if (!entry) return;

    entry.statusLabel.set_label("RUNNING");
    entry.statusLabel.set_css_classes(["caption", "accent"]);

    // Toggle button for showing/hiding output
    const toggleBtn = new Gtk.ToggleButton({
      label: "Show Output",
      css_classes: ["flat", "caption"],
      margin_start: 8,
      margin_end: 8,
    });

    // Output text buffer and view
    const buffer = new Gtk.TextBuffer();
    const textView = new Gtk.TextView({
      buffer,
      editable: false,
      cursor_visible: false,
      wrap_mode: Gtk.WrapMode.WORD_CHAR,
      css_classes: ["tool-output"],
    });

    const scrolledWindow = new Gtk.ScrolledWindow({
      css_classes: ["tool-output-scroll"],
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      visible: false,
    });
    scrolledWindow.set_child(textView);

    toggleBtn.connect("toggled", () => {
      const active = toggleBtn.get_active();
      scrolledWindow.set_visible(active);
      toggleBtn.set_label(active ? "Hide Output" : "Show Output");
    });

    entry.row.append(toggleBtn);
    entry.row.append(scrolledWindow);
    entry.toggleBtn = toggleBtn;
    entry.textView = textView;
    entry.buffer = buffer;
    entry.scrolledWindow = scrolledWindow;
    entry.userScrolled = false;
    entry.tagTable = buffer.get_tag_table();
    entry.tagCache = new Map();

    // Track user scroll to disable auto-scroll
    const adj = scrolledWindow.get_vadjustment();
    adj.connect("value-changed", () => {
      const atBottom = adj.get_value() >= adj.get_upper() - adj.get_page_size() - 1;
      entry.userScrolled = !atBottom;
    });
  }

  /**
   * Append streaming output to a tool's output area.
   * @param {string} toolCallId
   * @param {string} delta
   */
  appendOutput(toolCallId, delta) {
    const entry = this._entries.get(toolCallId);
    if (!entry || !entry.buffer) return;

    const segments = parseAnsi(delta);
    for (const segment of segments) {
      const endIter = entry.buffer.get_end_iter();
      const tags = this._getTagsForAttrs(entry, segment.attrs);
      if (tags.length > 0) {
        const startOffset = endIter.get_offset();
        entry.buffer.insert(endIter, segment.text, -1);
        const startIter = entry.buffer.get_iter_at_offset(startOffset);
        const newEndIter = entry.buffer.get_end_iter();
        for (const tag of tags) {
          entry.buffer.apply_tag(tag, startIter, newEndIter);
        }
      } else {
        entry.buffer.insert(endIter, segment.text, -1);
      }
    }

    // Auto-scroll if user hasn't scrolled up
    if (!entry.userScrolled) {
      const adj = entry.scrolledWindow.get_vadjustment();
      adj.set_value(adj.get_upper());
    }
  }

  /**
   * Get or create GtkTextTags for the given ANSI attributes.
   * @param {object} entry
   * @param {Record<string, unknown>} attrs
   * @returns {Gtk.TextTag[]}
   */
  _getTagsForAttrs(entry, attrs) {
    const keys = Object.keys(attrs);
    if (keys.length === 0) return [];

    const tags = [];
    for (const key of keys) {
      const val = attrs[key];
      const cacheKey = `${key}:${val}`;
      let tag = entry.tagCache.get(cacheKey);
      if (!tag) {
        tag = new Gtk.TextTag();
        if (key === "fg" && typeof val === "number") {
          tag.set_property("foreground", ANSI_COLORS[val] || null);
        } else if (key === "bg" && typeof val === "number") {
          tag.set_property("background", ANSI_COLORS[val] || null);
        } else if (key === "bold") {
          tag.set_property("weight", Pango.Weight.BOLD);
        } else if (key === "dim") {
          tag.set_property("weight", Pango.Weight.LIGHT);
        } else if (key === "italic") {
          tag.set_property("style", Pango.Style.ITALIC);
        } else if (key === "underline") {
          tag.set_property("underline", Pango.Underline.SINGLE);
        }
        entry.tagTable.add(tag);
        entry.tagCache.set(cacheKey, tag);
      }
      tags.push(tag);
    }
    return tags;
  }

  /**
   * Mark a tool as done.
   * @param {string} toolCallId
   * @param {number} exitCode
   */
  setDone(toolCallId, exitCode) {
    const entry = this._entries.get(toolCallId);
    if (!entry) return;

    if (exitCode === 0) {
      entry.statusLabel.set_label("✓ DONE");
      entry.statusLabel.set_css_classes(["caption", "success"]);
    } else {
      entry.statusLabel.set_label(`✗ FAILED (${exitCode})`);
      entry.statusLabel.set_css_classes(["caption", "error"]);
    }
  }
}
```

- [ ] **Step 3: Wire `onToolOutput` in `src/frontend/window.js`**

Replace the no-op handler at line 75-77:

```javascript
      onToolOutput: (_msg) => {
        // MVP: tool output not displayed (deferred to Iteration 3)
      },
```

With:

```javascript
      onToolOutput: (msg) =>
        this._activityPanel.appendOutput(msg.toolCallId, msg.delta),
```

- [ ] **Step 4: Commit**

```bash
git add src/frontend/widgets/activity-panel.js src/frontend/window.js src/frontend/style.css
git commit -m "feat: stream command output with ANSI colors in activity panel"
```

---

## Chunk 3: Markdown Segments + Syntax Highlighting

### Task 5: Markdown segment parser

**Files:**
- Modify: `src/frontend/widgets/markdown.js`
- Test: `src/frontend/widgets/__tests__/markdown-segments.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/frontend/widgets/__tests__/markdown-segments.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { parseSegments } from "../markdown.js";

describe("parseSegments", () => {
  it("returns a single text segment for plain text", () => {
    const segments = parseSegments("Hello world");
    expect(segments).toEqual([{ type: "text", content: "Hello world" }]);
  });

  it("extracts a code block with language", () => {
    const input = "Before\n```bash\necho hello\n```\nAfter";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "text", content: "Before" },
      { type: "code", language: "bash", content: "echo hello" },
      { type: "text", content: "After" },
    ]);
  });

  it("extracts a code block without language", () => {
    const input = "Before\n```\nsome code\n```\nAfter";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "text", content: "Before" },
      { type: "code", language: "", content: "some code" },
      { type: "text", content: "After" },
    ]);
  });

  it("handles multiple code blocks", () => {
    const input = "A\n```js\nconst x = 1;\n```\nB\n```py\nprint('hi')\n```\nC";
    const segments = parseSegments(input);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toEqual({ type: "text", content: "A" });
    expect(segments[1]).toEqual({ type: "code", language: "js", content: "const x = 1;" });
    expect(segments[2]).toEqual({ type: "text", content: "B" });
    expect(segments[3]).toEqual({ type: "code", language: "py", content: "print('hi')" });
    expect(segments[4]).toEqual({ type: "text", content: "C" });
  });

  it("handles code block at the start", () => {
    const input = "```json\n{}\n```\nAfter";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "code", language: "json", content: "{}" },
      { type: "text", content: "After" },
    ]);
  });

  it("handles code block at the end", () => {
    const input = "Before\n```yaml\nkey: val\n```";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "text", content: "Before" },
      { type: "code", language: "yaml", content: "key: val" },
    ]);
  });

  it("omits empty text segments", () => {
    const input = "```bash\necho hi\n```";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "code", language: "bash", content: "echo hi" },
    ]);
  });

  it("preserves multiline code block content", () => {
    const input = "```sh\nline1\nline2\nline3\n```";
    const segments = parseSegments(input);
    expect(segments[0].content).toBe("line1\nline2\nline3");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/frontend/widgets/__tests__/markdown-segments.test.js`
Expected: FAIL — `parseSegments` is not exported from `../markdown.js`

- [ ] **Step 3: Add `parseSegments` to `src/frontend/widgets/markdown.js`**

Add this function at the end of the file (after the existing `_renderTable` function):

```javascript
/**
 * Split a markdown string into text and code block segments.
 *
 * @param {string} text - Raw markdown
 * @returns {Array<{type: 'text', content: string} | {type: 'code', language: string, content: string}>}
 */
export function parseSegments(text) {
  const segments = [];
  const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before the code block
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      segments.push({ type: "text", content: before });
    }

    segments.push({
      type: "code",
      language: match[1].trim(),
      content: match[2].trimEnd(),
    });

    lastIndex = codeBlockRegex.lastIndex;
  }

  // Remaining text after last code block
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    segments.push({ type: "text", content: remaining });
  }

  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/frontend/widgets/__tests__/markdown-segments.test.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/frontend/widgets/markdown.js src/frontend/widgets/__tests__/markdown-segments.test.js
git commit -m "feat: add parseSegments to split markdown into text and code blocks"
```

### Task 6: GtkSourceView code blocks in message rows

**Files:**
- Modify: `src/frontend/widgets/message-row.js`

This task modifies GTK widgets — no unit tests. Relies on the `parseSegments` function tested in Task 5.

- [ ] **Step 1: Replace `src/frontend/widgets/message-row.js`**

Replace the entire file with:

```javascript
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";
import GtkSource from "gi://GtkSource?version=5";
import { markdownToPango, parseSegments } from "./markdown.js";

/**
 * Build a widget for a single code segment using GtkSourceView.
 *
 * @param {string} code - The code content
 * @param {string} language - Language hint (e.g., "bash", "json")
 * @returns {Gtk.Widget}
 */
function _buildCodeBlock(code, language) {
  const langManager = GtkSource.LanguageManager.get_default();
  const lang = language ? langManager.get_language(language) : null;

  const buffer = new GtkSource.Buffer();
  buffer.set_text(code, -1);
  if (lang) {
    buffer.set_language(lang);
    buffer.set_highlight_syntax(true);
  }

  // Use the default style scheme (respects dark/light theme)
  // Pick style scheme based on current theme (dark vs light)
  const styleManager = Adw.StyleManager.get_default();
  const isDark = styleManager.get_dark();
  const schemeManager = GtkSource.StyleSchemeManager.get_default();
  const scheme = schemeManager.get_scheme(isDark ? "Adwaita-dark" : "Adwaita");
  if (scheme) {
    buffer.set_style_scheme(scheme);
  }

  const view = new GtkSource.View({
    buffer,
    editable: false,
    cursor_visible: false,
    show_line_numbers: false,
    monospace: true,
    top_margin: 6,
    bottom_margin: 6,
    left_margin: 8,
    right_margin: 8,
    css_classes: ["card"],
  });

  return view;
}

/**
 * Build a segmented message widget with mixed text labels and code blocks.
 *
 * @param {string} text - Full markdown message
 * @returns {Gtk.Box}
 */
function _buildSegmentedContent(text) {
  const segments = parseSegments(text);
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  for (const segment of segments) {
    if (segment.type === "text") {
      const label = new Gtk.Label({
        label: markdownToPango(segment.content),
        use_markup: true,
        wrap: true,
        wrap_mode: 2, // WORD_CHAR
        xalign: 0,
        selectable: true,
        css_classes: ["agent-message"],
        margin_start: 8,
        margin_end: 8,
        margin_top: 4,
        margin_bottom: 4,
      });
      box.append(label);
    } else {
      const codeView = _buildCodeBlock(segment.content, segment.language);
      box.append(codeView);
    }
  }

  return box;
}

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

  const isAgent = role === "agent";

  const bubble = new Gtk.Box({
    css_classes: ["card", role === "user" ? "user-bubble" : "agent-bubble"],
  });

  if (isAgent) {
    // Use segmented rendering for agent messages
    const content = _buildSegmentedContent(text);
    bubble.append(content);
  } else {
    const label = new Gtk.Label({
      label: text,
      use_markup: false,
      wrap: true,
      wrap_mode: 2,
      xalign: 0,
      selectable: true,
      css_classes: ["user-message"],
      margin_start: 8,
      margin_end: 8,
      margin_top: 8,
      margin_bottom: 8,
    });
    bubble.append(label);
  }

  if (role === "user") {
    const spacer = new Gtk.Box({ hexpand: true });
    row.append(spacer);
    row.append(bubble);
  } else {
    row.append(bubble);
    const spacer = new Gtk.Box({ hexpand: true });
    row.append(spacer);
  }

  return row;
}

/**
 * Creates an agent message row that can be appended to (for streaming).
 * Returns the row widget, an append function, getText, and finalize.
 *
 * During streaming, uses a simple GtkLabel with Pango markup.
 * When finalize() is called, replaces the label with segmented
 * rendering (text + GtkSourceView code blocks).
 *
 * @returns {{ row: Gtk.Box, append: (text: string) => void, getText: () => string, finalize: () => void }}
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
    use_markup: true,
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
      try {
        label.set_markup(markdownToPango(content));
      } catch {
        label.set_label(content);
      }
    },
    getText() {
      return content;
    },
    finalize() {
      // Replace the streaming label with segmented rendering
      bubble.remove(label);
      const segmented = _buildSegmentedContent(content);
      bubble.append(segmented);
    },
  };
}
```

- [ ] **Step 2: Update `_finalizeStreaming` in `src/frontend/widgets/chat-view.js`**

Replace the `_finalizeStreaming` method (line 107-109):

```javascript
  _finalizeStreaming() {
    this._streamingRow = null;
  }
```

With:

```javascript
  _finalizeStreaming() {
    if (this._streamingRow) {
      this._streamingRow.finalize();
      this._streamingRow = null;
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/widgets/message-row.js src/frontend/widgets/chat-view.js
git commit -m "feat: syntax-highlighted code blocks using GtkSourceView in chat messages"
```

---

## Chunk 4: Session Sidebar

### Task 7: Session store metadata and summaries

**Files:**
- Modify: `src/frontend/session-store.js`

- [ ] **Step 1: Replace `src/frontend/session-store.js`**

Replace the entire file with:

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
  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg
    ? firstUserMsg.text.slice(0, 40)
    : "Untitled";
  const data = JSON.stringify(
    {
      sessionId,
      title,
      updatedAt: new Date().toISOString(),
      messages,
    },
    null,
    2,
  );
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

/**
 * Get summaries of all saved sessions (title + timestamp) without loading
 * full message arrays. Returns sorted by updatedAt descending (most recent first).
 *
 * Backward compatible: files without title/updatedAt metadata get defaults.
 *
 * @returns {Array<{sessionId: string, title: string, updatedAt: string}>}
 */
export function getSessionSummaries() {
  ensureDir();
  const dir = Gio.File.new_for_path(DATA_DIR);
  const enumerator = dir.enumerate_children(
    "standard::name,time::modified",
    Gio.FileQueryInfoFlags.NONE,
    null,
  );

  const summaries = [];
  let info;
  while ((info = enumerator.next_file(null))) {
    const name = info.get_name();
    if (!name.endsWith(".json")) continue;

    const sessionId = name.replace(".json", "");
    const path = GLib.build_filenamev([DATA_DIR, name]);

    try {
      const [ok, contents] = GLib.file_get_contents(path);
      if (!ok) continue;
      const data = JSON.parse(new TextDecoder().decode(contents));

      let title = data.title;
      let updatedAt = data.updatedAt;

      // Backward compat: derive from messages or file mtime
      if (!title) {
        const firstUser = (data.messages || []).find((m) => m.role === "user");
        title = firstUser ? firstUser.text.slice(0, 40) : "Untitled";
      }
      if (!updatedAt) {
        // Use file modification time as fallback
        const mtime = info.get_modification_date_time();
        updatedAt = mtime ? mtime.format_iso8601() : new Date().toISOString();
      }

      summaries.push({ sessionId, title, updatedAt });
    } catch {
      // Skip corrupt files
    }
  }

  summaries.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  return summaries;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/session-store.js
git commit -m "feat: add session metadata (title, updatedAt) and getSessionSummaries"
```

### Task 8: Backend session.new/session.load handlers

**Files:**
- Modify: `src/backend/confirmations.ts`
- Modify: `src/backend/main.ts`
- Modify: `src/backend/agent.ts` (export clearConfirmations)

- [ ] **Step 1: Add `clearAll` method to `src/backend/confirmations.ts`**

Add this method after the `resolve` method:

```typescript
  clearAll(): void {
    for (const [id, resolver] of this.pending) {
      resolver(false);
    }
    this.pending.clear();
  }
```

- [ ] **Step 2: Export `clearConfirmations` from `src/backend/agent.ts`**

Add this function after the existing `resolveConfirmation` export:

```typescript
export function clearConfirmations(): void {
  confirmations.clearAll();
}
```

- [ ] **Step 3: Update session handlers in `src/backend/main.ts`**

Add `clearConfirmations` to the import from `./agent.js`:

```typescript
import {
  handleUserMessage,
  resolveConfirmation,
  clearConfirmations,
} from "./agent.js";
```

Update the session handlers:

```typescript
    case "session.new":
      clearConfirmations();
      break;

    case "session.load":
      clearConfirmations();
      break;
```

- [ ] **Step 4: Run all tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/confirmations.ts src/backend/agent.ts src/backend/main.ts
git commit -m "feat: clear pending confirmations on session.new and session.load"
```

### Task 9: Session sidebar widget

**Files:**
- Create: `src/frontend/widgets/session-sidebar.js`

- [ ] **Step 1: Create `src/frontend/widgets/session-sidebar.js`**

```javascript
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import { getSessionSummaries } from "../session-store.js";

/**
 * Sidebar widget listing past conversation sessions with search.
 */
export class SessionSidebar {
  /**
   * @param {object} callbacks
   * @param {function(string): void} callbacks.onSessionSelected - Called with sessionId
   * @param {function(): void} callbacks.onNewSession - Called when "New Session" is clicked
   */
  constructor({ onSessionSelected, onNewSession }) {
    this._onSessionSelected = onSessionSelected;
    this._onNewSession = onNewSession;
    this._allSummaries = [];

    this.widget = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      width_request: 240,
      css_classes: ["sidebar"],
    });

    // Header
    const headerBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      margin_start: 12,
      margin_end: 12,
      margin_top: 12,
      margin_bottom: 8,
    });

    const headerLabel = new Gtk.Label({
      label: "Sessions",
      css_classes: ["heading"],
      xalign: 0,
      hexpand: true,
    });
    headerBox.append(headerLabel);

    const newBtn = new Gtk.Button({
      icon_name: "list-add-symbolic",
      css_classes: ["flat"],
      tooltip_text: "New Session",
    });
    newBtn.connect("clicked", () => this._onNewSession());
    headerBox.append(newBtn);

    this.widget.append(headerBox);

    // Search
    this._searchEntry = new Gtk.SearchEntry({
      placeholder_text: "Search sessions...",
      margin_start: 12,
      margin_end: 12,
      margin_bottom: 8,
    });
    this._searchEntry.connect("search-changed", () => this._filterList());
    this.widget.append(this._searchEntry);

    const separator = new Gtk.Separator({
      orientation: Gtk.Orientation.HORIZONTAL,
    });
    this.widget.append(separator);

    // Session list
    this._listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.SINGLE,
      css_classes: ["navigation-sidebar"],
    });
    this._listBox.connect("row-activated", (_listBox, row) => {
      if (row?._sessionId) {
        this._onSessionSelected(row._sessionId);
      }
    });

    const scrolled = new Gtk.ScrolledWindow({
      vexpand: true,
      hscrollbar_policy: Gtk.PolicyType.NEVER,
    });
    scrolled.set_child(this._listBox);
    this.widget.append(scrolled);
  }

  /**
   * Refresh the session list from disk.
   */
  refresh() {
    this._allSummaries = getSessionSummaries();
    this._filterList();
  }

  /**
   * Filter and rebuild the list based on the search query.
   */
  _filterList() {
    // Remove existing rows
    let child;
    while ((child = this._listBox.get_first_child())) {
      this._listBox.remove(child);
    }

    const query = this._searchEntry.get_text().toLowerCase();
    const filtered = query
      ? this._allSummaries.filter((s) => s.title.toLowerCase().includes(query))
      : this._allSummaries;

    for (const summary of filtered) {
      const row = this._createRow(summary);
      this._listBox.append(row);
    }
  }

  /**
   * Create a list row for a session summary.
   * @param {{sessionId: string, title: string, updatedAt: string}} summary
   * @returns {Gtk.ListBoxRow}
   */
  _createRow(summary) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_start: 8,
      margin_end: 8,
      margin_top: 4,
      margin_bottom: 4,
    });

    const titleLabel = new Gtk.Label({
      label: summary.title,
      xalign: 0,
      ellipsize: 3, // END
      css_classes: ["body"],
    });
    box.append(titleLabel);

    const timeLabel = new Gtk.Label({
      label: _formatRelativeTime(summary.updatedAt),
      xalign: 0,
      css_classes: ["caption", "dim-label"],
    });
    box.append(timeLabel);

    const row = new Gtk.ListBoxRow({ child: box });
    row._sessionId = summary.sessionId;
    return row;
  }
}

/**
 * Format an ISO date string as a relative time (e.g., "2 hours ago").
 * @param {string} isoDate
 * @returns {string}
 */
function _formatRelativeTime(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/widgets/session-sidebar.js
git commit -m "feat: add session sidebar widget with search and relative timestamps"
```

### Task 10: Integrate sidebar into window layout

**Files:**
- Modify: `src/frontend/window.js`
- Modify: `src/frontend/style.css`

- [ ] **Step 1: Add sidebar styles to `src/frontend/style.css`**

Append to the end of the file:

```css
.sidebar {
  background-color: @sidebar_bg_color;
}
```

- [ ] **Step 2: Replace `src/frontend/window.js`**

Replace the entire file with:

```javascript
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

import { IPCClient } from "./ipc-client.js";
import { ChatView } from "./widgets/chat-view.js";
import { ActivityPanel } from "./widgets/activity-panel.js";
import { SessionSidebar } from "./widgets/session-sidebar.js";
import { showPreferences } from "./preferences.js";
import { loadSession, saveSession } from "./session-store.js";

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

    // Header bar with sidebar toggle and preferences button
    const headerBar = new Adw.HeaderBar();

    const sidebarBtn = new Gtk.ToggleButton({
      icon_name: "sidebar-show-symbolic",
      tooltip_text: "Sessions",
    });
    headerBar.pack_start(sidebarBtn);

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

    // Session sidebar
    this._sidebar = new SessionSidebar({
      onSessionSelected: (sessionId) => this._switchSession(sessionId),
      onNewSession: () => this._newSession(),
    });

    // OverlaySplitView wraps sidebar + content
    this._splitView = new Adw.OverlaySplitView({
      sidebar: this._sidebar.widget,
      content: contentBox,
      show_sidebar: false,
    });

    // Bind toggle button to sidebar visibility
    sidebarBtn.bind_property(
      "active",
      this._splitView,
      "show-sidebar",
      GLib.BindingFlags.BIDIRECTIONAL | GLib.BindingFlags.SYNC_CREATE,
    );

    // Assemble with toolbar view
    const toolbarView = new Adw.ToolbarView();
    toolbarView.add_top_bar(headerBar);
    toolbarView.set_content(this._splitView);
    this._window.set_content(toolbarView);

    // IPC client
    this._ipc = new IPCClient({
      onText: (msg) => this._chatView.appendAgentText(msg.delta),
      onToolRequest: (msg) => this._handleToolRequest(msg),
      onToolRunning: (msg) => this._activityPanel.setRunning(msg.toolCallId),
      onToolOutput: (msg) =>
        this._activityPanel.appendOutput(msg.toolCallId, msg.delta),
      onToolDone: (msg) =>
        this._activityPanel.setDone(msg.toolCallId, msg.exitCode),
      onError: (msg) => this._chatView.showError(msg.message),
      onDisconnect: () =>
        this._chatView.showError(
          "Backend disconnected. Restart Frosty to reconnect.",
        ),
    });

    // Refresh sidebar when shown
    this._splitView.connect("notify::show-sidebar", () => {
      if (this._splitView.get_show_sidebar()) {
        this._sidebar.refresh();
      }
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
        GLib.spawn_command_line_sync(`kill ${this._backendPid}`);
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

    // Save session after each user message (captures the conversation so far)
    const messages = this._chatView.getMessages();
    saveSession(this._sessionId, messages);
  }

  _switchSession(sessionId) {
    const messages = loadSession(sessionId);
    if (!messages) return;

    this._sessionId = sessionId;
    this._chatView.clear();
    for (const msg of messages) {
      if (msg.role === "user") {
        this._chatView.addUserMessage(msg.text);
      } else {
        this._chatView.addAgentMessage(msg.text);
      }
    }

    this._ipc.send({ type: "session.load", sessionId });
    this._splitView.set_show_sidebar(false);
  }

  _newSession() {
    this._sessionId = GLib.uuid_string_random();
    this._chatView.clear();
    this._ipc.send({ type: "session.new" });
    this._splitView.set_show_sidebar(false);
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
        if (response === "run") {
          this._ipc.send({
            type: "confirm",
            toolCallId: msg.toolCallId,
            approved: true,
          });
        } else {
          this._ipc.send({
            type: "cancel",
            toolCallId: msg.toolCallId,
          });
        }
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

- [ ] **Step 3: Add `clear` and `addAgentMessage` methods to ChatView**

In `src/frontend/widgets/chat-view.js`, add a `_messages` array to track message data, then add these methods after `showError`:

First, add `this._messages = [];` in the constructor after `this._streamingRow = null;`.

Then update `addUserMessage` to also track the message:

After `this._finalizeStreaming();` at the top of `addUserMessage`, add:
```javascript
    this._messages.push({ role: "user", text, timestamp: Date.now() });
```

Update `_finalizeStreaming` to track agent messages:
```javascript
  _finalizeStreaming() {
    if (this._streamingRow) {
      const text = this._streamingRow.getText();
      this._messages.push({ role: "agent", text, timestamp: Date.now() });
      this._streamingRow.finalize();
      this._streamingRow = null;
    }
  }
```

Add these new methods after `showError`:

```javascript
  /**
   * Clear all messages from the chat view.
   */
  clear() {
    this._finalizeStreaming();
    this._messages = [];
    let child;
    while ((child = this._messageList.get_first_child())) {
      this._messageList.remove(child);
    }
  }

  /**
   * Add a complete agent message to the chat (used when loading sessions).
   * @param {string} text
   */
  addAgentMessage(text) {
    this._finalizeStreaming();
    this._messages.push({ role: "agent", text, timestamp: Date.now() });
    const row = createMessageRow("agent", text);
    this._messageList.append(row);
    this._scrollToBottom();
  }

  /**
   * Get all messages in the current conversation.
   * @returns {Array<{role: string, text: string, timestamp: number}>}
   */
  getMessages() {
    // Finalize any in-progress streaming before returning
    this._finalizeStreaming();
    return [...this._messages];
  }
```

- [ ] **Step 4: Run all tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/frontend/window.js src/frontend/widgets/chat-view.js src/frontend/widgets/session-sidebar.js src/frontend/style.css
git commit -m "feat: add toggleable session sidebar with search and session switching"
```
