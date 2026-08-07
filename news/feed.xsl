<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>
          <xsl:value-of select="/rss/channel/title" /> · RSS
        </title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Inter", "Noto Sans SC", system-ui, sans-serif;
            background: #000;
            color: #f5f5f7;
            line-height: 1.6;
          }
          .wrap {
            max-width: 720px;
            margin: 0 auto;
            padding: 48px 24px 80px;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 1.6rem;
            font-weight: 700;
            letter-spacing: -0.02em;
          }
          .lead {
            margin: 0 0 24px;
            color: #a1a1a6;
            font-size: 0.95rem;
          }
          .card {
            padding: 20px;
            border: 1px solid #424245;
            border-radius: 14px;
            background: #1d1d1f;
            margin-bottom: 20px;
          }
          .empty-title {
            margin: 0 0 6px;
            font-weight: 650;
          }
          .empty-desc {
            margin: 0 0 16px;
            color: #a1a1a6;
            font-size: 14px;
          }
          .url {
            display: block;
            padding: 10px 12px;
            border-radius: 8px;
            background: #000;
            border: 1px solid #424245;
            color: #a1a1a6;
            font-size: 12px;
            word-break: break-all;
            user-select: all;
          }
          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
          }
          a.btn {
            display: inline-flex;
            align-items: center;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(168, 177, 255, 0.12);
            border: 1px solid #5672cd;
            color: #a8b1ff;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
          }
          a.btn:hover { filter: brightness(1.1); }
          a.btn--ghost {
            background: transparent;
            border-color: #424245;
            color: #f5f5f7;
          }
          .item {
            padding: 16px 0;
            border-top: 1px solid #424245;
          }
          .item:first-child { border-top: none; padding-top: 0; }
          .item h2 {
            margin: 0 0 6px;
            font-size: 1rem;
            font-weight: 650;
          }
          .item h2 a {
            color: #f5f5f7;
            text-decoration: none;
          }
          .item h2 a:hover { color: #a8b1ff; }
          .meta {
            font-size: 12px;
            color: #86868b;
          }
          .desc {
            margin: 8px 0 0;
            font-size: 14px;
            color: #a1a1a6;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1><xsl:value-of select="/rss/channel/title" /></h1>
          <p class="lead"><xsl:value-of select="/rss/channel/description" /></p>

          <div class="card">
            <p class="empty-title">订阅地址</p>
            <p class="empty-desc">复制下方地址到 Feedly、Follow 等 RSS 阅读器。</p>
            <code class="url" id="feed-url">
              <xsl:value-of select="concat(/rss/channel/link, 'feed.xml')" />
            </code>
            <div class="actions">
              <a class="btn" href="{/rss/channel/link}">返回 AI 动态</a>
              <a class="btn btn--ghost" href="https://feedly.com/i/subscription/feed/{/rss/channel/link}feed.xml">在 Feedly 订阅</a>
            </div>
          </div>

          <xsl:choose>
            <xsl:when test="count(/rss/channel/item) = 0">
              <div class="card">
                <p class="empty-title">暂无内容</p>
                <p class="empty-desc">每天早上 7:00 左右会自动更新，请稍后再来订阅。</p>
              </div>
            </xsl:when>
            <xsl:otherwise>
              <div class="card">
                <p class="empty-title">最新动态</p>
                <xsl:for-each select="/rss/channel/item">
                  <article class="item">
                    <h2><a href="{link}"><xsl:value-of select="title" /></a></h2>
                    <p class="meta"><xsl:value-of select="pubDate" /></p>
                    <p class="desc"><xsl:value-of select="description" /></p>
                  </article>
                </xsl:for-each>
              </div>
            </xsl:otherwise>
          </xsl:choose>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
