import { describe, expect, it } from "vitest";
import {
	moduleNavOrder,
	moduleRooms,
	topbarNavOrder,
} from "../../../packages/module-config/src/index";

describe("@atoman/module-config", () => {
	it("keeps module identity and navigation order in a UI-independent package", () => {
		expect(moduleRooms.feed.publicPathSegment).toBe("feed");
		expect(moduleRooms.blog.publicPathSegment).toBe("posts");
		expect(moduleRooms.books.publicPathSegment).toBe("books");
		expect(moduleNavOrder).toEqual([
			"feed",
			"blog",
			"books",
			"music",
			"forum",
			"debate",
			"timeline",
			"podcast",
			"video",
		]);
		expect(topbarNavOrder).toEqual([
			"feed",
			"blog",
			"books",
			"music",
			"video",
			"podcast",
			"forum",
			"debate",
			"timeline",
		]);
	});
});
