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
