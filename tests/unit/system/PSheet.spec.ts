import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount, config } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { nextTick } from "vue";
// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import PSheet from "../../../src/components/ui/PSheet.vue";

config.global.plugins = [createTestingPinia({ stubActions: false })];

describe("PSheet.vue", () => {
	it("keeps the desktop sidebar outside of the sheet backdrop", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/ui/PSheet.vue"),
			"utf8",
		);

		expect(source).toMatch(
			/\.p-sheet-backdrop\s*\{[\s\S]*?left:\s*var\(--a-sidebar-width\)/,
		);
		expect(source).toMatch(
			/@media \(max-width: 767px\)[\s\S]*?\.p-sheet-backdrop\s*\{[\s\S]*?left:\s*0/,
		);
		expect(source).toMatch(
			/\.p-sheet-panel\s*\{[\s\S]*?transition:[^;]*left 200ms ease/,
		);
		expect(source).toMatch(
			/\.slide-right-enter-active\s*\{[\s\S]*?animation:\s*p-sheet-right-enter 520ms/,
		);
		expect(source).toMatch(
			/\.slide-right-enter-from,[\s\S]*?transform:\s*translateX\(100%\)/,
		);
		expect(source).toMatch(
			/@keyframes p-sheet-right-enter\s*\{[\s\S]*?72%\s*\{[\s\S]*?transform:\s*translateX\(-1\.25rem\)/,
		);
		expect(source).toMatch(
			/\.slide-right-leave-active\s*\{[\s\S]*?transition:\s*transform 380ms/,
		);
		expect(source).toMatch(
			/<Transition :name="transitionName" appear>\s*<section\s+v-if="isMobile && show"/,
		);
		expect(source).toMatch(
			/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.slide-right-enter-active\s*\{[\s\S]*?animation:\s*none/,
		);
	});

	it("renders body content and the vertical page rail", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, title: "TEST TITLE" },
			slots: {
				default: "<p>Sheet body</p>",
			},
		});
		expect(wrapper.find(".p-sheet-panel").exists()).toBe(true);
		expect(wrapper.text()).toContain("Sheet body");
		expect(wrapper.get(".sheet-layer-title").text()).toBe("TEST TITLE");
		expect(wrapper.find(".sheet-header").exists()).toBe(false);
		expect(wrapper.find(".sheet-close-btn-bookmark").exists()).toBe(true);
		expect(wrapper.get(".p-sheet-panel").attributes("aria-label")).toBe(
			"TEST TITLE",
		);
	});

	it("keeps the close control and title centered as one group", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/ui/PSheet.vue"),
			"utf8",
		);

		expect(source).toMatch(
			/\.sheet-layer-rail\s*\{[\s\S]*?align-items:\s*center/,
		);
		expect(source).toMatch(/\.sheet-layer-rail\s*\{[\s\S]*?width:\s*32px/);
		expect(source).toMatch(
			/\.sheet-layer-controls\s*\{[\s\S]*?flex-direction:\s*column[\s\S]*?align-self:\s*center[\s\S]*?align-items:\s*flex-start/,
		);
		expect(source).not.toMatch(
			/\.sheet-layer-rail \.sheet-close-btn-bookmark\s*\{/,
		);
	});

	it("renders custom header content when header slot is provided", () => {
		const wrapper = mount(PSheet, {
			props: { show: true },
			slots: {
				header: "<strong>Custom header</strong>",
			},
		});
		expect(wrapper.text()).toContain("Custom header");
		expect(wrapper.find(".sheet-content-header-inline").exists()).toBe(true);
	});

	it("centers header and body inside a configurable content width", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, contentMaxWidth: "64rem" },
			slots: {
				header: "<strong>Centered header</strong>",
				default: "<p>Centered body</p>",
			},
		});

		const content = wrapper.get(".sheet-content-inner");
		expect((content.element as HTMLElement).style.maxWidth).toBe("64rem");
		expect(content.text()).toContain("Centered header");
		expect(content.text()).toContain("Centered body");
	});

	it("keeps right sheets on the page rail when header close type is requested", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, closeType: "header", title: "Inspect" },
		});
		expect(wrapper.find(".sheet-content-header-inline").exists()).toBe(false);
		expect(wrapper.find(".sheet-close-btn-floating").exists()).toBe(false);
		expect(wrapper.find(".sheet-close-btn-bookmark").exists()).toBe(true);
		expect(wrapper.get(".sheet-content").classes()).toContain(
			"sheet-content--has-bookmark-close",
		);
	});

	it("applies shifted class when isShifted prop is true", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, isShifted: true },
		});
		expect(wrapper.find(".p-sheet-panel").classes()).toContain("is-shifted");
	});

	it("moves each new layer right by one tighter page rail", () => {
		const wrapper = mount(PSheet, {
			props: {
				show: true,
				width: "900px",
				isShifted: true,
				layerIndex: 0,
				stackSize: 3,
			},
		});

		const panel = wrapper.get(".p-sheet-panel").element as HTMLElement;
		expect(panel.style.left).toBe("calc(var(--a-sidebar-width) + 0px)");
		expect(panel.style.right).toBe("0px");
		expect(panel.style.width).toBe("auto");
	});

	it("raises the visual layer for stacked sheets", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, layerIndex: 1 },
		});

		expect(
			(wrapper.get(".p-sheet-panel").element as HTMLElement).style.zIndex,
		).toBe("calc(var(--a-z-sheet) + 1)");
	});

	it("keeps a partial sheet in the lower sheet's right gutter without a backdrop", async () => {
		const originalWidth = window.innerWidth;
		const originalHeight = window.innerHeight;
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

		const parentPanel = document.createElement("div");
		parentPanel.className = "p-sheet-panel";
		parentPanel.dataset.layerIndex = "0";
		const parentContent = document.createElement("div");
		parentContent.dataset.pSheetContent = "";
		parentPanel.append(parentContent);
		document.body.append(parentPanel);

		Object.defineProperty(parentPanel, "getBoundingClientRect", {
			configurable: true,
			value: () => ({ left: 0, right: 1000, top: 56, bottom: 800, width: 1000, height: 744 }),
		});
		Object.defineProperty(parentContent, "getBoundingClientRect", {
			configurable: true,
			value: () => ({ left: 100, right: 700, top: 56, bottom: 800, width: 600, height: 744 }),
		});

		const wrapper = mount(PSheet, {
			props: { show: true, mode: "partial", layerIndex: 1 },
		});
		await nextTick();
		await nextTick();

		const panel = wrapper.get(".p-sheet-panel").element as HTMLElement;
		expect(wrapper.get(".p-sheet-root").classes()).toContain("p-sheet-root--partial");
		expect(panel.style.left).toBe("740px");
		expect(panel.style.right).toBe("0px");
		expect(wrapper.find(".p-sheet-backdrop").exists()).toBe(false);

		wrapper.unmount();
		parentPanel.remove();
		Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
	});

	it("uses a standalone content anchor for a partial sheet", async () => {
		const originalWidth = window.innerWidth;
		const originalHeight = window.innerHeight;
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

		const anchor = document.createElement("article");
		document.body.append(anchor);
		Object.defineProperty(anchor, "getBoundingClientRect", {
			configurable: true,
			value: () => ({ left: 220, right: 800, top: 56, bottom: 800, width: 580, height: 744 }),
		});

		const wrapper = mount(PSheet, {
			props: { show: true, mode: "partial", partialAnchor: anchor },
		});
		await nextTick();
		await nextTick();

		const panel = wrapper.get(".p-sheet-panel").element as HTMLElement;
		expect(wrapper.get(".p-sheet-root").classes()).toContain("p-sheet-root--partial");
		expect(panel.style.left).toBe("839.2px");
		expect(panel.style.right).toBe("0px");
		expect(wrapper.find(".p-sheet-backdrop").exists()).toBe(false);

		wrapper.unmount();
		anchor.remove();
		Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
	});

	it("derives panel width from the left edge instead of custom widths", () => {
		const bottom = mount(PSheet, {
			props: {
				show: true,
				width: "900px",
				layerIndex: 0,
				stackSize: 3,
			},
		});
		const top = mount(PSheet, {
			props: {
				show: true,
				width: "900px",
				layerIndex: 2,
				stackSize: 3,
			},
		});

		expect((bottom.get(".p-sheet-panel").element as HTMLElement).style.left).toBe(
			"calc(var(--a-sidebar-width) + 0px)",
		);
		expect((top.get(".p-sheet-panel").element as HTMLElement).style.left).toBe(
			"calc(var(--a-sidebar-width) + 64px)",
		);
		expect((top.get(".p-sheet-panel").element as HTMLElement).style.top).toBe(
			"calc(64px)",
		);
	});

	it("ignores custom width for adaptive right sheets", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, width: "900px" },
		});
		const panel = wrapper.find(".p-sheet-panel").element as HTMLElement;
		expect(panel.style.width).toBe("auto");
		expect(panel.style.maxWidth).toBe("none");
	});

	it("uses compact content spacing when there is no header bar", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, title: "VIEW" },
		});
		expect(wrapper.find(".sheet-content").classes()).toContain(
			"sheet-content--compact",
		);
	});

	it("uses compact spacing for right sheets without a custom header slot", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, closeType: "header", title: "Inspect" },
		});
		expect(wrapper.find(".sheet-content").classes()).toContain(
			"sheet-content--compact",
		);
	});

	it("uses a header close affordance for bottom sheets by default", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true, side: "bottom", title: "MORE" },
			slots: {
				default: "<div>content</div>",
			},
		});

		const panel = wrapper.get(".p-sheet-panel");
		expect(panel.classes()).toContain("is-bottom");
		expect(wrapper.find(".sheet-content-header-inline").exists()).toBe(false);
		expect(wrapper.find(".sheet-close-btn-floating").exists()).toBe(true);
		expect(wrapper.find(".sheet-close-btn-bookmark").exists()).toBe(false);
		expect(wrapper.find(".sheet-content").classes()).not.toContain(
			"sheet-content--compact",
		);

		await wrapper.find(".sheet-close-btn-floating").trigger("click");
		expect(wrapper.emitted()).toHaveProperty("close");
	});

	it("emits close event when backdrop is clicked", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true },
		});
		await wrapper.find(".p-sheet-backdrop").trigger("click");
		expect(wrapper.emitted()).toHaveProperty("close");
	});

	it("does not close when the top right sheet empty area is clicked", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true, side: "right" },
		});

		await wrapper.get(".sheet-content").trigger("click");
		expect(wrapper.emitted("close")).toBeUndefined();
	});

	it("does not close a right sheet when its content is clicked", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true, side: "right", contentMaxWidth: "40rem" },
			slots: { default: '<button class="sheet-action">保存</button>' },
		});

		await wrapper.get(".sheet-action").trigger("click");
		expect(wrapper.emitted("close")).toBeUndefined();
	});

	it("emits close event from the page rail for right sheets", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true, closeType: "header" },
		});
		await wrapper.get(".sheet-close-btn-bookmark").trigger("click");
		expect(wrapper.emitted()).toHaveProperty("close");
	});

	it("emits close event when tab is clicked", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true, closeType: "bookmark" },
		});
		await wrapper.find(".sheet-close-btn-bookmark").trigger("click");
		expect(wrapper.emitted()).toHaveProperty("close");
	});

	it("calculates dynamic offsets based on index prop", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, index: 1 },
		});
		const panel = wrapper.find(".p-sheet-panel").element as HTMLElement;
		expect(panel.style.left).toBe("calc(var(--a-sidebar-width) + 32px)");
		expect(panel.style.width).toBe("auto");
	});

	it("defaults to index 0 styles", () => {
		const wrapper = mount(PSheet, {
			props: { show: true },
		});
		const panel = wrapper.find(".p-sheet-panel").element as HTMLElement;
		expect(panel.style.left).toBe("calc(var(--a-sidebar-width) + 0px)");
		expect(panel.style.width).toBe("auto");
	});

	it("exposes the top layer as a non-modal dialog so lower rails remain reachable", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, title: "专辑详情", isTopLayer: true, layerIndex: 2 },
		});
		const panel = wrapper.get(".p-sheet-panel");
		expect(panel.attributes("role")).toBe("dialog");
		expect(panel.attributes("aria-modal")).toBeUndefined();
		expect(panel.attributes("aria-label")).toBe("专辑详情");
		expect(panel.attributes("data-layer-index")).toBe("2");
	});

	it("keeps a lower rail actionable while making its content inert", async () => {
		const wrapper = mount(PSheet, {
			props: {
				show: true,
				title: "艺术家 · Kanye West",
				isShifted: true,
				isTopLayer: false,
				layerIndex: 0,
				stackSize: 3,
			},
			slots: { default: '<button class="body-action">正文操作</button>' },
		});

		const content = wrapper.get(".sheet-content");
		expect(content.attributes("inert")).toBeDefined();
		expect(content.attributes("aria-hidden")).toBe("true");
		expect(
			wrapper.get(".sheet-close-btn-bookmark").attributes("aria-label"),
		).toContain("及上方页面");

		await wrapper.get(".sheet-layer-title--action").trigger("click");
		expect(wrapper.emitted("activate")).toHaveLength(1);
	});

	it("prevents wheel scrolling on lower sheet layers", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, isTopLayer: false },
		});

		const event = new WheelEvent("wheel", { cancelable: true });
		wrapper.get(".p-sheet-panel").element.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it("keeps the active sheet content from chaining scroll to the page", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/ui/PSheet.vue"),
			"utf8",
		);

		expect(source).toMatch(
			/\.sheet-content\s*\{[\s\S]*?overscroll-behavior:\s*contain/,
		);
	});

	it("only lets the top layer close with Escape", async () => {
		const top = mount(PSheet, { props: { show: true, isTopLayer: true } });
		const shifted = mount(PSheet, { props: { show: true, isTopLayer: false } });
		await top.get(".p-sheet-panel").trigger("keydown", { key: "Escape" });
		await shifted.get(".p-sheet-panel").trigger("keydown", { key: "Escape" });
		expect(top.emitted("close")).toHaveLength(1);
		expect(shifted.emitted("close")).toBeUndefined();
	});

	it("uses a labelled icon close control", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, title: "历史记录", closeType: "header" },
		});
		expect(wrapper.get('[aria-label="关闭历史记录"]')).toBeTruthy();
		expect(wrapper.text()).not.toContain("CLOSE");
	});

	it("accepts a panel class and height for a constrained bottom sheet", () => {
		const wrapper = mount(PSheet, {
			props: {
				show: true,
				side: "bottom",
				panelClass: "site-footer-sheet",
				height: "400px",
			},
		});
		const panel = wrapper.get(".p-sheet-panel");
		expect(panel.classes()).toContain("site-footer-sheet");
		expect(panel.attributes("style")).toContain("height: 400px");
	});

	it("can render above player overlays when explicitly requested", () => {
		const wrapper = mount(PSheet, {
			props: { show: true, abovePlayer: true },
		});

		expect(wrapper.get(".p-sheet-root").classes()).toContain(
			"p-sheet-root--above-player",
		);
	});

	it("focuses the close control when a header sheet opens", async () => {
		const wrapper = mount(PSheet, {
			props: { show: true, side: "bottom", title: "关于" },
		});
		document.body.appendChild(wrapper.get(".p-sheet-root").element);

		await wrapper.setProps({ show: false });
		await wrapper.setProps({ show: true });
		await nextTick();

		const closeButton = document.querySelector(".sheet-close-btn-floating");
		expect(closeButton).toBeInstanceOf(HTMLButtonElement);
		expect(document.activeElement).toBe(closeButton);
		wrapper.unmount();
	});
	it("traps focus in the active sheet and restores it on close", async () => {
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.focus();
		const wrapper = mount(PSheet, {
			props: { show: true, side: "bottom", title: "关于" },
		});
		const panel = wrapper.get(".p-sheet-panel").element;
		document.body.appendChild(panel);
		await nextTick();
		const closeButton = panel.querySelector<HTMLButtonElement>(
			".sheet-close-btn-floating",
		);
		expect(closeButton).toBeInstanceOf(HTMLButtonElement);
		expect(document.activeElement).toBe(closeButton);

		panel.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
		);
		expect(document.activeElement).toBe(closeButton);

		await wrapper.setProps({ show: false });
		await nextTick();
		expect(document.activeElement).toBe(trigger);

		wrapper.unmount();
		trigger.remove();
	});
});
