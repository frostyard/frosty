# Frosty — AI System Administration Assistant for Snow Linux

## Overview

Frosty is a conversational AI assistant for managing a Snow Linux desktop. Users describe what they want in natural language, and Frosty figures out the right tool and executes it with appropriate confirmation. It runs as a GTK4/LibAdwaita desktop application backed by a Node.js agent using one-agent-sdk for provider-agnostic AI.

## Architecture

Two-process design connected via Unix domain socket:

- **Frontend (Gjs / GTK4 + LibAdwaita):** Chat UI with activity panel, tiered confirmation dialogs, session history, provider settings.
- **Backend (Node.js / one-agent-sdk):** Agent core with built-in skills, tool execution, streaming output. Routes to the user's chosen AI provider.

### IPC

Unix domain socket at `$XDG_RUNTIME_DIR/frosty.sock`. Newline-delimited JSON protocol.

**Frontend → Backend:**

| Message | Description |
|---|---|
| `{ "type": "message", "text": "...", "sessionId": "..." }` | User input |
| `{ "type": "confirm", "toolCallId": "...", "approved": true }` | Confirmation response |
| `{ "type": "cancel", "toolCallId": "..." }` | Cancel a pending command |
| `{ "type": "session.new" }` | Start new session |
| `{ "type": "session.load", "sessionId": "..." }` | Load existing session |

**Backend → Frontend:**

| Message | Description |
|---|---|
| `{ "type": "text", "delta": "..." }` | Streamed text chunk |
| `{ "type": "tool.request", "toolCallId": "...", "name": "...", "args": {...}, "risk": "safe\|mutating\|destructive" }` | Tool call needing confirmation |
| `{ "type": "tool.running", "toolCallId": "..." }` | Command started |
| `{ "type": "tool.output", "toolCallId": "...", "delta": "..." }` | Streamed command output |
| `{ "type": "tool.done", "toolCallId": "...", "exitCode": 0 }` | Command finished |
| `{ "type": "error", "message": "..." }` | Error |

The `risk` field on `tool.request` drives tiered confirmation:
- `safe` — auto-approved, runs immediately
- `mutating` — inline confirmation in chat ("Run this?")
- `destructive` — modal GTK dialog with command details

### Lifecycle

The GTK app spawns the Node backend on startup and kills it on exit. The socket is the single communication channel.

- **Startup:** Frontend spawns the backend process, then retry-connects to the socket until it becomes available (short backoff, ~100ms intervals, timeout after 5s).
- **Backend crash:** Frontend detects socket EOF, shows an error in the chat, and offers to restart the backend.
- **Settings:** Frontend reads/writes `~/.config/frosty/settings.json` directly (no IPC needed). Backend reads it on startup and when a new session begins.

## UI Design

Main window with two panels:

- **Chat panel (left, dominant):** Message bubbles (agent/user), inline confirmation bars for mutating commands, text input at bottom.
- **Activity panel (right, narrower):** Shows running commands with live status and completed commands with exit codes. Provides visibility into execution without cluttering the chat.

## Skills

Each skill is a TypeScript module in `src/backend/skills/` that exports a `registerSkill()` function. Skills register typed tools using one-agent-sdk's `tool()` function with Zod schemas. Each tool has an explicit risk classification.

### Flatpak skill

| Tool | Risk | Description |
|---|---|---|
| `flatpak_list` | safe | List installed flatpaks |
| `flatpak_search` | safe | Search Flathub |
| `flatpak_info` | safe | Show app details |
| `flatpak_install` | mutating | Install an app |
| `flatpak_uninstall` | mutating | Remove an app |
| `flatpak_update` | mutating | Update apps |

### Homebrew skill

| Tool | Risk | Description |
|---|---|---|
| `brew_list` | safe | List installed formulae/casks |
| `brew_search` | safe | Search packages |
| `brew_info` | safe | Show package details |
| `brew_install` | mutating | Install a package |
| `brew_uninstall` | mutating | Remove a package |
| `brew_update` | mutating | Update Homebrew + upgrade packages |

### Atomic/nbc skill

| Tool | Risk | Description |
|---|---|---|
| `nbc_status` | safe | Show current image, active slot, staged updates |
| `nbc_check_update` | safe | Check if a system update is available (`nbc update --check`) |
| `nbc_update` | destructive | Pull and stage system update to inactive partition |
| `nbc_cache_list` | safe | List cached container images |
| `nbc_cache_clear` | destructive | Clear cached images |

All nbc tools use `--json` for structured output parsing.

### Sysext/updex skill

| Tool | Risk | Description |
|---|---|---|
| `updex_features_list` | safe | List all features and their status |
| `updex_features_check` | safe | Check for available updates |
| `updex_features_enable` | mutating | Enable a feature (supports `--now` for immediate download) |
| `updex_features_disable` | mutating | Disable a feature (supports `--now` for immediate removal) |
| `updex_features_update` | mutating | Update all enabled features |
| `updex_daemon_status` | safe | Show auto-update timer state |
| `updex_daemon_enable` | mutating | Enable automatic updates |
| `updex_daemon_disable` | mutating | Disable automatic updates |

