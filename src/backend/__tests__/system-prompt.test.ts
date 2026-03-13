import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt.js";

describe("buildSystemPrompt", () => {
  it("includes Snow Linux identity", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Frosty");
    expect(prompt).toContain("Snow Linux");
    expect(prompt).toContain("atomic");
  });

  it("includes tool selection guidance", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Flatpak");
    expect(prompt).toContain("Homebrew");
    expect(prompt).toContain("updex");
    expect(prompt).toContain("nbc");
  });

  it("includes safety rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("/usr");
    expect(prompt).toContain("read-only");
    expect(prompt).toContain("reboot");
  });

  it("includes available tool names", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("flatpak_list");
    expect(prompt).toContain("shell_exec");
  });
});
