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
