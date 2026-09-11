/**
 * Cleans HTML pasted from Word, Excel or a web page so the editor keeps the
 * structure (tables, rows, merged cells, emphasis, alignment) while dropping
 * the foreign styling that would break the page layout.
 */

const KEEP_STYLE = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "vertical-align",
  "color",
  "background-color",
  "width",
]);

const KEEP_ATTR = new Set([
  "colspan",
  "rowspan",
  "colwidth",
  "align",
  "valign",
  "src",
  "alt",
  "href",
  "width",
  "height",
]);

const DROP_TAGS = ["style", "script", "meta", "link", "xml", "o:p", "v:shapetype", "v:shape", "w:sdt"];

function cleanStyle(value: string) {
  const kept: string[] = [];
  for (const part of value.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!val || prop.startsWith("mso-") || !KEEP_STYLE.has(prop)) continue;
    if (prop === "color" && /window\s*text|inherit/i.test(val)) continue;
    if (prop === "background-color" && /transparent|window|white|#fff(fff)?$/i.test(val)) continue;
    kept.push(`${prop}: ${val}`);
  }
  return kept.join("; ");
}

export function cleanPastedHtml(html: string): string {
  if (!html || typeof window === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Comments (Word wraps fragments in them) and unwanted elements.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  comments.forEach((c) => c.remove());
  doc.querySelectorAll(DROP_TAGS.join(",")).forEach((el) => el.remove());

  doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
    // Word emits empty <p class=MsoNormal><o:p>&nbsp;</o:p></p> spacers.
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name === "style") {
        const cleaned = cleanStyle(attr.value);
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
        continue;
      }
      if (!KEEP_ATTR.has(name)) el.removeAttribute(name);
    }
  });

  // Excel/Word wrap sheets in nested tables used purely for layout borders —
  // unwrap a single-cell table that only contains another table.
  doc.querySelectorAll("table").forEach((table) => {
    const cells = table.querySelectorAll("td, th");
    if (cells.length === 1 && cells[0]?.querySelector("table")) {
      table.replaceWith(...Array.from(cells[0]!.childNodes));
    }
  });

  return doc.body.innerHTML;
}
