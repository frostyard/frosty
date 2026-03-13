/**
 * Parse a string containing ANSI SGR escape sequences into styled segments.
 *
 * Each segment has { text, attrs } where attrs may contain:
 *   fg: number (0-7 standard, 8-15 bright)
 *   bg: number (0-7 standard, 8-15 bright)
 *   bold: boolean
 *   dim: boolean
 *   italic: boolean
 *   underline: boolean
 *
 * 256-color and truecolor sequences are stripped (attrs remain unchanged).
 * Non-SGR sequences (cursor movement etc.) are stripped.
 *
 * @param {string} input
 * @returns {Array<{text: string, attrs: Record<string, unknown>}>}
 */
export function parseAnsi(input) {
  if (!input) return [];

  const segments = [];
  let attrs = {};

  const regex = /\x1b\[([0-9;]*)([A-Za-z])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) segments.push({ text, attrs: { ...attrs } });
    }
    lastIndex = regex.lastIndex;

    const finalChar = match[2];
    if (finalChar !== "m") continue;

    const paramStr = match[1];
    const params = paramStr === "" ? [0] : paramStr.split(";").map(Number);

    let i = 0;
    while (i < params.length) {
      const p = params[i];
      if (p === 0) {
        attrs = {};
      } else if (p === 1) {
        attrs = { ...attrs, bold: true };
      } else if (p === 2) {
        attrs = { ...attrs, dim: true };
      } else if (p === 3) {
        attrs = { ...attrs, italic: true };
      } else if (p === 4) {
        attrs = { ...attrs, underline: true };
      } else if (p >= 30 && p <= 37) {
        attrs = { ...attrs, fg: p - 30 };
      } else if (p >= 40 && p <= 47) {
        attrs = { ...attrs, bg: p - 40 };
      } else if (p >= 90 && p <= 97) {
        attrs = { ...attrs, fg: p - 90 + 8 };
      } else if (p >= 100 && p <= 107) {
        attrs = { ...attrs, bg: p - 100 + 8 };
      } else if (p === 38 || p === 48) {
        if (i + 1 < params.length && params[i + 1] === 5) {
          i += 2;
        } else if (i + 1 < params.length && params[i + 1] === 2) {
          i += 4;
        }
      }
      i++;
    }
  }

  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text) segments.push({ text, attrs: { ...attrs } });
  }

  return segments;
}
