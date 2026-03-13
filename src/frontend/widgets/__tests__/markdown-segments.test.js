import { describe, it, expect } from "vitest";
import { parseSegments } from "../markdown.js";

describe("parseSegments", () => {
  it("returns a single text segment for plain text", () => {
    const segments = parseSegments("Hello world");
    expect(segments).toEqual([{ type: "text", content: "Hello world" }]);
  });

  it("extracts a code block with language", () => {
    const input = "Before\n```bash\necho hello\n```\nAfter";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "text", content: "Before" },
      { type: "code", language: "bash", content: "echo hello" },
      { type: "text", content: "After" },
    ]);
  });

  it("extracts a code block without language", () => {
    const input = "Before\n```\nsome code\n```\nAfter";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "text", content: "Before" },
      { type: "code", language: "", content: "some code" },
      { type: "text", content: "After" },
    ]);
  });

  it("handles multiple code blocks", () => {
    const input = "A\n```js\nconst x = 1;\n```\nB\n```py\nprint('hi')\n```\nC";
    const segments = parseSegments(input);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toEqual({ type: "text", content: "A" });
    expect(segments[1]).toEqual({ type: "code", language: "js", content: "const x = 1;" });
    expect(segments[2]).toEqual({ type: "text", content: "B" });
    expect(segments[3]).toEqual({ type: "code", language: "py", content: "print('hi')" });
    expect(segments[4]).toEqual({ type: "text", content: "C" });
  });

  it("handles code block at the start", () => {
    const input = "```json\n{}\n```\nAfter";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "code", language: "json", content: "{}" },
      { type: "text", content: "After" },
    ]);
  });

  it("handles code block at the end", () => {
    const input = "Before\n```yaml\nkey: val\n```";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "text", content: "Before" },
      { type: "code", language: "yaml", content: "key: val" },
    ]);
  });

  it("omits empty text segments", () => {
    const input = "```bash\necho hi\n```";
    const segments = parseSegments(input);
    expect(segments).toEqual([
      { type: "code", language: "bash", content: "echo hi" },
    ]);
  });

  it("preserves multiline code block content", () => {
    const input = "```sh\nline1\nline2\nline3\n```";
    const segments = parseSegments(input);
    expect(segments[0].content).toBe("line1\nline2\nline3");
  });
});
