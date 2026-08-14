import { spawnSync } from "node:child_process";

const baseRef =
	process.env.VITEST_CHANGED_SINCE ||
	(process.env.GITHUB_BASE_REF
		? `origin/${process.env.GITHUB_BASE_REF}`
		: "origin/main");

function runGit(args) {
	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
	}
	return result.stdout.trim();
}

let baseCommit;
try {
	baseCommit = runGit(["merge-base", baseRef, "HEAD"]);
} catch (error) {
	console.error(`无法确定关联测试基准 ${baseRef}: ${error.message}`);
	process.exit(1);
}

const changedFiles = runGit([
	"diff",
	"--name-only",
	`${baseCommit}..HEAD`,
	"--",
	"src",
	"tests",
])
	.split("\n")
	.filter((file) => /\.(?:ts|tsx|vue)$/.test(file));

if (changedFiles.length === 0) {
	process.stdout.write("没有影响单测的前端源码变更\n");
	process.exit(0);
}

const result = spawnSync(
	"bunx",
	[
		"vitest",
		"related",
		"--run",
		"--passWithNoTests",
		"--maxWorkers=4",
		...changedFiles,
		...process.argv.slice(2),
	],
	{ stdio: "inherit" },
);

process.exit(result.status ?? 1);
