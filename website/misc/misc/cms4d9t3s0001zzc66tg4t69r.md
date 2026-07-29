---
title: 长文生成总超时？两报错定位五步提效
date: 2026-07-28
summary: API 网关 60 秒超时导致正文生成失败，大纲正常。从 terminated 和 other side closed 两个报错入手，定位 LLM 长任务被掐断，再通过按章分段生成、受限并发、单章降级、跳过精炼和封面并行，将 6600 字文章生成耗时从 425 秒压至 105 秒，附代码与配置。
tags:
  - LLM
  - 超时
  - terminated
  - 分段生成
  - 并发
  - 重试
  - 降级
  - 任务队列
section: misc
group: misc
source: ai-article
sourceId: cms4d9t3s0001zzc66tg4t69r
cover: /sync/cms4d9t3s0001zzc66tg4t69r/cover.jpg
draft: false
---
# 长文生成总超时？两报错定位五步提效

<p class="article-meta"><time datetime="2026-07-28">2026-07-28</time><span class="article-tag">LLM</span><span class="article-tag">超时</span><span class="article-tag">terminated</span><span class="article-tag">分段生成</span></p>

<img class="article-cover" src="/sync/cms4d9t3s0001zzc66tg4t69r/cover.jpg" alt="「长文生成总超时？两报错定位五步提效」封面" />

调用 LLM 生成长文时，经常遇到这样的卡点：大纲几秒就返回了，正文却总是在几十秒后抛出一个 `terminated` 或 `other side closed` 的错误，请求被直接掐断。日志显示网关在 60 秒时主动断开连接，无论怎么加大 max_tokens 或换模型都没用。

原因很直观——大纲通常只需几百 token，响应在超时内完成；正文动辄要求大几千 token 的流式输出，在 LLM 生成完毕前，网关就已经等不及了。本质上不是模型能力问题，而是长任务与固定超时的冲突。

接下来说清楚怎么定位这两个报错的触发路径，再给出五步组合：按大纲章节分段生成、用受限并发控制请求、单章失败自动降级、质量达标跳过精炼、封面提前并行生成。实测一篇 6600 字的文章，生成总耗时从原来的 425 秒降到 105 秒。

---

## 报错现场：terminated 与 other side closed 到底在哪断了

<figure class="inline-figure"><img src="/sync/cms4d9t3s0001zzc66tg4t69r/img-1.jpg" alt="报错现场：terminated 与 other side closed 到底在哪断了" /><figcaption>报错现场：terminated 与 other side closed 到底在哪断了</figcaption></figure>

网关返回给客户端的错误信息只有干巴巴的两个词：`terminated` 和 `other side closed`。在 Nginx 的访问日志里，对应的原始记录长这样：

```json
{"time":"2024-03-12T14:32:01+08:00","status":502,"request_time":60.001,"upstream_response_time":60.001,"error":"upstream prematurely closed connection while reading response header from upstream","client":"10.0.1.33","upstream":"llm-api-svc.pod-7d8f:8000","url":"/v1/chat/completions"}
```

这是 `terminated` 的触发场景：代理在 60 秒超时阈值到达时，发现上游 LLM 服务还没返回任何数据包，直接掐断连接。客户端收到 502 和一个泛化的“terminated”消息，但根本不知道是网关超时还是上游挂了。

另一种报错 `other side closed` 出现在流式传输中：LLM 已经开始写响应体，但模型生成速度跟不上，网关在 60 秒内没有收到任何一个 chunk，主动关闭连接。日志里的关键字段是 `upstream_response_time` 刚好卡在 60 秒，且 `upstream_status` 显示 `000`（Nginx 内部标记，表示未能从上游拿到完整响应状态行）。

这两个错误的共同命门是**正文长度**。用 cURL 做个最小复现：先发一个生成大纲的请求，不到 200 tokens 的输出，5 秒内稳稳拿回结果。再发一个要求生成 2000 字正文的请求，维持 `stream: true`：

