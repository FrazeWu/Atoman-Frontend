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

  it("renders standalone footnote markers as superscript elements", () => {
    const { renderMarkdown } = useMarkdownRenderer();

    const html = renderMarkdown("究竟有多么无力。^1\n\n另外还有参考[^2]。");

    expect(html).toContain("无力。<sup>1</sup>");
    expect(html).toContain("另外还有参考<sup>2</sup>");
  });

  it("keeps an unreferenced caret line in the article", () => {
    const { renderMarkdown } = useMarkdownRenderer();

    const html = renderMarkdown("Hello\n\n^1: this citation line should remain visible");

    expect(html).toContain("this citation line should remain visible");
    expect(html).not.toContain("footnotes");
  });

  it("drops arbitrary frames and remote media while keeping a trusted player", () => {
    const { renderMarkdown } = useMarkdownRenderer();

    const html = renderMarkdown([
      '<iframe src="https://evil.example" allow="camera *; microphone *"></iframe>',
      '<audio src="https://evil.example/a.mp3" autoplay></audio>',
      ':::video{id="33333333-3333-3333-3333-333333333333"}',
      ':::',
    ].join("\n"), {
      videoEmbeds: {
        "33333333-3333-3333-3333-333333333333": {
          id: "33333333-3333-3333-3333-333333333333",
          title: "演示",
          kind: "video",
          iframeSrc: "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&autoplay=0",
          href: "/videos/watch/33333333-3333-3333-3333-333333333333",
        },
      },
    });

    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("camera");
    expect(html).not.toContain("microphone");
    expect(html).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
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
      "- 线性项为 \\(R_t\\)。",
      "- 集合为 $\\(A\\)$。",
      "",
      "\\[",
      "Q_u = 50",
      "\\]",
      "",
      "```text",
      "\\(kept\\)",
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
    expect(html).not.toContain("\\(R_t\\)");
    expect(html).not.toContain("\\(A\\)");
    expect(html).not.toContain("\\[");
    expect(html).toContain(
      '<code class="hljs language-text">\\(kept\\)\n</code>',
    );
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
    expect(html).toContain(`href="/music/songs?q=${albumId}"`);
    expect(html).not.toContain(`href="/post/${postId}"`);
    expect(html).not.toContain(`href="/music/albums/${albumId}"`);
  });

  it("renders footnotes as superscript links with corresponding jump items", () => {
    const { renderMarkdown } = useMarkdownRenderer();
    const source = [
      "这是一段包含注释的正文[^1]，这里还有第二个注释[^2]。",
      "",
      "[^1]: 这是第一个注释的具体内容。",
      "[^2]: 这是第二个注释的具体内容。",
    ].join("\n");

    const html = renderMarkdown(source);

    expect(html).toContain('<sup><a id="footnote-ref-1" href="#footnote-1" data-footnote-ref="" aria-describedby="footnote-label">[1]</a></sup>');
    expect(html).toContain('<sup><a id="footnote-ref-2" href="#footnote-2" data-footnote-ref="" aria-describedby="footnote-label">[2]</a></sup>');
    expect(html).toContain('<section class="footnotes" data-footnotes="">');
    expect(html).toContain('<li id="footnote-1">');
    expect(html).toContain('<li id="footnote-2">');
    expect(html).toContain('href="#footnote-ref-1"');
    expect(html).toContain('href="#footnote-ref-2"');
  });

  it("normalizes loose footnote shorthand into superscript annotations", () => {
    const { renderMarkdown } = useMarkdownRenderer();
    const source = [
      "究竟有多么无力。^1",
      "",
      "^1: 这是第一条注释。",
      "",
      "代码块中的不应转换：",
      "```text",
      "x^2 = 4",
      "^1: not a note",
      "```",
    ].join("\n");

    const html = renderMarkdown(source);

    expect(html).toContain('<sup><a id="footnote-ref-1" href="#footnote-1" data-footnote-ref="" aria-describedby="footnote-label">[1]</a></sup>');
    expect(html).toContain('<section class="footnotes" data-footnotes="">');
    expect(html).toContain('<li id="footnote-1">');
    expect(html).toContain('这是第一条注释。');
  });

  it("does not turn footnote markers inside inline code or math into superscripts", () => {
    const { renderMarkdown } = useMarkdownRenderer();
    const html = renderMarkdown([
      "正文标记 ^1 和 [^2] 仍然是上标。",
      "",
      "行内代码 `^1`、`[^2]` 与公式 $x^2$、$$y^3$$ 保持原样。",
      "",
      "$$",
      "a^2 + [^4]",
      "$$",
      "",
      "\\(b^5\\)",
    ].join("\n"));

    expect(html).toContain("正文标记 <sup>1</sup>");
    expect(html).toContain("和 <sup>2</sup>");
    expect(html).toContain("<code>^1</code>");
    expect(html).toContain("<code>[^2]</code>");
    expect(html).not.toContain("<code><sup>");
    expect(html).not.toContain("$x<sup>");
    expect(html).not.toContain("$$y<sup>");
    expect(html).not.toContain("a<sup>2</sup>");
    expect(html).not.toContain("[<sup>4</sup>]");
    expect(html).not.toContain("b<sup>5</sup>");
  });
});
