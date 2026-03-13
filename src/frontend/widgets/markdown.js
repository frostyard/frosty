/**
 * Convert a subset of Markdown to Pango markup for GTK labels.
 *
 * Supports: bold, italic, inline code, code blocks, headers, lists, links.
 *
 * @param {string} text - Markdown text
 * @returns {string} Pango markup string
 */
export function markdownToPango(text) {
  // Escape XML entities first (must happen before we insert markup tags)
  let out = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```lang\n...\n``` → monospace block
  out = out.replace(/```[^\n]*\n([\s\S]*?)```/g, (_match, code) => {
    return `\n<tt>${code.trimEnd()}</tt>\n`;
  });

  // Tables: detect consecutive lines starting with |
  out = out.replace(/((?:^\|.+\|$\n?){2,})/gm, (_match, tableBlock) => {
    return _renderTable(tableBlock);
  });

  // Inline code: `...` → <tt>
  out = out.replace(/`([^`\n]+)`/g, "<tt>$1</tt>");

  // Headers: # ... → bold + scaled
  out = out.replace(/^### (.+)$/gm, "\n<b>$1</b>");
  out = out.replace(/^## (.+)$/gm, "\n<b><big>$1</big></b>");
  out = out.replace(/^# (.+)$/gm, "\n<b><big><big>$1</big></big></b>");

  // Bold + italic: ***text*** or ___text___
  out = out.replace(/\*{3}(.+?)\*{3}/g, "<b><i>$1</i></b>");
  out = out.replace(/_{3}(.+?)_{3}/g, "<b><i>$1</i></b>");

  // Bold: **text** or __text__
  out = out.replace(/\*{2}(.+?)\*{2}/g, "<b>$1</b>");
  out = out.replace(/_{2}(.+?)_{2}/g, "<b>$1</b>");

  // Italic: *text* or _text_ (but not inside words for _)
  out = out.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "<i>$1</i>");
  out = out.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "<i>$1</i>");

  // Unordered lists: - item or * item → bullet
  out = out.replace(/^[\-\*] (.+)$/gm, "  \u2022 $1");

  // Ordered lists: 1. item → keep number with indent
  out = out.replace(/^(\d+)\. (.+)$/gm, "  $1. $2");

  // Links: [text](url) → just show text (Pango <a> needs GTK support)
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "<u>$1</u>");

  // Horizontal rules
  out = out.replace(/^---+$/gm, "────────────────────");

  // Clean up excessive blank lines
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

/**
 * Render a markdown table as aligned monospace text.
 * @param {string} block - The raw table lines (already XML-escaped)
 * @returns {string} Pango markup monospace table
 */
function _renderTable(block) {
  const lines = block.trim().split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return block;

  // Parse rows into cells
  const rows = [];
  for (const line of lines) {
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    // Skip separator rows (|---|---|)
    if (cells.every((c) => /^[-:]+$/.test(c))) continue;
    rows.push(cells);
  }

  if (rows.length === 0) return block;

  // Calculate column widths
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths = new Array(colCount).fill(0);
  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] || "";
      widths[i] = Math.max(widths[i], cell.length);
    }
  }

  // Render as aligned monospace text
  const rendered = rows.map((row, rowIdx) => {
    const padded = [];
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] || "";
      padded.push(cell.padEnd(widths[i]));
    }
    let line = padded.join("  ");
    // Bold the header row
    if (rowIdx === 0) line = `<b>${line}</b>`;
    return line;
  });

  // Add a separator after the header
  const sep = widths.map((w) => "─".repeat(w)).join("──");
  rendered.splice(1, 0, sep);

  return `\n<tt>${rendered.join("\n")}</tt>\n`;
}
