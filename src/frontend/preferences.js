import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw?version=1";

const SETTINGS_PATH = GLib.build_filenamev([
  GLib.get_user_config_dir(),
  "frosty",
  "settings.json",
]);

function ensureConfigDir() {
  const dir = GLib.path_get_dirname(SETTINGS_PATH);
  GLib.mkdir_with_parents(dir, 0o755);
}

function loadSettings() {
  try {
    const [ok, contents] = GLib.file_get_contents(SETTINGS_PATH);
    if (!ok) return { provider: "claude-code", apiKey: "", model: "" };
    return JSON.parse(new TextDecoder().decode(contents));
  } catch {
    return { provider: "claude-code", apiKey: "", model: "" };
  }
}

function saveSettings(settings) {
  ensureConfigDir();
  GLib.file_set_contents(
    SETTINGS_PATH,
    JSON.stringify(settings, null, 2),
  );
}

/**
 * Show the preferences dialog.
 * @param {Gtk.Window} parent
 */
export function showPreferences(parent) {
  const settings = loadSettings();

  const dialog = new Adw.PreferencesDialog();

  const page = new Adw.PreferencesPage({
    title: "Settings",
    icon_name: "preferences-system-symbolic",
  });
  dialog.add(page);

  const group = new Adw.PreferencesGroup({
    title: "AI Provider",
  });
  page.add(group);

  // Provider dropdown
  const providerRow = new Adw.ComboRow({
    title: "Provider",
  });
  const providers = ["claude-code", "anthropic", "openai", "openrouter", "codex"];
  const providerListModel = Gtk.StringList.new(providers);
  providerRow.set_model(providerListModel);
  const currentIdx = providers.indexOf(settings.provider);
  if (currentIdx >= 0) providerRow.set_selected(currentIdx);
  group.add(providerRow);

  // API Key (masked)
  const apiKeyRow = new Adw.PasswordEntryRow({
    title: "API Key",
    text: settings.apiKey || "",
  });
  group.add(apiKeyRow);

  // Model override
  const modelRow = new Adw.EntryRow({
    title: "Model (optional)",
    text: settings.model || "",
  });
  group.add(modelRow);

  // Save on close
  dialog.connect("closed", () => {
    const selected = providerRow.get_selected();
    saveSettings({
      provider: providers[selected] || "claude-code",
      apiKey: apiKeyRow.get_text(),
      model: modelRow.get_text() || undefined,
    });
  });

  dialog.present(parent);
}