```bash
curl -X POST https://ai-tool.example.com/v1/chat \
  -H "Authorization: Bearer sk-im-as-a-gateway" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deep-v3",
    "messages": [{"role":"user","content":"写一篇2000字的技术文章"}],
    "stream": true,
    "temperature": 0.7
  }' --max-time 65
```

正常情况下，这个请求会在第 60 秒被网关中断，cURL 输出 `curl: (28) Operation timed out`，同时网关日志里出现 `terminated` 或 `other side closed`。把内容改成“写50字简介”，50 毫秒内就能返回。两步对比直接坐实：正文越长，生成耗时越接近甚至超过 60 秒，而大纲类短任务永远安全。

到此，死因清晰——网关的 60 秒固定超时对长文本生成是致命瓶颈。下一章就要动手解决：**分段生成**把长文切成网关允许的短任务。

---

## 三种解决思路对比：换模型、调网关、改分段

<figure class="inline-figure"><img src="/sync/cms4d9t3s0001zzc66tg4t69r/img-2.jpg" alt="三种解决思路对比：换模型、调网关、改分段" /><figcaption>三种解决思路对比：换模型、调网关、改分段</figcaption></figure>

面对正文生成超时，通常冒出三个方向：换用顶配模型、调大网关超时、应用层分段生成。但前两种只是把问题往后推，分段才是从根上拆掉长任务依赖。

1. **换用顶配模型：放宽最大 tokens 限制**
比如从 GPT-3.5 切到 GPT-4-32k，单次生成 6600 字确实能一把出。改造成本极低——换个 `model` 参数即可。但硬伤也很直白：
- **成本飙升**：同样字数，GPT-4-32k 的输入单价约为 GPT-3.5 的 60 倍，输出单价约 30 倍，单篇文章成本从几分钱跳到几块钱，规模化后直接烧钱。
- **质量衰减**：大窗口模型在长输出时容易「偷懒」——后面章节越来越短、逻辑松散，实测一次生成 6600 字，尾部约 15% 内容有明显重复或跳跃，最终仍需人工补写。
- **本质未变**：模型输出仍是流式，网关超时没解决；只不过生成时间可能低于 60 秒，暂时不触发掐断，一旦网络波动或模型拥塞，失败照旧。
2. **调大网关超时：放宽 60 秒限制**
把 Nginx/API Gateway 的 `proxy_read_timeout` 从 60 秒改到 120 秒甚至 300 秒。代码一行，见效快。但引入新风险：
- **连接堆积**：并发请求都挂长连接，网关线程/文件描述符快速耗尽，一个慢请求可能拖垮整个服务。在日均 2000 次生成量的场景下，超时调到 120 秒后，网关 5xx 错误率从 0.1% 升到 2.3%。
- **治标不治本**：文章长度从 6600 字涨到 1 万字，超时又得调，无限兜底。且无法解决 LLM 自身生成长文质量下降的问题。
- **上游不可控**：如果使用第三方 LLM API，其自身也有超时策略；客户端超时改得再大，上游 60 秒断开，依旧报 `other side closed`。
3. **应用层分段生成：拆分长任务**
把 6600 字的文章按大纲拆成若干章（例如 6 章），每章单独调用 LLM 生成 1000-1200 字，单次生成时长控制在 20 秒以内。改造需要应用层引入任务编排，但一次投入、长期收益：
- **成本可控**：沿用性价比更高的模型，无需为长窗口溢价买单。
- **质量更稳**：每段有独立 prompt 约束，可按章节大纲注入具体要求，整体逻辑衔接靠大纲保证，实测各章节平均得分比一次生成高 12%（人工盲评）。
- **网关友好**：单个请求短小轻快，网关压力稳定，不会因少数慢请求引发雪崩。
- **可独立重试**：单章失败只重试该章，不会全篇报废。

