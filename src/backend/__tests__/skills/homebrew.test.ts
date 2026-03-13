import { describe, it, expect } from "vitest";
import { brewTools, buildBrewCommand } from "../../skills/homebrew.js";

describe("brewTools", () => {
  it("defines 9 tools", () => {
    expect(brewTools).toHaveLength(9);
  });

  it("classifies list as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_list");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies search as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_search");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies info as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_info");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies install as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_install");
    expect(tool?.risk).toBe("mutating");
  });

  it("classifies uninstall as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_uninstall");
    expect(tool?.risk).toBe("mutating");
  });

  it("classifies update as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_update");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies upgrade as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_upgrade");
    expect(tool?.risk).toBe("mutating");
  });

  it("classifies doctor as safe", () => {
    const tool = brewTools.find((t) => t.name === "brew_doctor");
    expect(tool?.risk).toBe("safe");
  });

  it("classifies cleanup as mutating", () => {
    const tool = brewTools.find((t) => t.name === "brew_cleanup");
    expect(tool?.risk).toBe("mutating");
  });
});

describe("buildBrewCommand", () => {
  it("builds a list command", () => {
    const result = buildBrewCommand("brew_list", {});
    expect(result.command).toBe("brew list");
    expect(result.risk).toBe("safe");
  });

  it("builds a search command", () => {
    const result = buildBrewCommand("brew_search", { query: "git" });
    expect(result.command).toBe("brew search 'git'");
    expect(result.risk).toBe("safe");
  });

  it("escapes single quotes in search query", () => {
    const result = buildBrewCommand("brew_search", { query: "it's" });
    expect(result.command).toBe("brew search 'it'\\''s'");
  });

  it("builds an info command", () => {
    const result = buildBrewCommand("brew_info", { name: "git" });
    expect(result.command).toBe("brew info 'git'");
    expect(result.risk).toBe("safe");
  });

  it("builds an install command", () => {
    const result = buildBrewCommand("brew_install", { name: "git" });
    expect(result.command).toBe("brew install 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds an uninstall command", () => {
    const result = buildBrewCommand("brew_uninstall", { name: "git" });
    expect(result.command).toBe("brew uninstall 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds an update command", () => {
    const result = buildBrewCommand("brew_update", {});
    expect(result.command).toBe("brew update");
    expect(result.risk).toBe("safe");
  });

  it("builds an upgrade command with no args", () => {
    const result = buildBrewCommand("brew_upgrade", {});
    expect(result.command).toBe("brew upgrade");
    expect(result.risk).toBe("mutating");
  });

  it("builds an upgrade command for a specific formula", () => {
    const result = buildBrewCommand("brew_upgrade", { formula: "git" });
    expect(result.command).toBe("brew upgrade 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds an upgrade command with --greedy", () => {
    const result = buildBrewCommand("brew_upgrade", { greedy: true });
    expect(result.command).toBe("brew upgrade --greedy");
    expect(result.risk).toBe("mutating");
  });

  it("builds an upgrade command with formula and --greedy", () => {
    const result = buildBrewCommand("brew_upgrade", { formula: "git", greedy: true });
    expect(result.command).toBe("brew upgrade --greedy 'git'");
    expect(result.risk).toBe("mutating");
  });

  it("builds a doctor command", () => {
    const result = buildBrewCommand("brew_doctor", {});
    expect(result.command).toBe("brew doctor");
    expect(result.risk).toBe("safe");
  });

  it("builds a cleanup command", () => {
    const result = buildBrewCommand("brew_cleanup", {});
    expect(result.command).toBe("brew cleanup");
    expect(result.risk).toBe("mutating");
  });

  it("throws on unknown tool name", () => {
    expect(() => buildBrewCommand("unknown", {})).toThrow();
  });
});
