import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSettings, saveSettings } from "../settings.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("settings", () => {
  let originalEnv: string | undefined;
  let tempDir: string;

  beforeEach(() => {
    originalEnv = process.env.XDG_CONFIG_HOME;
    tempDir = mkdtempSync(join(tmpdir(), "frosty-test-"));
    process.env.XDG_CONFIG_HOME = tempDir;
  });

  afterEach(() => {
    process.env.XDG_CONFIG_HOME = originalEnv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when no settings file exists", () => {
    const settings = loadSettings();
    expect(settings.provider).toBe("anthropic");
    expect(settings.apiKey).toBe("");
  });

  it("round-trips save and load", () => {
    saveSettings({ provider: "openai", apiKey: "sk-test", model: "gpt-4o" });
    const loaded = loadSettings();
    expect(loaded.provider).toBe("openai");
    expect(loaded.apiKey).toBe("sk-test");
    expect(loaded.model).toBe("gpt-4o");
  });

  it("merges with defaults on partial file", () => {
    saveSettings({ provider: "openrouter", apiKey: "", model: undefined });
    const loaded = loadSettings();
    expect(loaded.provider).toBe("openrouter");
    expect(loaded.apiKey).toBe("");
  });
});