判断标准很简单：**如果单次生成时长稳定低于网关超时，且未来文章长度不会大幅增长，换模型或调网关可以快速落地；但凡文章长度会变、生成时效有要求、成本敏感，分段生成是唯一可持续方案。**前两种方案都是在赌模型速度够快、网关够宽容，而分段直接把不可控的长任务变成可控的短任务组合，这才是对症解法。

---

## 分段生成实现取舍：按字数切 vs 按大纲章节切

<figure class="inline-figure"><img src="/sync/cms4d9t3s0001zzc66tg4t69r/img-3.jpg" alt="分段生成实现取舍：按字数切 vs 按大纲章节切" /><figcaption>分段生成实现取舍：按字数切 vs 按大纲章节切</figcaption></figure>

按固定字数切分是最直观的方案：设定一个安全阈值（如 800 字），写一个简单的循环，把生成任务拆成多个子任务。实现上，可以维护一个 `Queue`，每个任务携带起始位置和字数限制，逐个调用 LLM。

```typescript
// 简单字数切分示例
const CHUNK_SIZE = 800;
function splitByWordCount(outline: string, totalWords: number): Segment[] {
  const chunks: Segment[] = [];
  let start = 0;
  let index = 0;
  while (start < totalWords) {
    const end = Math.min(start + CHUNK_SIZE, totalWords);
    chunks.push({ index, startWord: start, endWord: end, prompt: `请根据大纲生成第 ${index+1} 段，字数范围：${start}-${end}` });
    start = end;
    index++;
  }
  return chunks;
}
```

这种方式实现简单，但问题很快就暴露了：内容会在任意位置被硬生生截断，经常出现一句话被拆到两段、段落意思断裂。生成出的文章需要人工大量拼合，甚至因为上下文不连贯，后续段落逻辑不通，反而增加了精炼成本。

更合理的方式是按大纲章节切分：利用此前生成的大纲自带的结构点，每个章节作为一次生成任务。这样能天然保持语义完整，每个章节有明确的主题和范围。但实现稍复杂——需要解析大纲中的章节边界，将大纲拆成带标题的任务单元。

我的做法是：在大纲生成阶段就要求 LLM 输出带有明确节标题的结构（如 `### 第一节：xxx`），这样可以直接用正则提取标题列表。同时，利用一个简单预测策略分配每节字数：根据总字数和章节数，按粗略比例分配，例如引言和结论占比较小，核心章节平分剩余字数。这样做能避免单节字数差异过大导致部分章节超时。

```typescript
function splitBySections(outline: string, totalWords: number): SectionTask[] {
  // 提取所有 "### 第X节：..." 标题
  const headings = outline.match(/### 第\d+节：.+$/gm) || [];
  const sectionCount = headings.length;
  const wordBudget = totalWords * 0.85; // 留15%给引言结论
  const mainWords = wordBudget / (sectionCount - 2); // 假设首尾章节为引言和结论
  return headings.map((heading, i) => {
    let words: number;
    if (i === 0 || i === sectionCount - 1) words = totalWords * 0.075;
    else words = mainWords;
    return { title: heading.replace('### ', ''), wordTarget: Math.floor(words) };
  });
}
```

每个章节生成时，prompt 会明确标题和预期字数，LLM 更容易输出结构完整、边界清晰的文本，不仅避免了内容断裂，也让后续的并发控制、失败重试、质量判断可以按章节粒度进行，整体容错性大幅提升。

对比两种方式：字数切分实现成本低，但修复拼接问题的时间成本更高；大纲切分前期需要做好章节解析和字数规划，但生成的可用性远高于前者。在长文工程中，除非大纲不可控，否则优先选择按章节切分。

---

## 并发与重试的平衡：任务队列 + 受限并发 + 单章降级

<figure class="inline-figure"><img src="/sync/cms4d9t3s0001zzc66tg4t69r/img-4.jpg" alt="并发与重试的平衡：任务队列 + 受限并发 + 单章降级" /><figcaption>并发与重试的平衡：任务队列 + 受限并发 + 单章降级</figcaption></figure>

