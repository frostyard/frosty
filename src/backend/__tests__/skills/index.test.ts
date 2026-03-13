import { describe, it, expect } from "vitest";
import { getAllTools, buildCommand } from "../../skills/index.js";

describe("getAllTools", () => {
  it("returns all tool definitions from all skills", () => {
    const tools = getAllTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("flatpak_list");
    expect(names).toContain("flatpak_install");
    expect(names).toContain("shell_exec");
    expect(names).toContain("brew_list");
    expect(names).toContain("brew_install");
    expect(names).toContain("brew_upgrade");
    expect(tools.length).toBe(16); // 6 flatpak + 1 shell + 9 brew
  });
});

describe("buildCommand", () => {
  it("delegates to flatpak skill", () => {
    const result = buildCommand("flatpak_list", {});
    expect(result.command).toContain("flatpak list");
  });

  it("delegates to shell skill", () => {
    const result = buildCommand("shell_exec", { command: "whoami" });
    expect(result.command).toBe("whoami");
  });

  it("delegates to brew skill", () => {
    const result = buildCommand("brew_list", {});
    expect(result.command).toBe("brew list");
  });

  it("throws on unknown tool", () => {
    expect(() => buildCommand("unknown_tool", {})).toThrow();
  });
});
