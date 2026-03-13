import { describe, it, expect } from "vitest";
import { flatpakTools, buildFlatpakCommand } from "../../skills/flatpak.js";

describe("flatpakTools", () => {
  it("defines 6 tools", () => {
    expect(flatpakTools).toHaveLength(6);
  });

  it("classifies list as safe", () => {
    const list = flatpakTools.find((t) => t.name === "flatpak_list");
    expect(list?.risk).toBe("safe");
  });

  it("classifies install as mutating", () => {
    const install = flatpakTools.find((t) => t.name === "flatpak_install");
    expect(install?.risk).toBe("mutating");
  });
});

describe("buildFlatpakCommand", () => {
  it("builds a list command", () => {
    const result = buildFlatpakCommand("flatpak_list", {});
    expect(result.command).toBe("flatpak list --app --columns=application,name,version");
    expect(result.risk).toBe("safe");
  });

  it("builds a search command", () => {
    const result = buildFlatpakCommand("flatpak_search", { query: "firefox" });
    expect(result.command).toBe("flatpak search firefox");
    expect(result.risk).toBe("safe");
  });

  it("builds an install command", () => {
    const result = buildFlatpakCommand("flatpak_install", {
      appId: "org.mozilla.firefox",
    });
    expect(result.command).toBe("flatpak install -y flathub org.mozilla.firefox");
    expect(result.risk).toBe("mutating");
  });

  it("builds an uninstall command", () => {
    const result = buildFlatpakCommand("flatpak_uninstall", {
      appId: "org.mozilla.firefox",
    });
    expect(result.command).toBe("flatpak uninstall -y org.mozilla.firefox");
    expect(result.risk).toBe("mutating");
  });

  it("builds an update command with no args", () => {
    const result = buildFlatpakCommand("flatpak_update", {});
    expect(result.command).toBe("flatpak update -y");
    expect(result.risk).toBe("mutating");
  });

  it("builds an info command", () => {
    const result = buildFlatpakCommand("flatpak_info", {
      appId: "org.mozilla.firefox",
    });
    expect(result.command).toBe("flatpak info org.mozilla.firefox");
    expect(result.risk).toBe("safe");
  });

  it("throws on unknown tool name", () => {
    expect(() => buildFlatpakCommand("unknown", {})).toThrow();
  });
});
