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
