import GLib from "gi://GLib";
import Gio from "gi://Gio";

const DATA_DIR = GLib.build_filenamev([
  GLib.get_user_data_dir(),
  "frosty",
  "sessions",
]);

/**
 * Ensures the sessions directory exists.
 */
function ensureDir() {
  GLib.mkdir_with_parents(DATA_DIR, 0o755);
}

/**
 * Save a session to disk.
 * @param {string} sessionId
 * @param {Array<{role: string, text: string, timestamp: number}>} messages
 */
export function saveSession(sessionId, messages) {
  ensureDir();
  const path = GLib.build_filenamev([DATA_DIR, `${sessionId}.json`]);
  const data = JSON.stringify({ sessionId, messages }, null, 2);
  GLib.file_set_contents(path, data);
}

/**
 * Load a session from disk.
 * @param {string} sessionId
 * @returns {Array<{role: string, text: string, timestamp: number}>|null}
 */
export function loadSession(sessionId) {
  const path = GLib.build_filenamev([DATA_DIR, `${sessionId}.json`]);
  try {
    const [ok, contents] = GLib.file_get_contents(path);
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(contents));
    return data.messages;
  } catch {
    return null;
  }
}

/**
 * List all saved session IDs.
 * @returns {string[]}
 */
export function listSessions() {
  ensureDir();
  const dir = Gio.File.new_for_path(DATA_DIR);
  const enumerator = dir.enumerate_children(
    "standard::name",
    Gio.FileQueryInfoFlags.NONE,
    null,
  );

  const sessions = [];
  let info;
  while ((info = enumerator.next_file(null))) {
    const name = info.get_name();
    if (name.endsWith(".json")) {
      sessions.push(name.replace(".json", ""));
    }
  }
  return sessions;
}
