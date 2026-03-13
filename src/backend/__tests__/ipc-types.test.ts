import { describe, it, expect } from "vitest";
import {
  isClientMessage,
  isUserMessage,
  isConfirmMessage,
  type ClientMessage,
  type ServerMessage,
} from "../ipc-types.js";

describe("isClientMessage", () => {
  it("accepts a valid user message", () => {
    const msg = { type: "message", text: "hello", sessionId: "abc" };
    expect(isClientMessage(msg)).toBe(true);
    expect(isUserMessage(msg as ClientMessage)).toBe(true);
  });

  it("accepts a valid confirm message", () => {
    const msg = { type: "confirm", toolCallId: "t1", approved: true };
    expect(isClientMessage(msg)).toBe(true);
    expect(isConfirmMessage(msg as ClientMessage)).toBe(true);
  });

  it("accepts a cancel message", () => {
    const msg = { type: "cancel", toolCallId: "t1" };
    expect(isClientMessage(msg)).toBe(true);
  });

  it("accepts session.new", () => {
    const msg = { type: "session.new" };
    expect(isClientMessage(msg)).toBe(true);
  });

  it("accepts session.load", () => {
    const msg = { type: "session.load", sessionId: "abc" };
    expect(isClientMessage(msg)).toBe(true);
  });

  it("rejects unknown type", () => {
    expect(isClientMessage({ type: "unknown" })).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isClientMessage("hello")).toBe(false);
    expect(isClientMessage(null)).toBe(false);
  });
});
