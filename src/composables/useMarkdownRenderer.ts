import { reportError } from "@/utils/logger";
import { readonly, shallowRef } from "vue";
import { marked, type Token } from "marked";
import DOMPurify from "dompurify";
import type { ResolvedReference } from "@/api/references";
import { applyResolvedReferences } from "@/composables/useReferenceRendering";

type EmbedData = {
  id: string;
  title: string;
  summary?: string;
  meta?: string;
  href?: string;
};

type RenderMarkdownOptions = {
  postEmbeds?: Record<string, EmbedData>;
  musicEmbeds?: Record<string, EmbedData>;
  videoEmbeds?: Record<string, EmbedData>;
  references?: ResolvedReference[];
  referenceField?: string;
};

type MarkdownRuntimeState = "idle" | "loading" | "ready";

// Configure the base marked renderer once; heavy enhancements are added lazily.
const renderer = new marked.Renderer();
const markdownRuntimeState = shallowRef<MarkdownRuntimeState>("idle");

let markdownRuntimePromise: Promise<void> | null = null;
let markdownRuntimeConfigured = false;

const markdownHighlightLanguages: Array<
  [string, () => Promise<{ default: unknown }>]
> = [
  ["bash", () => import("highlight.js/lib/languages/bash")],
  ["c", () => import("highlight.js/lib/languages/c")],
  ["cpp", () => import("highlight.js/lib/languages/cpp")],
  ["csharp", () => import("highlight.js/lib/languages/csharp")],
  ["css", () => import("highlight.js/lib/languages/css")],
  ["go", () => import("highlight.js/lib/languages/go")],
  ["java", () => import("highlight.js/lib/languages/java")],
  ["javascript", () => import("highlight.js/lib/languages/javascript")],
  ["json", () => import("highlight.js/lib/languages/json")],
  ["markdown", () => import("highlight.js/lib/languages/markdown")],
  ["python", () => import("highlight.js/lib/languages/python")],
  ["rust", () => import("highlight.js/lib/languages/rust")],
  ["scss", () => import("highlight.js/lib/languages/scss")],
  ["shell", () => import("highlight.js/lib/languages/shell")],
  ["sql", () => import("highlight.js/lib/languages/sql")],
  ["typescript", () => import("highlight.js/lib/languages/typescript")],
  ["xml", () => import("highlight.js/lib/languages/xml")],
  ["yaml", () => import("highlight.js/lib/languages/yaml")],
];

renderer.heading = ({ text, depth }) => {
  const id = text
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, "-")
    .replace(/^-|-$/g, "");
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};

marked.use({ renderer });