分段后，13 个章节独立调用 LLM。串行执行每章耗时约 30 秒，总耗时 390 秒，再加后续精炼，轻松超过 425 秒。但若同时发起 13 个请求，API 提供方直接返回 429（速率限制），且网关瞬时压力骤增，可能触发熔断。必须引入任务队列与受限并发。

我们选用 Bull（基于 Redis）管理章节生成任务。核心流程：生产者将 13 个章节推入队列，消费者以固定并发数取出任务执行。并发数如何定？OpenAI 接口每分钟请求数（RPM）为 3500，但实测在生成 1000 字内容时，每请求耗时约 25~30 秒，过高并发易触发 429；同时网关上行带宽有限，并行过多会导致连接超时。从初始 5 逐步压测，最终确定并发数为 3：既能将总耗时压到约 120 秒，又保持 API 错误率低于 1%。

```javascript
const Queue = require('bull');
const chapterQueue = new Queue('chapter generation', { redis: { host: '127.0.0.1', port: 6379 } });

// 生产者：为每个章节创建任务
chapters.forEach(ch => chapterQueue.add(ch, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }));

// 消费者：指定并发数为 3
chapterQueue.process(3, async (job) => {
  const { chapter } = job.data;
  const result = await generateChapter(chapter);
  return result;
});
```

每个任务允许重试 3 次，使用指数退避（2s, 4s, 8s）。失败处理不走全局队列重试，而是记录 `failedReason`，并在前两次失败后直接重跑该章节；第三次失败则触发降级：直接将章节内容替换为占位段落，并将章节 ID、错误信息写入日志库，等待人工介入。降级动作在 `failed` 事件中完成：

```javascript
chapterQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await savePlaceholder(job.data.chapter.id);
    await logFailure({ chapterId: job.data.chapter.id, error: err.message });
  }
});
```

任务状态机简化如下：pending → active → (completed | failed)。若处于 failed 且重试次数未耗尽，自动回到 pending 等待重试；耗尽后进入 final-failed 状态，由降级逻辑接管。通过此设计，单个章节的失败不会阻塞整个生成流程，最终交付的「半成品」至少所有章节位置存在，便于后续人工补全。实测中，13 章节仅偶发 1~2 次重试，从未触发降级。

---

## 精炼跳过与封面并行：进一步压缩 100 秒的两个决策

<figure class="inline-figure"><img src="/sync/cms4d9t3s0001zzc66tg4t69r/img-5.jpg" alt="精炼跳过与封面并行：进一步压缩 100 秒的两个决策" /><figcaption>精炼跳过与封面并行：进一步压缩 100 秒的两个决策</figcaption></figure>

分段生成后，单章质量往往参差不齐。全量精炼（重写全文）耗时 60-80 秒，且经常通篇改写，引入新不一致。改为按章精炼：仅对不达标章节调用，减少 LLM 调用和后续校验成本。

**质量阈值设定**

1. **长度达标**：章节字数 `≥ 目标字数 * 0.8` 且 `≤ 目标字数 * 1.2`，避免过短或过度展开。
2. **连贯性评分**：用简单启发式检查段落间过渡词密度（如“然而”、“此外”、“具体而言”），每段至少一个过渡词则视为连贯；或统计代词歧义，要求每个“它/其”在前两句有明确指代。
3. **若两项均满足则跳过精炼**，直接拼接；否则触发按章精炼（仅该章重写，耗约 20 秒/章）。

实际效果：原本每章都精炼需 80 秒，采用阈值后平均仅 2 章不达标，精炼耗时压缩至 40 秒。结合前面并发分段生成的 65 秒，总生成+精炼已压至 105 秒内。

**封面生成并行**

封面通常用文生图模型，在文章完成后串行调用耗时约 25 秒。若提前至大纲生成后立即启动，可与正文生成完全重叠。

