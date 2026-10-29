if (typeof document === "undefined") {
  const { Window } = await import("happy-dom");
  const win = new Window();
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).HTMLButtonElement = win.HTMLButtonElement;
  (globalThis as any).HTMLInputElement = win.HTMLInputElement;
  (globalThis as any).KeyboardEvent = win.KeyboardEvent;
  (globalThis as any).FocusEvent = win.FocusEvent;
}

import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDialogFocus,
  isElementVisible,
  getFocusableElements,
  activeScrollLockCount,
  resetScrollLockForTesting,
} from "@/composables/useDialogFocus";

describe("useDialogFocus", () => {
  let container: HTMLDivElement;

  const flush = async () => {
    await nextTick();
    await nextTick();
  };

  beforeEach(() => {
    document.body.replaceChildren();
    container = document.createElement("div");
    document.body.appendChild(container);
    resetScrollLockForTesting();
  });

  afterEach(() => {
    document.body.replaceChildren();
    resetScrollLockForTesting();
    vi.clearAllMocks();
  });

  describe("isElementVisible", () => {
    it("returns false if element is disabled", () => {
      const btn = document.createElement("button");
      btn.disabled = true;
      container.appendChild(btn);
      expect(isElementVisible(btn)).toBe(false);

      const btnWithAttr = document.createElement("button");
      btnWithAttr.setAttribute("disabled", "");
      container.appendChild(btnWithAttr);
      expect(isElementVisible(btnWithAttr)).toBe(false);
    });

    it("returns false if element or ancestor has aria-hidden='true'", () => {
      const btn = document.createElement("button");
      btn.setAttribute("aria-hidden", "true");
      container.appendChild(btn);
      expect(isElementVisible(btn)).toBe(false);

      const wrapper = document.createElement("div");
      wrapper.setAttribute("aria-hidden", "true");
      const innerBtn = document.createElement("button");
      wrapper.appendChild(innerBtn);
      container.appendChild(wrapper);
      expect(isElementVisible(innerBtn)).toBe(false);
    });

    it("returns false if element or ancestor has inert", () => {
      const btn = document.createElement("button");
      btn.setAttribute("inert", "");
      container.appendChild(btn);
      expect(isElementVisible(btn)).toBe(false);

      const wrapper = document.createElement("div");
      wrapper.setAttribute("inert", "");
      const innerBtn = document.createElement("button");
      wrapper.appendChild(innerBtn);
      container.appendChild(wrapper);
      expect(isElementVisible(innerBtn)).toBe(false);
    });

    it("returns false if display is none or visibility is hidden", () => {
      const btn1 = document.createElement("button");
      btn1.style.display = "none";
      container.appendChild(btn1);
      expect(isElementVisible(btn1)).toBe(false);

      const btn2 = document.createElement("button");
      btn2.style.visibility = "hidden";
      container.appendChild(btn2);
      expect(isElementVisible(btn2)).toBe(false);
    });

    it("returns false for hidden input", () => {
      const input = document.createElement("input");
      input.type = "hidden";
      container.appendChild(input);
      expect(isElementVisible(input)).toBe(false);
    });

    it("checks checkVisibility if available", () => {
      const btn = document.createElement("button");
      container.appendChild(btn);
      (btn as any).checkVisibility = vi.fn(() => false);
      expect(isElementVisible(btn)).toBe(false);

      (btn as any).checkVisibility = vi.fn(() => true);
      expect(isElementVisible(btn)).toBe(true);
    });

    it("returns true for normal visible elements", () => {
      const btn = document.createElement("button");
      container.appendChild(btn);
      expect(isElementVisible(btn)).toBe(true);
    });
  });

  describe("getFocusableElements", () => {
    it("selects only visible and valid focusable elements", () => {
      container.innerHTML = `
        <a href="#test" id="link1">Link</a>
        <a id="link-no-href">No Href</a>
        <button id="btn1">Button 1</button>
        <button disabled id="btn-disabled">Disabled</button>
        <input type="text" id="input1" />
        <input type="hidden" id="input-hidden" />
        <select id="select1"><option>1</option></select>
        <textarea id="textarea1"></textarea>
        <div tabindex="0" id="div-tabindex">Tabindex 0</div>
        <div tabindex="-1" id="div-negative">Tabindex -1</div>
        <button style="display: none" id="btn-hidden">Hidden</button>
      `;

      const elements = getFocusableElements(container);
      const ids = elements.map((el) => el.id);

      expect(ids).toEqual([
        "link1",
        "btn1",
        "input1",
        "select1",
        "textarea1",
        "div-tabindex",
      ]);
    });
  });

  describe("Smart Initial Focus", () => {
    it("focuses specific HTMLElement when initialFocus is an element", async () => {
      const customBtn = document.createElement("button");
      customBtn.id = "custom-target";
      container.appendChild(customBtn);

      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close, { initialFocus: customBtn });

      open.value = true;
      await flush();
      expect(document.activeElement).toBe(customBtn);
    });

    it("focuses element returned by function when initialFocus is a function", async () => {
      const target = document.createElement("input");
      container.appendChild(target);

      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close, { initialFocus: () => target });

      open.value = true;
      await flush();
      expect(document.activeElement).toBe(target);
    });

    it("focuses close button when initialFocus === 'close-button'", async () => {
      container.innerHTML = `
        <button class="first-action">First Action</button>
        <button class="p-modal-close-floating" aria-label="关闭">Close</button>
      `;

      const closeBtn = container.querySelector(".p-modal-close-floating") as HTMLElement;
      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close, { initialFocus: "close-button" });

      open.value = true;
      await flush();
      expect(document.activeElement).toBe(closeBtn);
    });

    it("focuses first-input when initialFocus === 'first-input'", async () => {
      container.innerHTML = `
        <button class="first-action">First Action</button>
        <input type="text" id="username" />
      `;

      const input = container.querySelector("#username") as HTMLElement;
      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close, { initialFocus: "first-input" });

      open.value = true;
      await flush();
      expect(document.activeElement).toBe(input);
    });

    describe("default 'auto' initial focus hierarchy", () => {
      it("priority 1: focuses visible element with [autofocus]", async () => {
        container.innerHTML = `
          <button class="p-modal-close-floating" aria-label="关闭">Close</button>
          <input type="text" id="field1" />
          <button autofocus id="autofocus-btn">Autofocus Button</button>
        `;

        const open = ref(false);
        const root = ref<HTMLElement | null>(container);
        const close = vi.fn();

        useDialogFocus(open, root, close);

        open.value = true;
        await flush();
        expect(document.activeElement?.id).toBe("autofocus-btn");
      });

      it("priority 2: focuses form input over close button", async () => {
        container.innerHTML = `
          <button class="p-modal-close-floating" aria-label="关闭">Close</button>
          <input type="text" id="first-input" />
          <button class="p-button--primary">Submit</button>
        `;

        const open = ref(false);
        const root = ref<HTMLElement | null>(container);
        const close = vi.fn();

        useDialogFocus(open, root, close);

        open.value = true;
        await flush();
        expect(document.activeElement?.id).toBe("first-input");
      });

      it("priority 2: focuses primary action button over close button when no form input exists", async () => {
        container.innerHTML = `
          <button class="p-modal-close-floating" aria-label="关闭">Close</button>
          <button class="p-button--secondary">Cancel</button>
          <button class="p-button--primary" id="confirm-btn">Confirm</button>
        `;

        const open = ref(false);
        const root = ref<HTMLElement | null>(container);
        const close = vi.fn();

        useDialogFocus(open, root, close);

        open.value = true;
        await flush();
        expect(document.activeElement?.id).toBe("confirm-btn");
      });

      it("priority 3: focuses first visible focusable element if no form inputs or primary buttons", async () => {
        container.innerHTML = `
          <button class="sheet-close-btn-bookmark" aria-label="关闭" id="close-btn">Close</button>
        `;

        const open = ref(false);
        const root = ref<HTMLElement | null>(container);
        const close = vi.fn();

        useDialogFocus(open, root, close);

        open.value = true;
        await flush();
        expect(document.activeElement?.id).toBe("close-btn");
      });

      it("priority 4: focuses container itself if no focusable elements exist", async () => {
        container.innerHTML = `<p>Read-only message</p>`;

        const open = ref(false);
        const root = ref<HTMLElement | null>(container);
        const close = vi.fn();

        useDialogFocus(open, root, close);

        open.value = true;
        await flush();
        expect(document.activeElement).toBe(container);
        expect(container.getAttribute("tabindex")).toBe("-1");
      });
    });
  });

  describe("Focus Trap", () => {
    it("wraps Tab from last element to first element", () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      const first = container.querySelector("#first") as HTMLElement;
      const last = container.querySelector("#last") as HTMLElement;

      const open = ref(true);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      const { handleKeydown } = useDialogFocus(open, root, close);

      last.focus();
      expect(document.activeElement).toBe(last);

      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      handleKeydown(tabEvent);

      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);
    });

    it("wraps Shift+Tab from first element to last element", () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      const first = container.querySelector("#first") as HTMLElement;
      const last = container.querySelector("#last") as HTMLElement;

      const open = ref(true);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      const { handleKeydown } = useDialogFocus(open, root, close);

      first.focus();
      expect(document.activeElement).toBe(first);

      const shiftTabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      handleKeydown(shiftTabEvent);

      expect(shiftTabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it("focuses container on Tab if dialog has no focusable elements", () => {
      container.innerHTML = `<div>No interactive controls</div>`;

      const open = ref(true);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      const { handleKeydown } = useDialogFocus(open, root, close);

      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      handleKeydown(tabEvent);

      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(container);
    });

    it("global Escape listener calls close when active top layer", async () => {
      const open = ref(true);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close);
      await flush();

      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(close).toHaveBeenCalledTimes(1);
    });

    it("global focusin interceptor redirects focus back into dialog if top layer", async () => {
      container.innerHTML = `<button id="dialog-btn">Inside Dialog</button>`;
      const outsideBtn = document.createElement("button");
      outsideBtn.id = "outside-btn";
      document.body.appendChild(outsideBtn);

      const open = ref(true);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close);
      await flush();

      const dialogBtn = container.querySelector("#dialog-btn") as HTMLElement;

      // Simulate focus escaping to outside button
      const focusinEvent = new FocusEvent("focusin", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(focusinEvent, "target", { value: outsideBtn });
      document.dispatchEvent(focusinEvent);

      expect(document.activeElement).toBe(dialogBtn);
    });
  });

  describe("Focus Restoration Stack", () => {
    it("restores focus to previous active element on close and unmount", async () => {
      const trigger = document.createElement("button");
      trigger.id = "trigger-btn";
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      container.innerHTML = `<button id="inside">Inside</button>`;
      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close);

      open.value = true;
      await flush();
      expect(document.activeElement?.id).toBe("inside");

      open.value = false;
      await flush();
      expect(document.activeElement).toBe(trigger);
    });

    it("supports stacked dialog focus restoration", async () => {
      const trigger = document.createElement("button");
      trigger.id = "root-trigger";
      document.body.appendChild(trigger);
      trigger.focus();

      const dialogA = document.createElement("div");
      dialogA.innerHTML = `<button id="btn-a">Dialog A Button</button>`;
      document.body.appendChild(dialogA);

      const dialogB = document.createElement("div");
      dialogB.innerHTML = `<button id="btn-b">Dialog B Button</button>`;
      document.body.appendChild(dialogB);

      const openA = ref(false);
      const rootA = ref<HTMLElement | null>(dialogA);
      const closeA = vi.fn();
      useDialogFocus(openA, rootA, closeA);

      const openB = ref(false);
      const rootB = ref<HTMLElement | null>(dialogB);
      const closeB = vi.fn();
      useDialogFocus(openB, rootB, closeB);

      // Open Dialog A
      openA.value = true;
      await flush();
      expect(document.activeElement?.id).toBe("btn-a");

      // Open Dialog B
      openB.value = true;
      await flush();
      expect(document.activeElement?.id).toBe("btn-b");

      // Close Dialog B -> restores to Dialog A button
      openB.value = false;
      await flush();
      expect(document.activeElement?.id).toBe("btn-a");

      // Close Dialog A -> restores to root trigger
      openA.value = false;
      await flush();
      expect(document.activeElement?.id).toBe("root-trigger");
    });
  });

  describe("Body Scroll Lock", () => {
    it("locks body scroll on open and unlocks on close", async () => {
      expect(activeScrollLockCount).toBe(0);
      expect(document.body.style.overflow).toBe("");

      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      const close = vi.fn();

      useDialogFocus(open, root, close);

      open.value = true;
      await flush();
      expect(activeScrollLockCount).toBe(1);
      expect(document.body.style.overflow).toBe("hidden");

      open.value = false;
      await flush();
      expect(activeScrollLockCount).toBe(0);
      expect(document.body.style.overflow).toBe("");
    });

    it("handles stacked dialog scroll locks correctly", async () => {
      const open1 = ref(false);
      const open2 = ref(false);
      const root1 = ref<HTMLElement | null>(container);
      const root2 = ref<HTMLElement | null>(container);

      useDialogFocus(open1, root1, vi.fn());
      useDialogFocus(open2, root2, vi.fn());

      open1.value = true;
      await flush();
      expect(activeScrollLockCount).toBe(1);
      expect(document.body.style.overflow).toBe("hidden");

      open2.value = true;
      await flush();
      expect(activeScrollLockCount).toBe(2);
      expect(document.body.style.overflow).toBe("hidden");

      open2.value = false;
      await flush();
      expect(activeScrollLockCount).toBe(1);
      expect(document.body.style.overflow).toBe("hidden");

      open1.value = false;
      await flush();
      expect(activeScrollLockCount).toBe(0);
      expect(document.body.style.overflow).toBe("");
    });

    it("respects lockScroll: false", async () => {
      const open = ref(false);
      const root = ref<HTMLElement | null>(container);
      useDialogFocus(open, root, vi.fn(), { lockScroll: false });

      open.value = true;
      await flush();
      expect(activeScrollLockCount).toBe(0);
      expect(document.body.style.overflow).toBe("");
    });
  });
});
