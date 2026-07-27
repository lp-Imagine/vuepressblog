/**
 * Penn Notes 资讯栏目
 *
 * 参考主流科技/AI 资讯常见切法（业界 · 产品 · 模型 · 开源 · 开发者），
 * 再加本站特色「前端」，避免只盯编码助手导致信息面过窄。
 */
export const NEWS_SECTIONS = [
  "业界",
  "产品",
  "模型",
  "开源",
  "开发者工具",
  "前端",
];

export const NEWS_PILLARS = [
  {
    title: "业界",
    desc: "融资、并购、裁员、监管与市场 —— 主流资讯站的「行业」栏",
  },
  {
    title: "产品",
    desc: "应用与产品发布、功能更新、定价策略",
  },
  {
    title: "模型",
    desc: "新模型、API、评测榜单与能力变化",
  },
  {
    title: "开源",
    desc: "值得关注的仓库、协议与社区项目",
  },
  {
    title: "开发者工具",
    desc: "编码助手、Agent IDE、MCP、CI/协作 —— 写代码的工具链",
  },
  {
    title: "前端",
    desc: "框架、构建、样式、Web 平台与 DX —— 本站笔记强相关",
  },
];

/** 旧栏目名 → 新名（兼容存量 sources / 旧日报） */
export const SECTION_ALIASES = {
  岗位趋势: "业界",
  行业动态: "业界",
  圈内速览: "业界",
  热门项目: "开源",
  开源雷达: "开源",
  产品更新: "产品",
  编码助手: "开发者工具",
  模型发布: "模型",
  模型与接口: "模型",
  "模型与产品": "模型",
  论文研究: "模型",
  前端工程: "前端",
  前端相关: "前端",
};

export function normalizeSection(name) {
  const raw = String(name || "").trim();
  if (NEWS_SECTIONS.includes(raw)) return raw;
  return SECTION_ALIASES[raw] || null;
}

/**
 * @param {string} reportDate
 * @param {Record<string, Array<{title:string, summary:string, sourceName:string, url:string, date:string, image?:string|null}>>} bySection
 */
export function renderDailyMarkdown(reportDate, bySection) {
  const parts = [
    "---",
    `title: AI 动态 · ${reportDate}`,
    `date: ${reportDate}`,
    "outline: [2, 3]",
    "---",
    "",
    `# AI 动态 · ${reportDate}`,
    "",
    `> 截至 ${reportDate}。业界 · 产品 · 模型 · 开源 · 开发者工具 · 前端。`,
    "",
  ];

  for (const name of NEWS_SECTIONS) {
    const items = bySection[name] || [];
    parts.push(`## ${name}`, "");
    if (!items.length) {
      parts.push("（本日无新条目）", "");
      continue;
    }
    for (const item of items) {
      const date = item.date || reportDate;
      const title = escapeMdHeading(item.title);
      parts.push(`### ${title}`, "");
      parts.push(
        `<p class="news-entry-meta"><time datetime="${date}">${date}</time></p>`,
        "",
      );
      if (item.image) {
        parts.push(`![配图](${item.image})`, "");
      }
      parts.push(String(item.summary || "").trim(), "");
      parts.push(
        `**来源：** [${escapeMd(item.sourceName)}](${item.url})`,
        "",
      );
    }
  }

  return `${parts.join("\n").trimEnd()}\n`;
}

function escapeMdHeading(s) {
  return String(s || "")
    .replace(/\r?\n/g, " ")
    .replace(/#/g, "")
    .trim();
}

function escapeMd(s) {
  return String(s || "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

export function shanghaiDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function shanghaiYesterday(base = new Date()) {
  return shanghaiDate(new Date(base.getTime() - 24 * 60 * 60 * 1000));
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function dateWindow(targetDate, lookbackDays = 3) {
  const [y, m, d] = targetDate.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d));
  const set = new Set();
  for (let i = 0; i < lookbackDays; i++) {
    const cur = new Date(end.getTime() - i * 864e5);
    set.add(cur.toISOString().slice(0, 10));
  }
  return set;
}