function shouldLoadMarkdownRuntime(content: string): boolean {
  return /```|~~~|\$\$|\\\(|\\\[|(^|[^\\])\$[^$\n]+\$/m.test(content);
}

async function ensureMarkdownRuntime(): Promise<void> {
  if (markdownRuntimeConfigured) {
    markdownRuntimeState.value = "ready";
    return;
  }

  if (markdownRuntimePromise) return markdownRuntimePromise;

  markdownRuntimeState.value = "loading";
  markdownRuntimePromise = Promise.all([
    import("katex/dist/katex.min.css"),
    import("highlight.js/styles/atom-one-dark.css"),
    import("highlight.js/lib/core"),
    import("marked-highlight"),
    import("marked-katex-extension"),
  ])
    .then(
      async ([
        _katexCss,
        _highlightCss,
        highlightModule,
        markedHighlightModule,
        markedKatexModule,
      ]) => {
        if (markdownRuntimeConfigured) return;

        const hljs = highlightModule.default;
        const { markedHighlight } = markedHighlightModule;
        const markedKatex = markedKatexModule.default;

        await Promise.all(
          markdownHighlightLanguages.map(async ([name, loader]) => {
            const languageModule = await loader();
            return hljs.registerLanguage(
              name,
              languageModule.default as Parameters<
                typeof hljs.registerLanguage
              >[1],
            );
          }),
        );

        marked.use(
          markedHighlight({
            langPrefix: "hljs language-",
            highlight(code, lang) {
              if (!hljs.getLanguage(lang)) return code;
              return hljs.highlight(code, { language: lang }).value;
            },
          }),
        );

        marked.use(
          markedKatex({
            throwOnError: false,
            displayMode: false,
            nonStandard: true,
          }),
        );

        markdownRuntimeConfigured = true;
        markdownRuntimeState.value = "ready";
      },
    )
    .catch((error) => {
      markdownRuntimePromise = null;
      markdownRuntimeState.value = "idle";
      reportError(error, "Failed to lazy-load markdown runtime");
    });

  return markdownRuntimePromise;
}

export function parseBlocks(markdown: string): Token[] {
  return marked.lexer(markdown);
}

export function renderToken(token: Token): string {
  try {
    return marked.parser([token] as Token[]) as string;
  } catch {
    return `<pre>${escapeHtml(token.raw || "")}</pre>`;
  }
}

export function renderInline(markdown: string): string {
  try {
    return marked.parseInline(markdown) as string;
  } catch {
    return escapeHtml(markdown);
  }
}

export function lexInline(text: string): Token[] {
  try {
    return marked.Lexer.lexInline(text);
  } catch {
    return [{ type: "text", raw: text, text }];
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmbedCard(
  kind: "post" | "music" | "video",
  embed: EmbedData,
  missing = false,
): string {
  const labelMap = {
    post: "文章引用",
    music: "音乐引用",
    video: "视频引用",
  } as const;

  const title = escapeHtml(embed.title || labelMap[kind]);
  const summary = escapeHtml(
    embed.summary ||
      (kind === "video"
        ? "该视频暂时不可见，点击尝试打开。"
        : "该引用内容暂无摘要"),
  );
  const meta = embed.meta ? escapeHtml(embed.meta) : "";
  const href = escapeHtml(embed.href || "#");

  return [
    `<div class="atoman-post-embed atoman-post-embed--${kind}${missing ? " atoman-post-embed--missing" : ""}">`,
    `  <a class="atoman-post-embed__link" href="${href}">`,
    `    <div class="atoman-post-embed__label">${labelMap[kind]}</div>`,
    `    <div class="atoman-post-embed__title">${title}</div>`,
    `    <div class="atoman-post-embed__summary">${summary}</div>`,
    meta ? `    <div class="atoman-post-embed__meta">${meta}</div>` : "",
    "  </a>",
    "</div>",
  ]
    .filter(Boolean)
    .join("\n");
}

function replaceDirective(
  content: string,
  kind: "post" | "music" | "video",
  pattern: RegExp,
  embeds: Record<string, EmbedData> | undefined,
  fallbackHref: (id: string) => string,
): string {
  return content.replace(pattern, (_match, id: string) => {
    const embed = embeds?.[id];
    if (!embed) {
      return renderEmbedCard(
        kind,
        { id, title: labelText(kind), href: fallbackHref(id) },
        true,
      );
    }

    return renderEmbedCard(kind, embed);
  });
}

function labelText(kind: "post" | "music" | "video") {
  return {
    post: "引用文章",
    music: "引用音乐",
    video: "引用视频",
  }[kind];
}

function preprocessDirectives(
  content: string,
  options?: RenderMarkdownOptions,
): string {
  let next = applyResolvedReferences(
    content,
    options?.references,
    options?.referenceField,
  );
  next = replaceDirective(
    next,
    "post",
    /:::post\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    options?.postEmbeds,
    (id) => `/posts/post/${id}`,
  );

  next = replaceDirective(
    next,
    "music",
    /:::music\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    options?.musicEmbeds,
    (id) => `/music/album/${id}`,
  );

  next = replaceDirective(
    next,
    "video",
    /:::video\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    options?.videoEmbeds,
    (id) => `/videos/watch/${id}`,
  );

  return next;
}

function normalizeLatexMathDelimiters(content: string): string {
  const output: string[] = [];
  const prose: string[] = [];
  let fenceCharacter = "";
  let fenceLength = 0;

  const flushProse = () => {
    if (!prose.length) return;
    output.push(
      prose
        .join("\n")
        .replace(
          /\$\\\(([^\n]*?)\\\)\$/g,
          (_match, formula: string) => `$${formula.trim()}$`,
        )
        .replace(
          /(?<!\$)\\\[\s*\n?([\s\S]*?)\n?\s*\\\](?!\$)/g,
          (_match, formula: string) => `$$\n${formula.trim()}\n$$`,
        )
        .replace(
          /(?<!\$)\\\(([^\n]*?)\\\)(?!\$)/g,
          (_match, formula: string) => `$${formula.trim()}$`,
        ),
    );
    prose.length = 0;
  };

  for (const line of content.split("\n")) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const markerCharacter = marker?.[0];
      if (!marker || !markerCharacter) {
        prose.push(line);
        continue;
      }

      if (!fenceCharacter) {
        flushProse();
        fenceCharacter = markerCharacter;
        fenceLength = marker.length;
      } else if (
        markerCharacter === fenceCharacter &&
        marker.length >= fenceLength
      ) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      output.push(line);
      continue;
    }

    if (fenceCharacter) output.push(line);
    else prose.push(line);
  }

  flushProse();
  return output.join("\n");
}

function disambiguateSingleMarkerLines(content: string): string {
  const lines = content.split("\n");
  let fenceCharacter = "";
  let fenceLength = 0;

  return lines
    .map((line, index) => {
      const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        const markerCharacter = marker?.[0];
        if (!marker || !markerCharacter) return line;

        if (!fenceCharacter) {
          fenceCharacter = markerCharacter;
          fenceLength = marker.length;
        } else if (
          markerCharacter === fenceCharacter &&
          marker.length >= fenceLength
        ) {
          fenceCharacter = "";
          fenceLength = 0;
        }
        return line;
      }

      if (fenceCharacter || index === 0 || !lines[index - 1]?.trim())
        return line;

      const markerMatch = /^( {0,3})([-=])([ \t]*)(\r?)$/.exec(line);
      if (!markerMatch) return line;

      // The entity stays visible but cannot be consumed as a Setext underline.
      const entity = markerMatch[2] === "-" ? "&#45;" : "&#61;";
      return `${markerMatch[1]}${entity}${markerMatch[3]}${markerMatch[4]}`;
    })
    .join("\n");
}

const canonicalOrigin = "https://www.atoman.org";
const internalOrigins = new Set([canonicalOrigin, "https://atoman.org"]);

function decorateOutboundLinks(html: string): string {
  if (typeof document === "undefined") return DOMPurify.sanitize(html);

  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  fragment.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    try {
      const href = link.getAttribute("href");
      if (!href) return;

      const destination = new URL(href, canonicalOrigin);
      if (
        !["http:", "https:"].includes(destination.protocol) ||
        internalOrigins.has(destination.origin)
      )
        return;

      const relations = new Set(link.rel.split(/\s+/).filter(Boolean));
      relations.add("ugc");
      relations.add("nofollow");
      relations.add("noreferrer");
      relations.add("noopener");
      link.rel = [...relations].join(" ");
    } catch {
      // DOMPurify has already removed unsafe URLs; leave malformed links untouched.
    }
  });

  const container = document.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

export function useMarkdownRenderer() {
  function renderMarkdown(
    content: string,
    options?: RenderMarkdownOptions,
  ): string {
    if (!content) return "";

    const runtimeState = markdownRuntimeState.value;
    if (runtimeState !== "ready" && shouldLoadMarkdownRuntime(content)) {
      void ensureMarkdownRuntime();
    }

    try {
      const html = marked(
        disambiguateSingleMarkerLines(
          normalizeLatexMathDelimiters(preprocessDirectives(content, options)),
        ),
      ) as string;
      return decorateOutboundLinks(html);
    } catch {
      return `<pre>${escapeHtml(content)}</pre>`;
    }
  }

  function renderMarkdownInline(
    content: string,
    options?: RenderMarkdownOptions,
  ): string {
    if (!content) return "";

    try {
      const referenced = applyResolvedReferences(
        content,
        options?.references,
        options?.referenceField,
      );
      return decorateOutboundLinks(marked.parseInline(referenced) as string);
    } catch {
      return escapeHtml(content);
    }
  }

  return {
    renderMarkdown,
    renderMarkdownInline,
    runtimeState: readonly(markdownRuntimeState),
  };
}
