import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import { parseAnsi } from "./ansi-parser.js";

const ANSI_COLORS = [
  "#2e3436", "#cc0000", "#4e9a06", "#c4a000",
  "#3465a4", "#75507b", "#06989a", "#d3d7cf",
  "#555753", "#ef2929", "#8ae234", "#fce94f",
  "#729fcf", "#ad7fa8", "#34e2e2", "#eeeeec",
];

export class ActivityPanel {
  constructor() {
    this._entries = new Map();

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
      ellipsize: 3,
    });
    row.append(nameLabel);

    this._list.prepend(row);
    this._entries.set(toolCallId, { row, statusLabel });
  }

  setRunning(toolCallId) {
    const entry = this._entries.get(toolCallId);
    if (!entry) return;

    entry.statusLabel.set_label("RUNNING");
    entry.statusLabel.set_css_classes(["caption", "accent"]);

    const toggleBtn = new Gtk.ToggleButton({
      label: "Show Output",
      css_classes: ["flat", "caption"],
      margin_start: 8,
      margin_end: 8,
    });

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
      margin_start: 8,
      margin_end: 8,
    });
    scrolledWindow.set_max_content_height(200);
    scrolledWindow.set_propagate_natural_height(true);
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

    const adj = scrolledWindow.get_vadjustment();
    adj.connect("value-changed", () => {
      const atBottom = adj.get_value() >= adj.get_upper() - adj.get_page_size() - 1;
      entry.userScrolled = !atBottom;
    });
  }

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

    if (!entry.userScrolled) {
      const adj = entry.scrolledWindow.get_vadjustment();
      adj.set_value(adj.get_upper());
    }
  }

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
