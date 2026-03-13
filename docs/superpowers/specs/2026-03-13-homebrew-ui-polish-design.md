# Homebrew Skill + UI Polish Design

Covers the next phase of Frosty development: Homebrew skill, streaming command output with ANSI color support, syntax highlighting for code blocks, and a toggleable session sidebar. Organized as three vertical slices, each independently testable end-to-end.

## Slice 1: Homebrew Skill

### Overview

New file `src/backend/skills/homebrew.ts` mirroring the Flatpak skill pattern. Provides full Homebrew management including maintenance commands.

### Tools

| Tool | Description | Risk | Args |
|------|-------------|------|------|
| `brew_list` | List installed formulae and casks | safe | none |
| `brew_search` | Search for formulae/casks | safe | `query: string` |
| `brew_info` | Show details about a formula/cask | safe | `name: string` |
| `brew_install` | Install a formula or cask | mutating | `name: string` |
| `brew_uninstall` | Remove a formula or cask | mutating | `name: string` |
| `brew_update` | Fetch latest package index | safe | none |
| `brew_upgrade` | Upgrade installed packages | mutating | `formula?: string`, `greedy?: boolean` |
| `brew_doctor` | Run diagnostic checks | safe | none |
| `brew_cleanup` | Remove old versions and cache | mutating | none |

### Implementation

- `buildBrewCommand(toolName, args)` returns `{ command, risk }` using the same `shellEscape` + switch pattern as `flatpak.ts`
- `brew_upgrade` with no `formula` arg runs `brew upgrade`; with `greedy: true` adds `--greedy`; with `formula` arg upgrades only that package
- Registration in `skills/index.ts` follows the same pattern as Flatpak

### Files Changed

- **New:** `src/backend/skills/homebrew.ts`
- **Modified:** `src/backend/skills/index.ts` — register Homebrew tools
- **New:** `src/backend/__tests__/homebrew.test.ts`

---

## Slice 2: Streaming Output + Syntax Highlighting

### Overview

Two related features: live command output in the activity panel with ANSI color rendering, and syntax-highlighted code blocks in agent chat messages.

### Streaming Output in Activity Panel

**No backend changes required.** The `tool.output` IPC message already exists with `{ toolCallId, delta }`. The executor already streams stdout/stderr. The gap is in `window.js` where `onToolOutput` is currently a no-op.

**Activity panel entry changes:**

- When a tool starts running (`setRunning`), a read-only monospace `GtkTextView` is created inside the entry's card widget
- The text view is wrapped in a `GtkScrolledWindow` with max height ~200px
- Output area is collapsed by default; a "Show Output" / "Hide Output" toggle reveals it
- Each `tool.output` delta is appended to the `GtkTextBuffer`
- Auto-scrolls to bottom while running; stops if user scrolls up manually
- ANSI color parsing covers the standard set:
  - Foreground colors: 30-37 (standard), 90-97 (bright)
  - Background colors: 40-47 (standard), 100-107 (bright)
  - Bold (1), dim (2), italic (3), underline (4), reset (0)
  - SGR sequences (`\e[...m`) only — no cursor movement
- Colors are applied via `GtkTextTag` objects on the `GtkTextBuffer`
- An ANSI parser module (`src/frontend/widgets/ansi-parser.js`) handles stripping escape sequences and returning `[{ text, attrs }]` segments

### Syntax Highlighting in Chat Messages

**Current state:** `markdownToPango` in `markdown.js` renders code blocks as `<tt>...</tt>` inside a Pango markup string displayed by a `GtkLabel`.

**New approach:** `MessageRow` switches from a single `GtkLabel` to a `GtkBox` containing mixed content:

1. The markdown parser is refactored to split messages into segments:
   ```
   [
     { type: 'text', content: 'Here is the command:' },
     { type: 'code', language: 'bash', content: 'brew install git' },
     { type: 'text', content: 'This will install git.' }
   ]
   ```

2. Text segments are rendered as `GtkLabel` with Pango markup (using existing `markdownToPango` but only for non-code content)

3. Code segments are rendered as `GtkSourceView` widgets:
   - Import from `gi://GtkSource?version=5`
   - `GtkSourceBuffer` with language set via `GtkSourceLanguageManager.get_default().get_language(lang)`
   - Read-only, no line numbers, monospace
   - Uses the default GtkSourceView style scheme (respects dark/light theme)
   - Falls back to plain `GtkTextView` (monospace) if language hint is missing or unrecognized

