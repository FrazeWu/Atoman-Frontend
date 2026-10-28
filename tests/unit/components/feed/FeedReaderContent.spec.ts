import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useSafeLink } from "@/composables/useSafeLink";

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedReaderContent from "../../../../src/components/feed/FeedReaderContent.vue";

describe("FeedReaderContent", () => {
	it("sanitizes unsafe markup and preserves semantic article structure", () => {
		const wrapper = mount(FeedReaderContent, {
			props: {
				html: '<h2>标题</h2><p style="color:red" onclick="alert(1)">正文</p><script>alert(1)</script><pre><code>const x = 1;\n  return x;</code></pre>',
			},
		});

		expect(wrapper.html()).toContain("<h2>标题</h2>");
		expect(wrapper.html()).toContain("const x = 1;\n  return x;");
		expect(wrapper.html()).not.toContain("<script");
		expect(wrapper.html()).not.toContain("onclick");
		expect(wrapper.html()).not.toContain("style=");
	});

	it("resolves relative image URLs against the source article URL", async () => {
		const wrapper = mount(FeedReaderContent, {
			props: {
				html: '<img src="/images/article-cover.jpg" alt="封面">',
				baseUrl: "https://source.example/articles/42",
			},
		});
		await nextTick();

		expect(wrapper.get("img").attributes("src")).toBe(
			"https://source.example/images/article-cover.jpg",
		);
	});

	it("adds copy controls, wide media treatment, and a scrollable table wrapper", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		const wrapper = mount(FeedReaderContent, {
			props: {
				html: '<pre><code>const answer = 42;</code></pre><img src="https://outside.example/chart.png" width="1200" height="600" alt="图表"><table><tr><th>标题</th><td>内容</td></tr></table>',
			},
		});
		await nextTick();

		expect(wrapper.get(".feed-reader-code-block pre").text()).toContain(
			"const answer = 42;",
		);
		await wrapper.get(".feed-reader-code-copy").trigger("click");
		expect(writeText).toHaveBeenCalledWith("const answer = 42;");
		expect(wrapper.get("img").classes()).toContain("feed-reader-media--wide");
		expect(
			wrapper.get(".feed-reader-table-wrap").attributes("aria-label"),
		).toContain("横向滚动");

		wrapper.unmount();
	});

	it("normalizes external links and reports failed images without layout overflow", async () => {
		const wrapper = mount(FeedReaderContent, {
			props: {
				html: '<p><a href="https://outside.example/post">外部链接</a></p><img src="https://outside.example/missing.jpg" alt="示例图" width="1200" height="800">',
			},
		});
		await nextTick();

		const link = wrapper.get("a");
		expect(link.attributes("target")).toBe("_blank");
		expect(link.attributes("rel")).toContain("noopener");

		const image = wrapper.get("img");
		expect(image.attributes("loading")).toBe("lazy");
		expect(image.classes()).toContain("feed-reader-image--sized");
		expect(image.attributes("style")).toContain(
			"--feed-reader-image-ratio: 1200 / 800",
		);
		await image.trigger("error");
		expect(wrapper.text()).toContain("图片无法加载：示例图");
		expect(image.classes()).toContain("feed-reader-image--failed");

		wrapper.unmount();
	});

	it("intercepts external link clicks and opens safe link dialog", async () => {
		const { safeLinkState, closeSafeLink } = useSafeLink();
		closeSafeLink();

		const wrapper = mount(FeedReaderContent, {
			props: {
				html: '<p><a href="https://outside.example/article" class="ext-link">外部文章</a><a href="/internal/path" class="int-link">内部链接</a></p>',
			},
		});
		await nextTick();

		// Click internal link - should not open safe link dialog
		await wrapper.get(".int-link").trigger("click");
		expect(safeLinkState.value.isOpen).toBe(false);

		// Click external link - should open safe link dialog
		await wrapper.get(".ext-link").trigger("click");
		expect(safeLinkState.value.isOpen).toBe(true);
		expect(safeLinkState.value.targetUrl).toBe("https://outside.example/article");
		expect(safeLinkState.value.targetHostname).toBe("outside.example");

		closeSafeLink();
		wrapper.unmount();
	});
});
