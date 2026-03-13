import { describe, it, expect } from "vitest";
import { ConfirmationManager } from "../confirmations.js";

describe("ConfirmationManager", () => {
  it("resolves a pending confirmation with true", async () => {
    const mgr = new ConfirmationManager();
    const promise = mgr.waitForConfirmation("t1");
    mgr.resolve("t1", true);
    expect(await promise).toBe(true);
  });

  it("resolves a pending confirmation with false", async () => {
    const mgr = new ConfirmationManager();
    const promise = mgr.waitForConfirmation("t1");
    mgr.resolve("t1", false);
    expect(await promise).toBe(false);
  });

  it("ignores resolve for unknown toolCallId", () => {
    const mgr = new ConfirmationManager();
    // Should not throw
    mgr.resolve("unknown", true);
  });

  it("cleans up after resolution", async () => {
    const mgr = new ConfirmationManager();
    const promise = mgr.waitForConfirmation("t1");
    mgr.resolve("t1", true);
    await promise;
    // Resolving again should be a no-op
    mgr.resolve("t1", false);
  });
});