### Files Changed

- **Modified:** `src/frontend/widgets/activity-panel.js` — add output text view, ANSI rendering, collapse toggle
- **New:** `src/frontend/widgets/ansi-parser.js` — ANSI escape sequence parser
- **Modified:** `src/frontend/widgets/message-row.js` — switch to segmented rendering
- **Modified:** `src/frontend/widgets/markdown.js` — add `parseSegments()` export that returns text/code segments; keep `markdownToPango` for text segments only
- **Modified:** `src/frontend/window.js` — wire `onToolOutput` to activity panel
- **Modified:** `src/frontend/style.css` — styles for output area, source view
- **New:** `src/frontend/widgets/__tests__/ansi-parser.test.js`
- **New:** `src/frontend/widgets/__tests__/markdown-segments.test.js`

---

## Slice 3: Session Sidebar

### Overview

A toggleable sidebar listing past conversation sessions with search, using `Adw.OverlaySplitView` for the standard LibAdwaita collapsible sidebar pattern.

### Layout Change

Current layout: `[ChatView | Separator | ActivityPanel]`

New layout uses `Adw.OverlaySplitView`:
- **Sidebar (collapsible):** Session list
- **Content:** `[ChatView | Separator | ActivityPanel]` (unchanged)

The `OverlaySplitView` handles responsive behavior — sidebar overlays on narrow windows, sits alongside on wide ones.

### Toggle Button

A button in the header bar with `sidebar-show-symbolic` icon toggles `overlay_split_view.show_sidebar`. Sidebar starts hidden.

### Sidebar Contents

New file `src/frontend/widgets/session-sidebar.js`:

- **Header area:** "Sessions" title label
- **New Session button:** `list-add-symbolic` icon, generates new UUID, clears chat, sends `session.new` over IPC
- **Search:** `GtkSearchEntry` filters session list by matching against stored titles
- **Session list:** `GtkListBox` sorted by most recent first. Each row shows:
  - Title: first user message, truncated to ~40 characters
  - Timestamp: relative time (e.g., "2 hours ago", "yesterday")
- **Click handler:** Loads session via `session.load` IPC message, rebuilds chat view

### Session Store Changes

`src/frontend/session-store.js` modifications:

- `saveSession` stores additional metadata: `title` (first user message text, truncated) and `updatedAt` (ISO timestamp)
- New export `getSessionSummaries()`: reads each session file's metadata (title + updatedAt) without loading full message arrays. Returns `[{ sessionId, title, updatedAt }]` sorted by `updatedAt` descending.
- Backward compatible: if an existing session file lacks `title`/`updatedAt`, derive title from first message or use "Untitled", and use file mtime for timestamp.

### Session Switching Flow

1. User clicks session row
2. Frontend calls `loadSession(sessionId)` to get messages
3. Frontend rebuilds `ChatView` message list from loaded messages
4. Frontend sends `{ type: "session.load", sessionId }` over IPC
5. Backend reloads conversation history for that session
6. `this._sessionId` is updated

### New Session Flow

1. User clicks "New Session" button
2. Frontend generates new UUID
3. Frontend clears `ChatView`
4. Frontend sends `{ type: "session.new" }` over IPC
5. `this._sessionId` is updated
6. New session appears in sidebar after first message is sent (triggers save)

### Files Changed

- **New:** `src/frontend/widgets/session-sidebar.js`
- **Modified:** `src/frontend/window.js` — wrap content in `Adw.OverlaySplitView`, add toggle button, wire sidebar events
- **Modified:** `src/frontend/session-store.js` — add metadata fields, `getSessionSummaries()`
- **Modified:** `src/frontend/style.css` — sidebar styling

---

## Implementation Order

1. **Slice 1 — Homebrew Skill:** Backend-only, self-contained, follows established pattern
2. **Slice 2 — Streaming Output + Syntax Highlighting:** Frontend-heavy, builds on existing IPC protocol
3. **Slice 3 — Session Sidebar:** Most UI-invasive change, done last when other features are stable

Each slice is a separate commit (or set of commits) and can be tested independently.
