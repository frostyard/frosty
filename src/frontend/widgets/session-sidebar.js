import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import { getSessionSummaries } from "../session-store.js";

export class SessionSidebar {
  constructor({ onSessionSelected, onNewSession }) {
    this._onSessionSelected = onSessionSelected;
    this._onNewSession = onNewSession;
    this._allSummaries = [];

    this.widget = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      width_request: 240,
      css_classes: ["sidebar"],
    });

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

  refresh() {
    this._allSummaries = getSessionSummaries();
    this._filterList();
  }

  _filterList() {
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
      ellipsize: 3,
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
