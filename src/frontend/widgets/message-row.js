import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import { markdownToPango, parseSegments } from "./markdown.js";

// GtkSourceView is not available on Snow Linux (no typelib for v5,
// v4 conflicts with GTK4). Using plain GtkTextView for code blocks.
// Re-enable when packaging as Flatpak with gir1.2-gtksource-5.

function _buildCodeBlock(code, _language) {
  const buffer = new Gtk.TextBuffer();
  buffer.set_text(code, -1);
  const view = new Gtk.TextView({
    buffer,
    editable: false,
    cursor_visible: false,
    monospace: true,
    wrap_mode: Gtk.WrapMode.WORD_CHAR,
    top_margin: 6,
    bottom_margin: 6,
    left_margin: 8,
    right_margin: 8,
    css_classes: ["card"],
  });
  return view;
}

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
        wrap_mode: 2,
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
      bubble.remove(label);
      const segmented = _buildSegmentedContent(content);
      bubble.append(segmented);
    },
  };
}
