#!/usr/bin/env gjs -m

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";
import Gdk from "gi://Gdk?version=4.0";

// Promisify async methods we'll use
Gio._promisify(Gio.DataInputStream.prototype, "read_line_async", "read_line_finish_utf8");
Gio._promisify(Gio.OutputStream.prototype, "write_bytes_async");
Gio._promisify(Gio.SocketClient.prototype, "connect_async");

import { FrostyWindow } from "./window.js";

const application = new Adw.Application({
  application_id: "com.frostyard.Frosty",
  flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
});

application.connect("startup", (_app) => {
  const cssProvider = new Gtk.CssProvider();
  // Use import.meta.url for reliable path resolution in ESM Gjs
  const thisDir = GLib.path_get_dirname(
    GLib.filename_from_uri(import.meta.url)[0],
  );
  const cssPath = GLib.build_filenamev([thisDir, "style.css"]);
  cssProvider.load_from_path(cssPath);
  Gtk.StyleContext.add_provider_for_display(
    Gdk.Display.get_default(),
    cssProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
  );
});

let frostyWindow = null;
application.connect("activate", (app) => {
  if (!frostyWindow) {
    frostyWindow = new FrostyWindow(app);
  }
  frostyWindow.present();
});

application.run([imports.system.programInvocationName].concat(ARGV));
