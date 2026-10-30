import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { pathToFileURL } from "node:url";

export interface CopyIssue {
  filePath: string;
  line: number;
  keyword: string;
  reason: string;
  rawLine: string;
}

export interface ForbiddenRule {
  pattern: RegExp;
  keyword: string;
  reason: string;
}

export const FORBIDDEN_RULES: ForbiddenRule[] = [
  {
    pattern: /\bCOMING\s+SOON\b/i,
    keyword: "COMING SOON",
    reason: "禁止使用开发者视角占位词，请使用简洁用户态表达（如“尚未开放”）",
  },
  {
    pattern: /审核理由/,
    keyword: "审核理由",
    reason: "禁止直接向用户暴露开发者视角的“审核理由”，请改写为自然用户语言",
  },
  {
    pattern: /编辑说明/,
    keyword: "编辑说明",
    reason: "禁止暴露开发者视角的“编辑说明”，说明文案应收敛为简练提示",
  },
  {
    pattern: /投稿说明/,
    keyword: "投稿说明",
    reason: "禁止暴露开发者视角的“投稿说明”，说明文案应收敛为简练提示",
  },
  {
    pattern: /凭证设置/,
    keyword: "凭证设置",
    reason: "禁止暴露开发者视角的“凭证设置”，请改写为用户常用语言",
  },
  {
    pattern: /退藏/,
    keyword: "退藏",
    reason: "动作文案优先使用用户常用表达“取消收藏”，而非“退藏”",
  },
  {
    pattern: /移出队列/,
    keyword: "移出队列",
    reason: "动作文案优先使用用户常用表达“取消稍后阅读”，而非“移出队列”",
  },
  {
    pattern: /内部(?:错误|异常|接口|服务|系统)/,
    keyword: "内部错误",
    reason: "报错文案只告诉用户如何修正或重试，不向普通用户暴露内部实现原因",
  },
];

/**
 * 判断一行是否为安全的系统字体声明或代码标识符
 */
function isIgnoredLine(line: string): boolean {
  const trimmed = line.trim();
  // 1. 忽略系统字体族
  if (trimmed.includes("-apple-system") || trimmed.includes("BlinkMacSystemFont")) {
    return true;
  }
  // 2. 忽略纯代码标识符定义（变量名、类型、导入、计算属性等）
  if (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("export ") ||
    /^(const|let|var|type|interface)\s+[a-zA-Z0-9_]*[sS]ystem/.test(trimmed)
  ) {
    return true;
  }
  // 3. 忽略行内代码注释
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return true;
  }
  return false;
}

/**
 * 扫描文本内容，定位违规文案
 */
export function scanTextForForbiddenCopy(content: string, filePath: string): CopyIssue[] {
  const issues: CopyIssue[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (isIgnoredLine(rawLine)) {
      continue;
    }

    for (const rule of FORBIDDEN_RULES) {
      if (rule.pattern.test(rawLine)) {
        issues.push({
          filePath,
          line: i + 1,
          keyword: rule.keyword,
          reason: rule.reason,
          rawLine: rawLine.trim(),
        });
      }
    }
  }

  return issues;
}

/**
 * 递归遍历目录收集所有 .vue 和 .ts 文件（排除测试与产物）
 */
export function collectTargetFiles(dirPath: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string) {
    let entries: string[] = [];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (
        entry.startsWith(".") ||
        entry === "node_modules" ||
        entry === "dist" ||
        entry === "dist-mobile"
      ) {
        continue;
      }
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (
          (ext === ".vue" || ext === ".ts") &&
          !entry.endsWith(".spec.ts") &&
          !entry.endsWith(".test.ts") &&
          !entry.endsWith(".d.ts")
        ) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * 全量检查工程前端代码
 */
export function runCopyAudit(targetDirs: string[]): CopyIssue[] {
  const allIssues: CopyIssue[] = [];

  for (const dir of targetDirs) {
    const files = collectTargetFiles(dir);
    for (const file of files) {
      try {
        const content = readFileSync(file, "utf8");
        const issues = scanTextForForbiddenCopy(content, file);
        allIssues.push(...issues);
      } catch (err) {
        console.error(`Failed to read file for copy audit: ${file}`, err);
      }
    }
  }

  return allIssues;
}

// CLI 可执行入口
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const projectRoot = resolve(import.meta.dirname, "..");
  const scanDirs = [
    resolve(projectRoot, "src"),
    resolve(projectRoot, "apps/mobile"),
  ];

  console.log("🔍 正在扫描前端用户态文案规范 (AGENTS.md)...");
  const issues = runCopyAudit(scanDirs);

  if (issues.length > 0) {
    console.error(`\n❌ 发现 ${issues.length} 处违反用户态文案规范：\n`);
    for (const issue of issues) {
      console.error(
        `  ${issue.filePath}:${issue.line} [${issue.keyword}]\n` +
        `    原因: ${issue.reason}\n` +
        `    代码: ${issue.rawLine}\n`
      );
    }
    process.exit(1);
  } else {
    console.log("✅ 前端用户态文案规范检查通过，未发现违规开发者视角词汇。");
    process.exit(0);
  }
}
