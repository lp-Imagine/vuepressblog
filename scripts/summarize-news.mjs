/**
 * Editorial Chinese briefing for Penn Notes.
 * Categories cover mainstream AI/tech news + site specialties.
 */
import { NEWS_SECTIONS, normalizeSection } from "./news/sections.mjs";
import { fetch } from "./news/http.mjs";

const LLM_BASE_URL = (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(
  /\/$/,
  "",
);
const LLM_MODEL = process.env.LLM_MODEL || "deepseek-chat";
const LLM_API_KEY = process.env.LLM_API_KEY || "";

/**
 * @param {Array<{title:string,url:string,sourceName:string,section:string,date:string,snippet:string,excerpt?:string}>} items
 * @param {string} reportDate
 * @param {{ allowHeuristic?: boolean }} [opts]
 */
export async function summarizeNews(items, reportDate, opts = {}) {
  const empty = Object.fromEntries(NEWS_SECTIONS.map((s) => [s, []]));
  if (!items.length) return empty;

  if (!LLM_API_KEY) {
    if (!opts.allowHeuristic) {
      throw new Error(
        "LLM_API_KEY is required. Set the secret or pass --allow-heuristic (low quality).",
      );
    }
    console.warn("[summarize] LLM_API_KEY missing — heuristic fallback (low quality)");
    return heuristicSummarize(items);
  }

  const capped = items.slice(0, 80);
  // 候选多时自动压缩 excerpt，避免 prompt 超长；总量控制在 ~120K 字符内。
  const excerptBudget = Math.max(300, Math.floor(120000 / capped.length) - 900);
  const payload = capped.map((it, i) => ({
    id: i,
    title: it.title,
    source: it.sourceName,
    sectionHint: normalizeSection(it.section) || it.section,
    date: it.date,
    snippet: it.snippet,
    excerpt: (it.excerpt || "").slice(0, excerptBudget),
  }));

  const system = `你是「Penn Notes」资讯编辑：个人前端站的每日精选，栏目参考主流科技/AI 资讯，同时保留本站特色。

栏目（只能用这些，覆盖要够广，不要因为「不够前端」就丢掉好新闻）：
- 业界：融资、并购、裁员、监管、市场格局
- 产品：应用/产品发布、功能更新、定价与商业化
- 模型：新模型、API、评测、能力与成本变化
- 开源：仓库、协议、社区项目（含 MCP / Agent 相关开源）
- 开发者工具：编码助手、IDE、Agent 平台、协作与工程工具链
- 前端：JS/TS、框架、构建、样式、Web 平台与 DX

硬性规则：
1. 每条必须带正确 id；该 id 的标题/摘录是唯一事实来源，禁止张冠李戴。
2. 中文标题可润色，须保留核心实体。
3. summary：1 段 70–160 字；结尾「对读者：」给一句实用启示（选型/风险/可跟进动作）。
4. 信息面优先：有价值的业界/产品/模型新闻都要收；本站特色（开发者工具、前端）有则加分，无则不强行塞。
5. 去重、去纯广告；每栏 0–4 条；全文最多 14 条；空栏可以。
6. 只输出 JSON：{"items":[{"id":0,"section":"业界","title":"...","summary":"...","date":"YYYY-MM-DD"}]}
7. 不要输出 url、source、markdown 代码块。`;

  const user = `报告日期：${reportDate}
候选素材（按 id 绑定，勿混淆）：
${JSON.stringify(payload, null, 2)}`;

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const parsed = parseJson(content);
  const list = Array.isArray(parsed?.items) ? parsed.items : [];

  const usedIds = new Set();
  const bySection = Object.fromEntries(NEWS_SECTIONS.map((s) => [s, []]));

  for (const row of list) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || id < 0 || id >= capped.length) continue;
    if (usedIds.has(id)) continue;

    const section = normalizeSection(row.section);
    if (!section) continue;
    if (bySection[section].length >= 4) continue;

    const src = capped[id];
    const summary = String(row.summary || "").trim();
    const title = String(row.title || src.title).trim();
    if (summary.length < 40) continue;

    if (!passesBindingCheck(src, title, summary)) {
      console.warn(
        `[summarize] drop id=${id} (binding mismatch): ${src.title.slice(0, 60)}`,
      );
      continue;
    }

    usedIds.add(id);
    bySection[section].push({
      title,
      summary,
      sourceName: src.sourceName,
      url: src.url,
      date: String(row.date || src.date || reportDate).slice(0, 10),
      image: null,
    });
  }

  const total = NEWS_SECTIONS.reduce((n, s) => n + bySection[s].length, 0);
  if (total === 0) {
    throw new Error("LLM returned no usable items — check model output / candidates");
  }
  return bySection;
}

function passesBindingCheck(src, title, summary) {
  const blob = `${title}\n${summary}`.toLowerCase();
  const srcTitle = String(src.title || "").toLowerCase();
  const isRepo = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(src.title.trim());

  if (isRepo) {
    const repo = src.title.trim().toLowerCase();
    const short = repo.split("/")[1] || repo;
    if (!blob.includes(repo) && !blob.includes(short)) return false;
    return true;
  }

  const tokens = srcTitle
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4)
    .slice(0, 8);

  if (!tokens.length) return true;
  return tokens.filter((t) => blob.includes(t)).length >= 1;
}

function heuristicSummarize(items) {
  const bySection = Object.fromEntries(NEWS_SECTIONS.map((s) => [s, []]));
  for (const it of items) {
    const section = normalizeSection(it.section) || "业界";
    if (bySection[section].length >= 4) continue;
    bySection[section].push({
      title: it.title,
      summary: `${it.snippet || it.excerpt || "详见原文。"}\n\n对读者：待大模型补全启示。`,
      sourceName: it.sourceName,
      url: it.url,
      date: it.date,
      image: null,
    });
  }
  return bySection;
}

function parseJson(text) {
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