All updex tools use `--json` for structured output parsing.

### Shell skill (ad-hoc)

| Tool | Risk | Description |
|---|---|---|
| `shell_exec` | mutating | Run an arbitrary shell command proposed by the agent |

Pipe-to-shell patterns (`curl | bash`) are always escalated to `destructive`. Detection: regex match for common patterns (`| bash`, `| sh`, `| sudo`) applied to the command string before execution.

## System Prompt

The agent's system prompt establishes:

**Identity & context:**
- Frosty is a system administration assistant for Snow Linux
- Snow Linux is an atomic, immutable Debian-based OS using A/B root partitions
- `/usr` is read-only; `/etc` overlays onto `/usr/etc`; `/var` and `/home` are writable
- System updates via `nbc`, sysexts via `updex`, apps via `flatpak` and `brew`

**Tool selection guidance:**
- Desktop apps → prefer Flatpak (sandboxed, doesn't touch base OS)
- CLI tools / dev dependencies → prefer Homebrew (installs to `/home/linuxbrew/`)
- System-level components → sysexts via `updex` (extends `/usr` atomically)
- OS updates → `nbc` (A/B partition update, requires reboot)

**Safety rules:**
- Never run commands outside the tool/confirmation flow
- Never modify `/usr` directly
- Always use `--json` flags for parsing tool output
- For `nbc update`: warn that reboot is required
- For destructive operations: explain consequences before requesting confirmation
- If unsure which tool to use, explain options and ask the user

**Ad-hoc shell rules:**
- Only propose shell commands when no built-in tool covers the need
- Classify risk level honestly — never downgrade to avoid confirmation
- Pipe-to-shell patterns are always `destructive`

## Project Structure

```
frosty/
├── package.json              # Monorepo root
├── src/
│   ├── backend/
│   │   ├── main.ts           # Entry point — starts IPC server, initializes agent
│   │   ├── agent.ts          # one-agent-sdk setup, provider config, conversation loop
│   │   ├── ipc.ts            # Unix socket server, JSON-line protocol
│   │   ├── executor.ts       # Runs commands, streams output, captures exit codes
│   │   ├── system-prompt.ts  # Snow Linux system prompt construction
│   │   └── skills/
│   │       ├── index.ts      # Registers all skills
│   │       ├── flatpak.ts
│   │       ├── homebrew.ts
│   │       ├── nbc.ts
│   │       ├── updex.ts
│   │       └── shell.ts
│   └── frontend/
│       ├── main.js           # Gjs entry point — GTK Application
│       ├── window.js         # Main window with chat + activity panel
│       ├── widgets/
│       │   ├── chat-view.js      # Message list, input bar
│       │   ├── activity-panel.js # Running/completed commands
│       │   ├── message-row.js    # Individual message bubble
│       │   └── confirm-bar.js    # Inline confirmation widget
│       ├── ipc-client.js     # Connects to Unix socket, parses JSON lines
│       └── session-store.js  # Read/write sessions to disk
├── data/
│   ├── com.frostyard.Frosty.desktop    # Desktop entry
│   ├── com.frostyard.Frosty.metainfo.xml
│   └── icons/
└── meson.build               # Build system (standard for GNOME apps)
```

## Data Locations (XDG)

| Path | Purpose |
|---|---|
| `~/.local/share/frosty/sessions/` | Conversation history (JSON per session) |
| `~/.config/frosty/settings.json` | Provider selection, API keys, preferences |
| `$XDG_RUNTIME_DIR/frosty.sock` | IPC socket (ephemeral) |

## MVP Scope

The first iteration delivers a vertical slice — one complete path from UI to system command.

**In scope:**
- GTK4/LibAdwaita window with chat panel, activity panel, input bar
- Node.js backend with one-agent-sdk, single provider working
- Unix socket IPC with JSON-line protocol
- Flatpak skill (fully implemented)
- Shell skill (ad-hoc fallback)
- Tiered confirmation flow (all three levels)
- Session history persistence (save/load). MVP has no session sidebar — new session on launch, `session.load` available via IPC for future UI.
- Provider settings (API key, model selection). Frontend reads/writes settings.json directly; a simple preferences dialog.
- System prompt with full Snow Linux context

## Deferred Roadmap

### Iteration 2: Core Skills
- Homebrew skill — full implementation
- nbc skill — status, check, update, cache management
- updex skill — feature management, daemon control

### Iteration 3: UI Polish
- Session sidebar — list past conversations, search, load
- Streaming command output in activity panel (live terminal-like view)
- Markdown rendering in agent messages
- Syntax highlighting for code blocks and command output

### Iteration 4: Packaging & Distribution
- Desktop entry and appstream metainfo
- Meson build system for full GNOME integration
- Application icons and branding
- Flatpak packaging of Frosty itself

### Iteration 5: Advanced Features
- Context from past sessions (opt-in, token-aware)
- Skill suggestions ("I notice you have docker sysext disabled, want to enable it?")
- System health dashboard panel
- Notification integration (notify on long-running command completion)
