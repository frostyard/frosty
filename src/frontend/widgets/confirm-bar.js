import Gtk from "gi://Gtk?version=4.0";

/**
 * Creates an inline confirmation bar for a tool request.
 *
 * @param {string} toolName - The tool being called
 * @param {object} args - Tool arguments
 * @param {function} onApprove - Called when user clicks Run
 * @param {function} onCancel - Called when user clicks Cancel
 * @returns {Gtk.Box} The confirmation bar widget
 */
export function createConfirmBar(toolName, args, onApprove, onCancel) {
  const bar = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    margin_start: 12,
    margin_end: 12,
    margin_top: 4,
    margin_bottom: 4,
    css_classes: ["card"],
  });

  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_start: 8,
    margin_end: 8,
    margin_top: 8,
    spacing: 8,
  });

  const icon = new Gtk.Label({
    label: "⚡",
  });
  headerBox.append(icon);

  const title = new Gtk.Label({
    label: `Run ${toolName}?`,
    css_classes: ["heading"],
    xalign: 0,
    hexpand: true,
  });
  headerBox.append(title);
  bar.append(headerBox);

  // Show command/args
  const argsText = Object.entries(args)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  if (argsText) {
    const argsLabel = new Gtk.Label({
      label: argsText,
      wrap: true,
      wrap_mode: 2,
      xalign: 0,
      css_classes: ["dim-label", "monospace"],
      margin_start: 8,
      margin_end: 8,
      margin_top: 4,
    });
    bar.append(argsLabel);
  }

  // Buttons
  const buttonBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
    margin_start: 8,
    margin_end: 8,
    margin_top: 8,
    margin_bottom: 8,
    halign: Gtk.Align.END,
  });

  const cancelBtn = new Gtk.Button({
    label: "Cancel",
  });
  cancelBtn.connect("clicked", () => {
    onCancel();
    bar.set_sensitive(false);
  });
  buttonBox.append(cancelBtn);

  const runBtn = new Gtk.Button({
    label: "Run",
    css_classes: ["suggested-action"],
  });
  runBtn.connect("clicked", () => {
    onApprove();
    bar.set_sensitive(false);
  });
  buttonBox.append(runBtn);

  bar.append(buttonBox);

  return bar;
}
