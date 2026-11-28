import { reportError } from "@/utils/logger";
import { readonly, shallowRef } from "vue";
import { marked, type Token } from "marked";
import markedFootnote from "marked-footnote";
import DOMPurify from "dompurify";
import type { ResolvedReference } from "@/api/references";
import { applyResolvedReferences } from "@/composables/useReferenceRendering";
import type { Song, Video } from "@/types";

export type EmbedData = {
  id: string;
  title: string;
  kind?: "post" | "album" | "song" | "video";
  summary?: string;
  meta?: string;
  href?: string;
  imageUrl?: string;
  audioSrc?: string;
  videoSrc?: string;
  iframeSrc?: string;
  posterUrl?: string;
  duration?: number;
  playbackSongs?: Song[];
  video?: Video;
};

type RenderMarkdownOptions = {
  postEmbeds?: Record<string, EmbedData>;
  musicEmbeds?: Record<string, EmbedData>;
  videoEmbeds?: Record<string, EmbedData>;
  references?: ResolvedReference[];
  referenceField?: string;
  interactiveMedia?: boolean;
  mountVideoEmbeds?: boolean;
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
marked.use(
  markedFootnote({
    refMarkers: true,
    footnoteDivider: true,
    description: "注释",
    backRefLabel: "回到正文引用 {0}",
  }),
);

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
  interactiveMedia = false,
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

  if (kind === "music") {
    const musicKind = embed.kind === "song" ? "song" : "album";
    const image = embed.imageUrl
      ? `<img class="atoman-post-embed__image" src="${escapeHtml(embed.imageUrl)}" alt="" loading="lazy" decoding="async">`
      : `<div class="atoman-post-embed__image atoman-post-embed__image--empty" aria-hidden="true">♪</div>`;
    const playButton = interactiveMedia && !missing && embed.playbackSongs?.length
      ? `  <button class="atoman-post-embed__play" type="button" data-atoman-embed-play="music" data-atoman-embed-id="${escapeHtml(embed.id)}" aria-label="播放 ${title}">播放</button>`
      : "";
    const audio = !interactiveMedia && musicKind === "song" && embed.audioSrc
      ? `  <audio class="atoman-post-embed__audio" controls preload="metadata" src="${escapeHtml(embed.audioSrc)}" aria-label="播放 ${title}"></audio>`
      : "";
    return [
      `<div class="atoman-post-embed atoman-post-embed--music atoman-post-embed--music-${musicKind}${missing ? " atoman-post-embed--missing" : ""}">`,
      `  <div class="atoman-post-embed__music-card">`,
      `    <a class="atoman-post-embed__link" data-atoman-embed="music" href="${href}">`,
      `      ${image}`,
      `      <div class="atoman-post-embed__content">`,
      `        <div class="atoman-post-embed__label">${musicKind === "song" ? "单曲引用" : "专辑引用"}</div>`,
      `        <div class="atoman-post-embed__title">${title}</div>`,
      `        <div class="atoman-post-embed__summary">${summary}</div>`,
      meta ? `        <div class="atoman-post-embed__meta">${meta}</div>` : "",
      "      </div>",
      "    </a>",
      playButton,
      audio,
      "  </div>",
      "</div>",
    ].filter(Boolean).join("\n");
  }

  if (kind === "video") {
    const interactivePlayer = interactiveMedia && embed.video && (embed.iframeSrc || embed.videoSrc)
      ? `<div data-atoman-video-embed="${escapeHtml(embed.id)}"></div>`
      : "";
    const player = interactivePlayer || (embed.iframeSrc
      ? `<a class="atoman-post-embed__player atoman-post-embed__player--empty" href="${href}" data-atoman-embed="video">打开视频播放</a>`
      : embed.videoSrc
        ? `<video class="atoman-post-embed__player" controls preload="metadata" playsinline src="${escapeHtml(embed.videoSrc)}"${embed.posterUrl ? ` poster="${escapeHtml(embed.posterUrl)}"` : ""}></video>`
        : embed.posterUrl
          ? `<img class="atoman-post-embed__player atoman-post-embed__player--poster" src="${escapeHtml(embed.posterUrl)}" alt="" loading="lazy" decoding="async">`
          : `<div class="atoman-post-embed__player atoman-post-embed__player--empty">视频暂不可播放</div>`);
    return [
      `<div class="atoman-post-embed atoman-post-embed--video${missing ? " atoman-post-embed--missing" : ""}">`,
      `  <div class="atoman-post-embed__media">${player}</div>`,
      `  <a class="atoman-post-embed__link atoman-post-embed__link--video" data-atoman-embed="video" href="${href}">`,
      `    <div class="atoman-post-embed__label">视频引用</div>`,
      `    <div class="atoman-post-embed__title">${title}</div>`,
      `    <div class="atoman-post-embed__summary">${summary}</div>`,
      meta ? `    <div class="atoman-post-embed__meta">${meta}</div>` : "",
      "  </a>",
      "</div>",
    ].filter(Boolean).join("\n");
  }

  return [
    `<div class="atoman-post-embed atoman-post-embed--${kind}${missing ? " atoman-post-embed--missing" : ""}">`,
    `  <a class="atoman-post-embed__link" data-atoman-embed="${kind}" href="${href}">`,
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
  interactiveMedia: boolean,
): string {
  return content.replace(pattern, (_match, id: string) => {
    const embed = embeds?.[id];
    if (!embed) {
      return renderEmbedCard(
        kind,
        { id, title: labelText(kind), href: fallbackHref(id) },
        true,
        interactiveMedia,
      );
    }

    return renderEmbedCard(kind, embed, false, interactiveMedia);
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
    Boolean(options?.interactiveMedia),
  );

  next = replaceDirective(
    next,
    "music",
    /:::music\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    options?.musicEmbeds,
    (id) => `/music/songs?q=${encodeURIComponent(id)}`,
    Boolean(options?.interactiveMedia),
  );

  next = replaceDirective(
    next,
    "video",
    /:::video\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    options?.videoEmbeds,
    (id) => `/videos/watch/${id}`,
    Boolean(options?.interactiveMedia && options?.mountVideoEmbeds !== false),
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

function footnoteFenceState(line: string, fenceCharacter: string, fenceLength: number) {
  const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!fenceMatch) return { handled: false, fenceCharacter, fenceLength };
  const marker = fenceMatch[1];
  const markerChar = marker?.[0] || "";
  if (!markerChar) return { handled: true, fenceCharacter, fenceLength };
  if (!fenceCharacter) {
    return { handled: true, fenceCharacter: markerChar, fenceLength: marker.length };
  }
  if (markerChar === fenceCharacter && marker.length >= fenceLength) {
    return { handled: true, fenceCharacter: "", fenceLength: 0 };
  }
  return { handled: true, fenceCharacter, fenceLength };
}

function isEscapedMarkdownChar(content: string, index: number) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function closingBacktickSpan(content: string, start: number) {
  let ticks = 0;
  while (content[start + ticks] === "`") ticks += 1;
  if (!ticks) return null;
  let cursor = start + ticks;
  while (cursor < content.length) {
    if (content[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    let close = 0;
    while (content[cursor + close] === "`") close += 1;
    if (close === ticks) return cursor + close;
    cursor += close;
  }
  return null;
}

function closingInlineDollar(content: string, from: number) {
  for (let cursor = from; cursor < content.length; cursor += 1) {
    if (content[cursor] === "\n") return null;
    if (content[cursor] !== "$" || isEscapedMarkdownChar(content, cursor)) continue;
    if (content[cursor + 1] === "$" || cursor === from) return null;
    return cursor + 1;
  }
  return null;
}

// Fenced blocks are skipped by the line walker. Inline code and math still need
// their own ranges, including spans that cross lines, or ^1 becomes <sup>.
function inlineFootnoteSkipRanges(content: string) {
  const ranges: Array<[number, number]> = [];
  let fenceCharacter = "";
  let fenceLength = 0;
  let index = 0;
  while (index < content.length) {
    const atLineStart = index === 0 || content[index - 1] === "\n";
    if (atLineStart) {
      const lineBreak = content.indexOf("\n", index);
      const line = content.slice(index, lineBreak === -1 ? content.length : lineBreak);
      const wasFenced = Boolean(fenceCharacter);
      const fence = footnoteFenceState(line, fenceCharacter, fenceLength);
      fenceCharacter = fence.fenceCharacter;
      fenceLength = fence.fenceLength;
      if (fence.handled || wasFenced || fenceCharacter) {
        index += line.length + 1;
        continue;
      }
    }

    if (content[index] === "`") {
      const end = closingBacktickSpan(content, index);
      if (end != null) {
        ranges.push([index, end]);
        index = end;
        continue;
      }
    }

    if (content.startsWith("$$", index) && !isEscapedMarkdownChar(content, index)) {
      const close = content.indexOf("$$", index + 2);
      const end = close === -1 ? content.length : close + 2;
      ranges.push([index, end]);
      index = end;
      continue;
    }

    if (content[index] === "$" && !isEscapedMarkdownChar(content, index)) {
      const end = closingInlineDollar(content, index + 1);
      if (end != null) {
        ranges.push([index, end]);
        index = end;
        continue;
      }
    }

    index += 1;
  }
  return ranges;
}

function lineStartOffsets(lines: string[]) {
  const offsets: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  return offsets;
}

function overlapsFootnoteSkip(ranges: Array<[number, number]>, start: number, end: number) {
  return ranges.some(([from, to]) => start < to && end > from);
}

function referencedFootnoteIdsIn(lines: string[], ranges: Array<[number, number]>, offsets: number[]) {
  const referenced = new Set<string>();
  let fenceCharacter = "";
  let fenceLength = 0;
  lines.forEach((line, lineIndex) => {
    const fence = footnoteFenceState(line, fenceCharacter, fenceLength);
    fenceCharacter = fence.fenceCharacter;
    fenceLength = fence.fenceLength;
    if (fence.handled || fenceCharacter) return;
    const lineStart = offsets[lineIndex] ?? 0;
    if (overlapsFootnoteSkip(ranges, lineStart, lineStart + line.length)) {
      if (ranges.some(([from, to]) => lineStart >= from && lineStart + line.length <= to)) return;
    }
    if (/^\s*(?:\[\^|\^)[0-9a-zA-Z_-]+\]?:/.test(line)) return;
    for (const match of line.matchAll(/(^|[^\w\[\^])\^([0-9a-zA-Z_-]+)(?=[^\w\]\^:]|$)/g)) {
      const offset = match.index ?? 0;
      if (overlapsFootnoteSkip(ranges, lineStart + offset, lineStart + offset + match[0].length)) continue;
      referenced.add(match[2]);
    }
    for (const match of line.matchAll(/(^|[^\w])\[\^([0-9a-zA-Z_-]+)\](?!:)/g)) {
      const offset = match.index ?? 0;
      if (overlapsFootnoteSkip(ranges, lineStart + offset, lineStart + offset + match[0].length)) continue;
      referenced.add(match[2]);
    }
  });
  return referenced;
}

function mapOutsideFootnoteSkips(
  line: string,
  lineStart: number,
  ranges: Array<[number, number]>,
  transform: (text: string) => string,
) {
  const cuts = new Set<number>([0, line.length]);
  for (const [from, to] of ranges) {
    const start = Math.max(0, from - lineStart);
    const end = Math.min(line.length, to - lineStart);
    if (end > start) {
      cuts.add(start);
      cuts.add(end);
    }
  }
  const points = [...cuts].sort((left, right) => left - right);
  let output = "";
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? line.length;
    const slice = line.slice(start, end);
    const absoluteStart = lineStart + start;
    const absoluteEnd = lineStart + end;
    const protectedSlice = ranges.some(([from, to]) => absoluteStart >= from && absoluteEnd <= to);
    output += protectedSlice ? slice : transform(slice);
  }
  return output;
}

function preprocessFootnotes(content: string): string {
  const lines = content.split("\n");
  const skipRanges = inlineFootnoteSkipRanges(content);
  const offsets = lineStartOffsets(lines);
  const referencedFootnoteIds = referencedFootnoteIdsIn(lines, skipRanges, offsets);
  let fenceCharacter = "";
  let fenceLength = 0;

  const definitionKeys = new Set<string>();
  const normalizedLines = lines.map((line, lineIndex) => {
      const fence = footnoteFenceState(line, fenceCharacter, fenceLength);
    fenceCharacter = fence.fenceCharacter;
    fenceLength = fence.fenceLength;
    if (fence.handled || fenceCharacter) return line;
    const lineStart = offsets[lineIndex] ?? 0;
    if (skipRanges.some(([from, to]) => lineStart >= from && lineStart + line.length <= to)) return line;

    const standardDefinition = /^(\s*)\[\^([0-9a-zA-Z_-]+)\]:(.*)$/.exec(line);
    if (standardDefinition) {
      definitionKeys.add(standardDefinition[2]);
      return line;
    }
    const shorthandDefinition = /^(\s*)\^([0-9a-zA-Z_-]+):(.*)$/.exec(line);
    if (shorthandDefinition && referencedFootnoteIds.has(shorthandDefinition[2])) {
      definitionKeys.add(shorthandDefinition[2]);
      return `${shorthandDefinition[1]}[^${shorthandDefinition[2]}]:${shorthandDefinition[3]}`;
    }
    return line;
  });

  fenceCharacter = "";
  fenceLength = 0;
  return normalizedLines
    .map((line, lineIndex) => {
      const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        const markerChar = marker?.[0];
        if (marker && markerChar) {
          if (!fenceCharacter) {
            fenceCharacter = markerChar;
            fenceLength = marker.length;
          } else if (markerChar === fenceCharacter && marker.length >= fenceLength) {
            fenceCharacter = "";
            fenceLength = 0;
          }
        }
        return line;
      }
      if (fenceCharacter) return line;
      const lineStart = offsets[lineIndex] ?? 0;
      if (skipRanges.some(([from, to]) => lineStart >= from && lineStart + line.length <= to)) return line;

      if (/^\s*\[\^([0-9a-zA-Z_-]+)\]:/.test(line)) return line;

      return mapOutsideFootnoteSkips(line, lineStart, skipRanges, (text) => {
        // 1. Replace defined keys with standard marked [^id] footnote syntax
        let processed = text.replace(/(^|[^\w\[\^])\^([0-9a-zA-Z_-]+)(?=[^\w\]\^:]|$)/g, (match, prefix, id) => {
          if (definitionKeys.has(id)) return `${prefix}[^${id}]`;
          return match;
        });

        // 2. For standalone superscript numbers like ^1 or [^1] without a definition, convert to <sup>id</sup>
        processed = processed.replace(/(^|[^\w\[\^])\^([0-9]+)(?=[^\w\]\^:]|$)/g, (_match, prefix, id) => {
          if (!definitionKeys.has(id)) return `${prefix}<sup>${id}</sup>`;
          return _match;
        });

        processed = processed.replace(/(^|[^\w])\[\^([0-9]+)\](?=[^\w:]|$)/g, (_match, prefix, id) => {
          if (!definitionKeys.has(id)) return `${prefix}<sup>${id}</sup>`;
          return _match;
        });

        return processed;
      });
    })
    .join("\n");
}

const canonicalOrigin = "https://www.atoman.org";
const internalOrigins = new Set([canonicalOrigin, "https://atoman.org"]);
const markdownMediaSanitizeOptions = {
  ADD_TAGS: ["audio", "iframe", "source", "video", "section"],
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "controls",
    "loading",
    "playsinline",
    "poster",
    "preload",
    "src",
    "title",
    "data-footnote-ref",
    "data-footnote-backref",
    "data-footnotes",
    "aria-describedby",
    "aria-label",
  ],
};

function decorateOutboundLinks(html: string, preserveSingleRoot = false): string {
  if (typeof document === "undefined") return DOMPurify.sanitize(html, markdownMediaSanitizeOptions);

  const fragment = preserveSingleRoot
    ? DOMPurify.sanitize(
        `<div data-atoman-sanitize-root="true">\n${html}\n</div>`,
        { ...markdownMediaSanitizeOptions, RETURN_DOM_FRAGMENT: true },
      )
    : DOMPurify.sanitize(html, { ...markdownMediaSanitizeOptions, RETURN_DOM_FRAGMENT: true });
  const trustedFrame = (src: string) => (
    /^https:\/\/(?:www\.youtube\.com|youtube\.com)\/embed\/[A-Za-z0-9_-]{11}(?:[?#]|$)/.test(src)
    || /^https:\/\/player\.bilibili\.com\/player\.html\?bvid=BV[A-Za-z0-9]+(?:&|$)/.test(src)
  );
  fragment.querySelectorAll("iframe").forEach((frame) => {
    const src = frame.getAttribute("src") || "";
    if (!trustedFrame(src)) {
      frame.remove();
      return;
    }
    frame.removeAttribute("allow");
  });
  fragment.querySelectorAll("audio,video,source").forEach((media) => {
    media.removeAttribute("autoplay");
    if (!media.closest(".atoman-post-embed")) media.remove();
  });
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
        preprocessFootnotes(
          disambiguateSingleMarkerLines(
            normalizeLatexMathDelimiters(preprocessDirectives(content, options)),
          ),
        ),
      ) as string;
      return decorateOutboundLinks(html, true);
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
