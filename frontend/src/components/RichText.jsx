const ALLOWED_TAGS = new Set([
  "img",
  "br",
  "sub",
  "sup",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "u",
]);

/** Decode common HTML entities (incl. double-encoded). */
export function decodeHtmlEntities(input) {
  let s = String(input || "");
  for (let i = 0; i < 3; i += 1) {
    const prev = s;
    s = s
      .replace(/&nbsp;/gi, "\u00a0")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#0*39;/g, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        const code = Number.parseInt(h, 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      })
      .replace(/&amp;/gi, "&");
    if (s === prev) break;
  }
  return s;
}

function normalizeBlockTags(input) {
  return input
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br /><br />")
    .replace(/<p\b[^>]*>/gi, "")
    .replace(/<\/p>/gi, "<br />")
    .replace(/<\/div>\s*<div\b[^>]*>/gi, "<br /><br />")
    .replace(/<div\b[^>]*>/gi, "")
    .replace(/<\/div>/gi, "<br />")
    .replace(/(?:<br\s*\/?\s*>\s*)+$/i, "");
}

/** True when string has HTML we should render (equation imgs, sub/sup, …). */
export function looksLikeRichHtml(value) {
  if (!value) return false;
  return /<\s*(img|br|sub|sup|span|strong|em|b|i|u)\b/i.test(value);
}

/** Map absolute media paths → /pts-media/... */
export function rewriteMediaSrc(src) {
  let s = String(src || "")
    .trim()
    .replace(/\\/g, "/");
  if (!s) return "";

  if (s.startsWith("/pts-media/")) return s;
  if (s.startsWith("/pts-equations/")) {
    return `/pts-media/equations/${s.slice("/pts-equations/".length)}`;
  }
  if (s.startsWith("/Equations/")) {
    return `/pts-media/equations/${s.slice("/Equations/".length)}`;
  }
  if (s.startsWith("/equations/")) {
    return `/pts-media/equations/${s.slice("/equations/".length)}`;
  }
  if (s.startsWith("/Diagrams/")) {
    return `/pts-media/Diagrams/${s.slice("/Diagrams/".length)}`;
  }
  if (s.startsWith("/Images/")) {
    return `/pts-media/Images/${s.slice("/Images/".length)}`;
  }
  if (s.startsWith("/images/")) {
    return `/pts-media/${s.slice("/images/".length)}`;
  }
  return s;
}

/**
 * Keep allowlisted tags + safe attrs. Strip handlers / bad src.
 */
export function sanitizeRichHtml(input) {
  return String(input || "")
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag, attrs = "") => {
      const name = String(tag).toLowerCase();
      const closing = full.startsWith("</");
      if (!ALLOWED_TAGS.has(name)) return "";
      if (closing) return `</${name}>`;
      if (name === "br") return "<br />";

      if (name === "img") {
        const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
        const rawSrc = srcMatch?.[2]?.trim() ?? "";
        const src = rewriteMediaSrc(rawSrc);
        if (!src) return "";
        const ok =
          (src.startsWith("/") && !src.startsWith("//")) ||
          src.startsWith("https://");
        if (!ok) return "";
        const altMatch = attrs.match(/\salt\s*=\s*(["'])([^"']*)\1/i);
        const alt = altMatch?.[2] ?? "";
        /* Drop width/height so CSS can scale equations (esp. on mobile). */
        const styleMatch = attrs.match(/\sstyle\s*=\s*(["'])([^"']*)\1/i);
        let style = "";
        if (styleMatch?.[2]) {
          const cleaned = styleMatch[2]
            .replace(
              /(?:^|;)\s*(?:width|height|max-width|max-height|min-width|min-height)\s*:[^;]*/gi,
              ""
            )
            .replace(/^;+|;+$/g, "")
            .trim();
          if (cleaned) {
            style = ` style="${cleaned.replace(/"/g, "&quot;")}"`;
          }
        }
        return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" class="tg-eq-img"${style} />`;
      }

      return `<${name}>`;
    })
    .replace(/on\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/javascript:/gi, "");
}

export function prepareRichTextValue(value) {
  return normalizeBlockTags(decodeHtmlEntities(String(value || "")));
}

/**
 * Renders bank/paper text with equation images, sub/sup, and safe HTML.
 */
export default function RichText({
  value,
  className = "",
  dir,
  as: Tag = "span",
}) {
  const prepared = prepareRichTextValue(value);
  const useUrduFont = dir === "rtl" || /[\u0600-\u06FF]/.test(prepared);

  if (!looksLikeRichHtml(prepared)) {
    return (
      <Tag
        className={[useUrduFont ? "tg-font-urdu" : "", className]
          .filter(Boolean)
          .join(" ")}
        dir={dir}
      >
        {prepared}
      </Tag>
    );
  }

  const html = sanitizeRichHtml(prepared);
  return (
    <Tag
      className={["tg-rich-text", useUrduFont ? "tg-font-urdu" : "", className]
        .filter(Boolean)
        .join(" ")}
      dir={dir}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
