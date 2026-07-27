/**
 * Parse daily digest markdown into flat news items (for index / filter UI).
 */
import { NEWS_SECTIONS } from "./sections.mjs";

export function parseDigestMarkdown(content, digestMeta = {}) {
  const { date = "", month = "", slug = "", link = "" } = digestMeta;
  const items = [];
  if (!content) return items;

  const body = content.replace(/^---[\s\S]*?---\n*/, "");
  const sectionBlocks = body.split(/\n(?=## )/).slice(1);

  for (const block of sectionBlocks) {
    const sectionMatch = block.match(/^## ([^\n]+)/);
    const section = (sectionMatch?.[1] || "").trim();
    if (!NEWS_SECTIONS.includes(section)) continue;

    const entryBlocks = block.split(/\n(?=### )/).slice(1);
    for (const entry of entryBlocks) {
      const titleMatch = entry.match(/^### ([^\n]+)/);
      const title = (titleMatch?.[1] || "").trim();
      if (!title || title.startsWith("（")) continue;

      const sourceMatch =
        entry.match(/<span class="news-source-tag">([^<]+)<\/span>/) ||
        entry.match(/\*\*来源：\*\* \[([^\]]+)\]\(([^)]+)\)/);
      const sourceUrlMatch = entry.match(
        /<p class="news-entry-source">[\s\S]*?href="([^"]+)"/,
      );
      const imageMatch = entry.match(/!\[[^\]]*\]\(([^)]+)\)/);
      const dateMatch = entry.match(/datetime="(\d{4}-\d{2}-\d{2})"/);
      const summaryMatch =
        entry.match(
          /!\[[^\]]*\]\([^)]+\)\n\n([\s\S]*?)\n\n<p class="news-entry-source">/,
        ) ||
        entry.match(
          /<\/p>\n\n([\s\S]*?)\n\n<p class="news-entry-source">/,
        ) ||
        entry.match(/\*\*来源：\*\*[\s\S]*$/m);

      let summary = "";
      if (summaryMatch?.[1]) {
        summary = summaryMatch[1]
          .replace(/\*\*来源：\*\*.+$/m, "")
          .trim()
          .slice(0, 280);
      }

      items.push({
        title,
        section,
        sourceName: sourceMatch?.[1]?.trim() || "",
        sourceUrl: sourceUrlMatch?.[1]?.trim() || sourceMatch?.[2]?.trim() || "",
        image: imageMatch?.[1] || "",
        summary,
        itemDate: dateMatch?.[1] || date,
        digestDate: date,
        digestSlug: slug,
        digestLink: link || (month && slug ? `/news/${month}/${slug}` : ""),
      });
    }
  }

  return items;
}
