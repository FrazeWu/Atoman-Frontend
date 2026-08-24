import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getAdminUser,
	listAdminUserAuditLogs,
	listAdminUserLoginEvents,
	listAdminUserSessions,
	revokeAdminUserSession,
	revokeAllAdminUserSessions,
} from "../../../src/api/adminUsers";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import AdminUserDetailSheet from "@/components/admin/AdminUserDetailSheet.vue";

vi.mock("@/api/adminUsers", () => ({
	getAdminUser: vi.fn(),
	listAdminUserLoginEvents: vi.fn(),
	listAdminUserSessions: vi.fn(),
	listAdminUserAuditLogs: vi.fn(),
	revokeAdminUserSession: vi.fn(),
	revokeAllAdminUserSessions: vi.fn(),
}));

const detail = {
	uuid: "member-id",
	username: "alice",
	email: "alice@example.com",
	display_name: "Alice",
	avatar_url: "",
	role: "user" as const,
	is_active: true,
	last_login_at: "2026-07-31T10:00:00Z",
	last_login_ip: "203.0.113.19",
	last_login_location: "Berlin · DE",
	active_sessions: 1,
	created_at: "2026-07-01T10:00:00Z",
	updated_at: "2026-07-01T10:00:00Z",
	bio: "",
	website: "",
	profile_location: "",
	has_password: true,
	auth_providers: ["github"],
};

const stubs = {
	PSheet: defineComponent({
		props: ["show"],
		emits: ["close"],
		template: '<section v-if="show"><slot name="header" /><slot /></section>',
	}),
	PAvatar: defineComponent({ template: "<span />" }),
	PBadge: defineComponent({ template: "<span><slot /></span>" }),
	PButton: defineComponent({
		inheritAttrs: false,
		props: ["disabled", "loading"],
		emits: ["click"],
		template:
			'<button v-bind="$attrs" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
	}),
	PTab: defineComponent({
		inheritAttrs: false,
		props: ["label"],
		emits: ["click"],
		template:
			'<button v-bind="$attrs" @click="$emit(\'click\', $event)">{{ label }}</button>',
	}),
	PEmpty: defineComponent({ props: ["text"], template: "<p>{{ text }}</p>" }),
	PaginationBar: defineComponent({ template: "<footer />" }),
	PConfirm: defineComponent({
		props: ["show"],
		emits: ["confirm", "cancel"],
		template:
			'<button v-if="show" data-test="confirm-revoke" @click="$emit(\'confirm\')">确认</button>',
	}),
};

describe("AdminUserDetailSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getAdminUser).mockResolvedValue(detail);
		vi.mocked(listAdminUserLoginEvents).mockResolvedValue({
			data: [
				{
					id: "event-id",
					session_id: "session-id",
					method: "password",
					result: "succeeded",
					ip_address: "203.0.113.19",
					ip_prefix: "203.0.113.0/24",
					location: "Berlin · DE",
					device_name: "Mac 浏览器",
					user_agent: "Mozilla/5.0",
					created_at: "2026-07-31T10:00:00Z",
				},
			],
			meta: { page: 1, page_size: 20, total: 1, has_more: false },
		});
		vi.mocked(listAdminUserSessions).mockResolvedValue([
			{
				id: "session-id",
				kind: "web",
				device_name: "Mac 浏览器",
				user_agent: "Mozilla/5.0",
				ip_address: "203.0.113.19",
				ip_prefix: "203.0.113.0/24",
				location: "Berlin · DE",
				created_at: "2026-07-31T10:00:00Z",
				last_active_at: "2026-07-31T10:10:00Z",
			},
		]);
		vi.mocked(listAdminUserAuditLogs).mockResolvedValue({
			data: [],
			meta: { page: 1, page_size: 20, total: 0, has_more: false },
		});
		vi.mocked(revokeAdminUserSession).mockResolvedValue(undefined);
		vi.mocked(revokeAllAdminUserSessions).mockResolvedValue(undefined);
	});

	function mountSheet() {
		return mount(AdminUserDetailSheet, {
			props: { show: true, userId: "member-id", canManage: true },
			global: { stubs },
		});
	}

	it("loads the account overview and login history", async () => {
		const wrapper = mountSheet();
		await flushPromises();
		expect(wrapper.text()).toContain("203.0.113.19");
		expect(wrapper.text()).toContain("Berlin · DE");

		await wrapper.get('[data-test="detail-tab-logins"]').trigger("click");
		await flushPromises();
		expect(listAdminUserLoginEvents).toHaveBeenCalledWith("member-id", 1, 20);
		expect(wrapper.text()).toContain("登录成功");
		expect(wrapper.text()).toContain("Mac 浏览器");
	});

	it("revokes a selected session and refreshes the detail", async () => {
		vi.mocked(listAdminUserSessions)
			.mockResolvedValueOnce([
				{
					id: "session-id",
					kind: "web",
					device_name: "Mac 浏览器",
					user_agent: "Mozilla/5.0",
					ip_address: "203.0.113.19",
					ip_prefix: "203.0.113.0/24",
					location: "Berlin · DE",
					created_at: "2026-07-31T10:00:00Z",
					last_active_at: "2026-07-31T10:10:00Z",
				},
			])
			.mockResolvedValueOnce([]);
		const wrapper = mountSheet();
		await flushPromises();
		await wrapper.get('[data-test="detail-tab-sessions"]').trigger("click");
		await flushPromises();
		await wrapper
			.get('[data-test="revoke-session-session-id"]')
			.trigger("click");
		await wrapper.get('[data-test="confirm-revoke"]').trigger("click");
		await flushPromises();

		expect(revokeAdminUserSession).toHaveBeenCalledWith(
			"member-id",
			"session-id",
		);
		expect(listAdminUserSessions).toHaveBeenCalledTimes(2);
	});
});
