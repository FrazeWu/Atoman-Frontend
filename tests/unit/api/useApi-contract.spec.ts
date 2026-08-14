import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { globSync } from "glob";
import {
	useApi,
	useApiUrl,
	useApiWebSocketUrl,
	useWebSocketUrl,
} from "../../../src/composables/useApi";

beforeEach(() => {
	vi.stubEnv("VITE_API_URL", undefined);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const projectRoot = process.cwd();
const allowedApiFiles = new Set([
	"src/composables/useApi.ts",
	"src/api/client.ts",
	"src/api/musicV1.ts",
]);

describe("API endpoint construction contract", () => {
	it("defaults API requests to the versioned backend prefix", () => {
		expect(useApiUrl()).toBe("/api/v1");
	});

	it("normalizes configured API roots to the versioned backend prefix", () => {
		vi.stubEnv("VITE_API_URL", "/api");
		expect(useApiUrl()).toBe("/api/v1");

		vi.stubEnv("VITE_API_URL", "/api/v1");
		expect(useApiUrl()).toBe("/api/v1");

		vi.stubEnv("VITE_API_URL", "http://localhost:8080");
		expect(useApiUrl()).toBe("http://localhost:8080/api/v1");

		vi.stubEnv("VITE_API_URL", "http://localhost:8080/api");
		expect(useApiUrl()).toBe("http://localhost:8080/api/v1");

		vi.stubEnv("VITE_API_URL", undefined);
	});

	it("derives v1 endpoint groups from the configured versioned base URL", () => {
		vi.stubEnv("VITE_API_URL", "http://localhost:8080/api");
		const api = useApi();

		expect(api.v1.url).toBe("http://localhost:8080/api/v1");
		expect(api.v1.uploads).toBe("http://localhost:8080/api/v1/uploads");
		expect(api.v1.music.albums).toBe(
			"http://localhost:8080/api/v1/music/albums",
		);
		expect(api.v1.forum.categories).toBe(
			"http://localhost:8080/api/v1/forum/categories",
		);
		expect(api.admin.feed.opmlImport).toBe(
			"http://localhost:8080/api/v1/feed/sources/opml/import",
		);
		expect(api.admin.feed.opmlExport).toBe(
			"http://localhost:8080/api/v1/feed/sources/opml/export",
		);
		expect(api.auth.onboardingRecommendations).toBe(
			"http://localhost:8080/api/v1/feed/onboarding/recommendations",
		);
		expect(api.admin.feed.onboardingRecommendations).toBe(
			"http://localhost:8080/api/v1/admin/feed/onboarding/recommendations",
		);
		expect(api.admin.feed.onboardingRecommendation("recommendation-1")).toBe(
			"http://localhost:8080/api/v1/admin/feed/onboarding/recommendations/recommendation-1",
		);

		vi.stubEnv("VITE_API_URL", undefined);
	});

	it("derives websocket urls from the configured api origin", () => {
		vi.stubEnv("VITE_API_URL", "https://api.atoman.org/api");
		expect(useApiWebSocketUrl("collab/ws/room-1")).toBe(
			"wss://api.atoman.org/api/v1/collab/ws/room-1",
		);
		expect(useWebSocketUrl("/ws/user")).toBe("wss://api.atoman.org/ws/user");

		vi.stubEnv("VITE_API_URL", "http://localhost:8080/api");
		expect(useApiWebSocketUrl("collab/ws/room-1")).toBe(
			"ws://localhost:8080/api/v1/collab/ws/room-1",
		);
		expect(useWebSocketUrl("/ws/user")).toBe("ws://localhost:8080/ws/user");

		vi.stubEnv("VITE_API_URL", undefined);
	});

	it("falls back to relative websocket paths for an invalid configured API URL", () => {
		vi.stubEnv("VITE_API_URL", "http://[invalid");
		expect(useWebSocketUrl("/ws/user")).toBe("/ws/user");
		expect(useApiWebSocketUrl("collab/ws/room-1")).toBe(
			"/api/v1/collab/ws/room-1",
		);

		vi.stubEnv("VITE_API_URL", undefined);
	});

	it("exposes content lifecycle endpoints under the versioned API", () => {
		const api = useApi();

		expect(api.content.events).toBe("/api/v1/content/events");
		expect(api.content.progress).toBe("/api/v1/content/progress");
		expect(api.content.progressItem("video", "video-1")).toBe(
			"/api/v1/content/progress/video/video-1",
		);
		expect(api.content.continue).toBe("/api/v1/content/continue");
		expect(api.content.notificationPreferences).toBe(
			"/api/v1/content/notification-preferences",
		);
		expect(api.content.schedule("podcast", "episode-1")).toBe(
			"/api/v1/content/podcast/episode-1/schedule",
		);
	});

	it("uses registered unified interaction endpoints", () => {
		const api = useApi();

		expect(api.blog.comments("post-1")).toBe(
			"/api/v1/discussions/blog_post/post-1/comments",
		);
		expect(api.blog.comments("post/1")).toBe(
			"/api/v1/discussions/blog_post/post%2F1/comments",
		);
		expect(api.interactions.blogPostComments("post-1")).toBe(
			"/api/v1/discussions/blog_post/post-1/comments",
		);
		expect(api.videos.comments("video-1")).toBe(
			"/api/v1/discussions/video/video-1/comments",
		);
		expect(api.videos.comment("comment-1")).toBe("/api/v1/comments/comment-1");
		expect(api.notifications.markCategoryRead("reply")).toBe(
			"/api/v1/notifications/read-all?category=reply",
		);
	});

	it("does not expose legacy top-level music CRUD endpoints", () => {
		const api = useApi();

		expect(api).not.toHaveProperty("songs");
		expect(api).not.toHaveProperty("song");
		expect(api).not.toHaveProperty("albums");
		expect(api).not.toHaveProperty("album");
		expect(api).not.toHaveProperty("artists");
		expect(api).not.toHaveProperty("corrections");
		expect(api).not.toHaveProperty("music.albums");
		expect(api).not.toHaveProperty("music.album");
		expect(api).not.toHaveProperty("music.artists");
		expect(api).not.toHaveProperty("music.artistRevisions");
		expect(api).not.toHaveProperty("music.artistAliases");
		expect(api).not.toHaveProperty("music.songAnnotations");
	});

	it("does not expose unregistered podcast progress and aggregation endpoints", () => {
		const api = useApi();

		expect(api.podcast).not.toHaveProperty("listenLater");
		expect(api.podcast).not.toHaveProperty("listenLaterItem");
		expect(api.podcast).not.toHaveProperty("progress");
		expect(api.podcast).not.toHaveProperty("episodeProgress");
		expect(api.podcast).not.toHaveProperty("subscriptionEpisodes");
	});

	it("does not expose removed legacy blog collection mutation endpoints", () => {
		const api = useApi();

		expect(api.blog).not.toHaveProperty("postCollections");
		expect(api.blog).not.toHaveProperty("postCollection");
		expect(api.blog.collectionPostOrder("collection-1")).toBe(
			"/api/v1/blog/collections/collection-1/posts/order",
		);
	});

	it("keeps VITE_API_URL access centralized in useApi helpers", () => {
		const offenders = globSync("src/**/*.{ts,vue}", { cwd: projectRoot })
			.filter((file) => !allowedApiFiles.has(file))
			.filter((file) =>
				readFileSync(join(projectRoot, file), "utf8").includes(
					"import.meta.env.VITE_API_URL",
				),
			);

		expect(offenders).toEqual([]);
	});

	it("uses configured helpers for hardcoded API paths outside API helpers", () => {
		const offenders = globSync("src/**/*.{ts,vue}", { cwd: projectRoot })
			.filter((file) => !allowedApiFiles.has(file))
			.flatMap((file) => {
				const source = readFileSync(join(projectRoot, file), "utf8");
				return source
					.split("\n")
					.map((line, index) => ({
						file: relative(projectRoot, join(projectRoot, file)),
						line,
						lineNumber: index + 1,
					}))
					.filter(({ line }) =>
						/(?:fetch|useWebSocketUrl)\(\s*[`'"]\/api\//.test(line),
					)
					.map(({ file, lineNumber }) => `${file}:${lineNumber}`);
			});

		expect(offenders).toEqual([]);
	});
});
