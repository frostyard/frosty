import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export interface FrostySettings {
  provider: string;
  apiKey: string;
  model?: string;
}

const DEFAULT_SETTINGS: FrostySettings = {
  provider: "anthropic",
  apiKey: "",
};

function settingsPath(): string {
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "frosty",
    "settings.json",
  );
}

export function loadSettings(): FrostySettings {
  try {
    const raw = readFileSync(settingsPath(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: FrostySettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}
