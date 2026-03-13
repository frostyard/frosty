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
    this._messages = [];
    this._spinnerRow = null;

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
    this._showSpinner();
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
    this._messages.push({ role: "user", text, timestamp: Date.now() });
    const row = createMessageRow("user", text);
    this._messageList.append(row);
    this._scrollToBottom();
  }

  /**
   * Start a new streaming agent message or append to the current one.
   * @param {string} delta
   */
  appendAgentText(delta) {
    this._hideSpinner();
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
    if (this._streamingRow) {
      const text = this._streamingRow.getText();
      this._messages.push({ role: "agent", text, timestamp: Date.now() });
      this._streamingRow.finalize();
      this._streamingRow = null;
    }
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
    this._hideSpinner();
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
    this._hideSpinner();
    this._finalizeStreaming();
    const row = createMessageRow("agent", `Error: ${message}`);
    this._messageList.append(row);
    this._scrollToBottom();
  }

  _showSpinner() {
    this._hideSpinner();
    const row = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      margin_start: 12,
      margin_top: 4,
      margin_bottom: 4,
      spacing: 8,
    });
    const spinner = new Gtk.Spinner({ spinning: true });
    row.append(spinner);
    const label = new Gtk.Label({
      label: "Thinking...",
      css_classes: ["dim-label", "caption"],
    });
    row.append(label);
    this._spinnerRow = row;
    this._messageList.append(row);
    this._scrollToBottom();
  }

  _hideSpinner() {
    if (this._spinnerRow) {
      this._messageList.remove(this._spinnerRow);
      this._spinnerRow = null;
    }
  }

  clear() {
    this._finalizeStreaming();
    this._messages = [];
    let child;
    while ((child = this._messageList.get_first_child())) {
      this._messageList.remove(child);
    }
  }

  addAgentMessage(text) {
    this._finalizeStreaming();
    this._messages.push({ role: "agent", text, timestamp: Date.now() });
    const row = createMessageRow("agent", text);
    this._messageList.append(row);
    this._scrollToBottom();
  }

  getMessages() {
    this._finalizeStreaming();
    return [...this._messages];
  }
}
