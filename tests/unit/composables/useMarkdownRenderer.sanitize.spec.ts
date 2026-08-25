import { describe, expect, it, vi } from "vitest";
import { useMarkdownRenderer } from "../../../src/composables/useMarkdownRenderer";
import type { ResolvedReference } from "../../../src/api/references";

describe("useMarkdownRenderer sanitize", () => {
  it("filters dangerous inline event handlers from rendered html", () => {
    const { renderMarkdown } = useMarkdownRenderer();

    const html = renderMarkdown(
      '<img src="x" onerror="alert(1)"><script>alert(1)</script>',
    );

    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("<script");
    expect(html).toContain("<img");
  });

  it("does not promote paragraphs followed by a single dash to headings", () => {
    const { renderMarkdown } = useMarkdownRenderer();

    const html = renderMarkdown("正文没有加粗 -\n-\n\n下一段");

    expect(html).not.toContain("<h2");
    expect(html).toContain("正文没有加粗");
    expect(renderMarkdown("正常标题\n--")).toContain(
      '<h2 id="正常标题">正常标题</h2>',
    );
    expect(renderMarkdown("```text\n-\n```")).toContain(
      '<code class="language-text">-\n</code>',
    );
  });

  it("keeps structured Markdown when the enhanced runtime is ready", async () => {
    const { renderMarkdown, runtimeState } = useMarkdownRenderer();
    const source = [
      "- 作者：法宗",
      "",
      "## 摘要",
      "",
      "这是正文与 `Quality`。",
      "",
      "- 用户集合为 $(U)$；",
      "",
      "\\[",
      "Q_u = 50",
      "\\]",
      "",
      "```text",
      "示例",
      "```",
    ].join("\n");

    renderMarkdown(source);
    await vi.waitFor(() => expect(runtimeState.value).toBe("ready"), {
      timeout: 10_000,
    });

    const html = renderMarkdown(source);
    expect(html).toContain('<h2 id="摘要">摘要</h2>');
    expect(html).toContain("<p>这是正文与 <code>Quality</code>。</p>");
    expect(html).toContain('<span class="katex">');
    expect(html).not.toContain("$(U)$");
    expect(html).not.toMatch(/^<pre>/);
  });

  it("renders resolved reference tokens as internal links", () => {
    const { renderMarkdown, renderMarkdownInline } = useMarkdownRenderer();
    const references: ResolvedReference[] = [
      {
        kind: "resource",
        target_type: "thread",
        target_id: "topic-1",
        field: "content",
        start: 0,
        end: 13,
        label: "讨论主题",
        module: "forum",
        path: "/topic/topic-1",
        available: true,
      },
    ];
    const html = renderMarkdown("@thread:topic", { references });
    expect(html).toContain('href="/forum/topic/topic-1"');
    expect(html).toContain("@讨论主题");
    expect(renderMarkdownInline("@thread:topic", { references })).toBe(
      '<a href="/forum/topic/topic-1">@讨论主题</a>',
    );
  });

  it("adds UGC link annotations only to external HTTP links", () => {
    const { renderMarkdown, renderMarkdownInline } = useMarkdownRenderer();

    const html = renderMarkdown(
      "[external](https://example.com/path) [internal](/forum/topic-1) [canonical](https://www.atoman.org/feed)",
    );
    expect(html).toContain(
      'href="https://example.com/path" rel="ugc nofollow noreferrer noopener"',
    );
    expect(html).toContain('href="/forum/topic-1"');
    expect(html).not.toMatch(/href="\/forum\/topic-1"[^>]*rel=/);
    expect(html).toContain('href="https://www.atoman.org/feed"');
    expect(html).not.toMatch(
      /href="https:\/\/www\.atoman\.org\/feed"[^>]*rel=/,
    );
    expect(renderMarkdownInline("[external](https://example.com)")).toContain(
      'rel="ugc nofollow noreferrer noopener"',
    );
  });

  it("renders scoped post and music embed fallback links", () => {
    const { renderMarkdown } = useMarkdownRenderer();
    const postId = "11111111-1111-1111-1111-111111111111";
    const albumId = "22222222-2222-2222-2222-222222222222";

    const html = renderMarkdown(
      `:::post{id="${postId}"}\n:::\n\n:::music{id="${albumId}"}\n:::`,
    );

    expect(html).toContain(`href="/posts/post/${postId}"`);
    expect(html).toContain(`href="/music/album/${albumId}"`);
    expect(html).not.toContain(`href="/post/${postId}"`);
    expect(html).not.toContain(`href="/music/albums/${albumId}"`);
  });
});
