import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

// @ts-expect-error Vitest resolves the src alias outside tsconfig's src-only include.
import type { CommentDTO } from "@/api/comments";
// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import CommentItem from "@/components/comment/CommentItem.vue";

function makeComment(overrides: Partial<CommentDTO> = {}): CommentDTO {
	return {
		id: "comment-1",
		author_id: "user-1",
		author: {
			id: "user-1",
			username: "author",
			display_name: "Author",
			avatar_url: "",
		},
		root_id: null,
		reply_to_id: null,
		reply_to_author: null,
		floor_number: 1,
		content: "comment",
		rendered_html: "<p>comment</p>",
		status: "active",
		edited_at: null,
		like_count: 0,
		reply_count: 0,
		hot_score: 0,
		created_at: "2026-01-01T00:00:00Z",
		marked: false,
		liked: false,
		mentions: [],
		references: [],
		attachments: [],
		time_anchors: [],
		replies: [],
		...overrides,
	};
}

describe("CommentItem", () => {
	it("将已清洗的 Markdown 渲染为结构化节点", () => {
		const wrapper = mount(CommentItem, {
			props: { comment: makeComment({ content: "这是 **重点**" }) },
			global: { stubs: { PAvatar: true, UserSummaryCard: true } },
		});

		expect(wrapper.get('[data-test="comment-content"]').text()).toBe(
			"这是 重点",
		);
		expect(wrapper.find('[data-test="comment-content"] strong').text()).toBe(
			"重点",
		);
	});

	it("作者不显示举报，自动折叠评论不显示回复操作", () => {
		const wrapper = mount(CommentItem, {
			props: {
				comment: makeComment({ status: "auto_folded", reply_count: 2 }),
				authenticated: true,
				currentUserId: "user-1",
				canReply: true,
			},
			global: { stubs: { PAvatar: true, UserSummaryCard: true } },
		});

		expect(wrapper.find('button[title="举报"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="reply-comment"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="reveal-comment"]').exists()).toBe(true);
	});
});
