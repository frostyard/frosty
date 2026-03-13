import { describe, it, expect } from "vitest";
import { parseAnsi } from "../ansi-parser.js";

describe("parseAnsi", () => {
  it("returns plain text unchanged", () => {
    const segments = parseAnsi("hello world");
    expect(segments).toEqual([{ text: "hello world", attrs: {} }]);
  });

  it("strips reset sequence", () => {
    const segments = parseAnsi("hello\x1b[0m world");
    expect(segments).toEqual([
      { text: "hello", attrs: {} },
      { text: " world", attrs: {} },
    ]);
  });

  it("parses foreground color", () => {
    const segments = parseAnsi("\x1b[31mred text\x1b[0m");
    expect(segments).toEqual([
      { text: "red text", attrs: { fg: 1 } },
    ]);
  });

  it("parses bright foreground color", () => {
    const segments = parseAnsi("\x1b[91mbright red\x1b[0m");
    expect(segments).toEqual([
      { text: "bright red", attrs: { fg: 9 } },
    ]);
  });

  it("parses background color", () => {
    const segments = parseAnsi("\x1b[42mgreen bg\x1b[0m");
    expect(segments).toEqual([
      { text: "green bg", attrs: { bg: 2 } },
    ]);
  });

  it("parses bold", () => {
    const segments = parseAnsi("\x1b[1mbold\x1b[0m");
    expect(segments).toEqual([
      { text: "bold", attrs: { bold: true } },
    ]);
  });

  it("parses italic", () => {
    const segments = parseAnsi("\x1b[3mitalic\x1b[0m");
    expect(segments).toEqual([
      { text: "italic", attrs: { italic: true } },
    ]);
  });

  it("parses underline", () => {
    const segments = parseAnsi("\x1b[4munderline\x1b[0m");
    expect(segments).toEqual([
      { text: "underline", attrs: { underline: true } },
    ]);
  });

  it("combines multiple attributes", () => {
    const segments = parseAnsi("\x1b[1;31mbold red\x1b[0m");
    expect(segments).toEqual([
      { text: "bold red", attrs: { bold: true, fg: 1 } },
    ]);
  });

  it("gracefully strips 256-color sequences", () => {
    const segments = parseAnsi("\x1b[38;5;196mcolored\x1b[0m");
    expect(segments).toEqual([
      { text: "colored", attrs: {} },
    ]);
  });

  it("gracefully strips truecolor sequences", () => {
    const segments = parseAnsi("\x1b[38;2;255;0;0mcolored\x1b[0m");
    expect(segments).toEqual([
      { text: "colored", attrs: {} },
    ]);
  });

  it("handles text with no trailing reset", () => {
    const segments = parseAnsi("\x1b[32mgreen");
    expect(segments).toEqual([
      { text: "green", attrs: { fg: 2 } },
    ]);
  });

  it("handles empty input", () => {
    const segments = parseAnsi("");
    expect(segments).toEqual([]);
  });

  it("handles consecutive escape sequences", () => {
    const segments = parseAnsi("\x1b[31mred\x1b[32mgreen\x1b[0m");
    expect(segments).toEqual([
      { text: "red", attrs: { fg: 1 } },
      { text: "green", attrs: { fg: 2 } },
    ]);
  });
});