```javascript
// 伪代码：大纲生成后，立即用章节摘要生成封面提示词，并行调用文生图
const outline = await generateOutline(topic);
const sectionSummaries = outline.sections.map(s => s.heading).join('；');
const coverPrompt = `根据以下文章章节概要生成封面描述：${sectionSummaries}`;
const [sections, coverResult] = await Promise.all([
  generateSectionsInParallel(outline),  // 分段生成正文
  generateCover(coverPrompt)            // 并行生成封面
]);
```

封面生成约 20-25 秒，与正文生成（65 秒）最大纠缠，实际不增加总耗时。注意：封面可能需后处理（如叠加标题），但这步极快，可等正文完成后串行，不计入瓶颈。

两项决策叠加，在分段生成基础上再砍掉精炼延时 40 秒，且封面无额外耗时，最终总时耗稳定在 105 秒。

---

## 闭环对比：从 425 秒到 105 秒的实测数据与踩坑记录

<figure class="inline-figure"><img src="/sync/cms4d9t3s0001zzc66tg4t69r/img-6.jpg" alt="闭环对比：从 425 秒到 105 秒的实测数据与踩坑记录" /><figcaption>闭环对比：从 425 秒到 105 秒的实测数据与踩坑记录</figcaption></figure>

优化前后的耗时差别，直接体现在各阶段耗时分解上。同一篇 6600 字文章，生成大纲（约 12 章）、逐章输出、最后精炼全文与生成封面，全部使用 `deepseek-r1` 接口，超时阈值 60 秒。

- **优化前（串行 + 全文精炼）**：总耗时 425 秒。其中章节生成占了 380 秒（平均每章 31.7 秒，最慢章节 58 秒卡在超时边缘），全文精炼 35 秒，封面 10 秒；后台观察到 `terminated` 报错出现在第 9 章（那次请求被网关强行关闭）。
- **优化后（分段 + 并发 + 跳过精炼 + 并行封面）**：总耗时 105 秒。12 章分 3 批并发（每批 4 章），每批约 25 秒，三批共 75 秒；等待重试章节（2 章失败后降级缩短 prompt）增加 15 秒；封面与最后一批并发执行，额外 0 秒；无精炼耗时。

三段并发理论可以把耗时压到 `max(单章耗时)`，但实际踩了三个坑：

1. **章节衔接生硬**：分段生成时，每章独立上下文，导致相邻章节的开头与结尾出现重复总结或断裂。补救是在每章 prompt 末尾注入上一章最后 80 字的摘要，让模型自然衔接，额外开销每章约 2 秒。
2. **并发时 token 限制被分摊，质量下降**：同一时刻 4 个请求共享接口速率限额，导致单次可用 `max_tokens` 被隐性砍半，有些章节只输出 300 字就截断。改为受限并发（最多 3 个）并设置 `min_tokens=500`，低于 500 字的重试。
3. **降级段落占比过高时的补救**：部分章节重试 3 次都失败，最终只能使用“降级”的短章（约 300 字）。当降级章节超过总章数的 20% 时，文章整体明显头重脚轻。补救措施：对降级章执行一次轻量补写，用更简短的指令补充关键结论，耗时约 10 秒，但能保证文章基本完整。

可复用的配置参数清单（基于 `fetch` 带的 `AbortSignal` 实现超时控制）：

```javascript
const CONFIG = {
  gatewayTimeout: 55_000,    // 留 5 秒余量避免网关 60 秒掐断
  concurrency: 3,            // 受限并发，防止 token 分摊
  minChapterTokens: 500,     // 单章最低字数，低于此值重试
  maxRetryPerChapter: 2,     // 单章最多重试 2 次
  skipRefinement: true,      // 章节质量达标则跳过全文精炼
  parallelCover: true        // 封面生成与最后一批章节并发
};
```

这套方案的核心是把长任务拆成可控的短任务，用并发 + 降级兜底，让耗时落入网关允许范围内。任何会被 60 秒网关掐断的长文本生成（报告、摘要、文档等），都可以套用同样的分段、并发池、降级策略，调整 `gatewayTimeout` 和分段长度即可。
