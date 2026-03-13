import GLib from "gi://GLib";
import Gio from "gi://Gio";

const DATA_DIR = GLib.build_filenamev([
  GLib.get_user_data_dir(),
  "frosty",
  "sessions",
]);

function ensureDir() {
  GLib.mkdir_with_parents(DATA_DIR, 0o755);
}

export function saveSession(sessionId, messages) {
  ensureDir();
  const path = GLib.build_filenamev([DATA_DIR, `${sessionId}.json`]);
  const firstUserMsg = messages.find((m) => m.role === "user");
  const title = firstUserMsg
    ? firstUserMsg.text.slice(0, 40)
    : "Untitled";
  const data = JSON.stringify(
    {
      sessionId,
      title,
      updatedAt: new Date().toISOString(),
      messages,
    },
    null,
    2,
  );
  GLib.file_set_contents(path, data);
}

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

export function getSessionSummaries() {
  ensureDir();
  const dir = Gio.File.new_for_path(DATA_DIR);
  const enumerator = dir.enumerate_children(
    "standard::name,time::modified",
    Gio.FileQueryInfoFlags.NONE,
    null,
  );

  const summaries = [];
  let info;
  while ((info = enumerator.next_file(null))) {
    const name = info.get_name();
    if (!name.endsWith(".json")) continue;

    const sessionId = name.replace(".json", "");
    const path = GLib.build_filenamev([DATA_DIR, name]);

    try {
      const [ok, contents] = GLib.file_get_contents(path);
      if (!ok) continue;
      const data = JSON.parse(new TextDecoder().decode(contents));

      let title = data.title;
      let updatedAt = data.updatedAt;

      if (!title) {
        const firstUser = (data.messages || []).find((m) => m.role === "user");
        title = firstUser ? firstUser.text.slice(0, 40) : "Untitled";
      }
      if (!updatedAt) {
        const mtime = info.get_modification_date_time();
        updatedAt = mtime ? mtime.format_iso8601() : new Date().toISOString();
      }

      summaries.push({ sessionId, title, updatedAt });
    } catch {
      // Skip corrupt files
    }
  }

  summaries.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  return summaries;
}
