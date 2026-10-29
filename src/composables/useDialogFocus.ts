import {
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  unref,
  watch,
  type Ref,
} from "vue";

export interface UseDialogFocusOptions {
  preventScroll?: boolean;
  initialFocus?:
    | "auto"
    | "first-input"
    | "close-button"
    | HTMLElement
    | (() => HTMLElement | null);
  lockScroll?: boolean;
  isTopLayer?: boolean | Ref<boolean>;
}

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const CLOSE_BUTTON_SELECTOR = [
  '[aria-label="关闭"]',
  ".p-modal-close-floating",
  ".sheet-close-btn-bookmark",
].join(",");

export const FORM_INPUT_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  "textarea:not([disabled])",
  "select:not([disabled])",
].join(",");

export const PRIMARY_ACTION_SELECTOR = [
  'button[type="submit"]',
  ".p-button--primary",
  "[data-primary-action]",
  "button.primary",
].join(",");

export function isCloseButton(el: HTMLElement): boolean {
  return el.matches(CLOSE_BUTTON_SELECTOR) || Boolean(el.closest(CLOSE_BUTTON_SELECTOR));
}

export function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.hasAttribute("disabled") || (el as HTMLButtonElement | HTMLInputElement).disabled) {
    return false;
  }
  if (el instanceof HTMLInputElement && el.type === "hidden") {
    return false;
  }
  if (el.getAttribute("aria-hidden") === "true" || Boolean(el.closest?.('[aria-hidden="true"]'))) {
    return false;
  }
  if (el.hasAttribute("inert") || (el as any).inert || Boolean(el.closest?.("[inert]"))) {
    return false;
  }
  if (el.style.display === "none" || el.style.visibility === "hidden") {
    return false;
  }
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const style = window.getComputedStyle(el);
    if (style && (style.display === "none" || style.visibility === "hidden")) {
      return false;
    }
  }
  if (typeof el.checkVisibility === "function") {
    try {
      if (!el.checkVisibility()) {
        return false;
      }
    } catch {
      // In case checkVisibility throws in mock/unsupported environments
    }
  }
  return true;
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return elements.filter(isElementVisible);
}

let originalBodyOverflow = "";
export let activeScrollLockCount = 0;
const activeDialogStack: symbol[] = [];

export function resetScrollLockForTesting(): void {
  activeScrollLockCount = 0;
  originalBodyOverflow = "";
  activeDialogStack.length = 0;
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
  }
}

export function useDialogFocus(
  open: Readonly<Ref<boolean>>,
  root: Ref<HTMLElement | null>,
  close: () => void,
  options: UseDialogFocusOptions = {},
) {
  const dialogId = Symbol("dialog");
  let previousFocus: HTMLElement | null = null;
  let hasLockedScroll = false;
  let isListening = false;

  const isCurrentTopLayer = (): boolean => {
    if (options.isTopLayer !== undefined) {
      return Boolean(unref(options.isTopLayer));
    }
    return activeDialogStack[activeDialogStack.length - 1] === dialogId;
  };

  const lockBodyScroll = () => {
    if (options.lockScroll === false) return;
    if (hasLockedScroll) return;
    hasLockedScroll = true;
    if (typeof document !== "undefined" && document.body) {
      if (activeScrollLockCount === 0) {
        originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
    }
    activeScrollLockCount++;
  };

  const unlockBodyScroll = () => {
    if (!hasLockedScroll) return;
    hasLockedScroll = false;
    activeScrollLockCount = Math.max(0, activeScrollLockCount - 1);
    if (typeof document !== "undefined" && document.body) {
      if (activeScrollLockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        originalBodyOverflow = "";
      }
    }
  };

  const pushToStack = () => {
    if (!activeDialogStack.includes(dialogId)) {
      activeDialogStack.push(dialogId);
    }
  };

  const removeFromStack = () => {
    const idx = activeDialogStack.indexOf(dialogId);
    if (idx !== -1) {
      activeDialogStack.splice(idx, 1);
    }
  };

  const restoreFocus = () => {
    const target = previousFocus;
    previousFocus = null;
    if (target?.isConnected) {
      target.focus({ preventScroll: options.preventScroll });
    }
  };

  const focusDialog = async () => {
    await nextTick();
    if (!root.value) return;

    const initial = options.initialFocus ?? "auto";

    if (initial instanceof HTMLElement && initial.isConnected) {
      initial.focus({ preventScroll: options.preventScroll });
      return;
    }

    if (typeof initial === "function") {
      const el = initial();
      if (el instanceof HTMLElement && el.isConnected) {
        el.focus({ preventScroll: options.preventScroll });
        return;
      }
    }

    if (initial === "close-button") {
      const closeButtons = Array.from(
        root.value.querySelectorAll<HTMLElement>(CLOSE_BUTTON_SELECTOR),
      ).filter(isElementVisible);
      if (closeButtons.length > 0) {
        closeButtons[0].focus({ preventScroll: options.preventScroll });
        return;
      }
    }

    if (initial === "first-input") {
      const formInputs = Array.from(
        root.value.querySelectorAll<HTMLElement>(FORM_INPUT_SELECTOR),
      ).filter(isElementVisible);
      if (formInputs.length > 0) {
        formInputs[0].focus({ preventScroll: options.preventScroll });
        return;
      }
    }

    // Default 'auto' hierarchy:
    // 1. Visible element with [autofocus]
    const autofocusElements = Array.from(
      root.value.querySelectorAll<HTMLElement>("[autofocus]"),
    ).filter(isElementVisible);
    if (autofocusElements.length > 0) {
      autofocusElements[0].focus({ preventScroll: options.preventScroll });
      return;
    }

    // 2. Form input or primary action button (excluding close buttons)
    const formInputs = Array.from(
      root.value.querySelectorAll<HTMLElement>(FORM_INPUT_SELECTOR),
    ).filter((el) => isElementVisible(el) && !isCloseButton(el));
    if (formInputs.length > 0) {
      formInputs[0].focus({ preventScroll: options.preventScroll });
      return;
    }

    const primaryActions = Array.from(
      root.value.querySelectorAll<HTMLElement>(PRIMARY_ACTION_SELECTOR),
    ).filter((el) => isElementVisible(el) && !isCloseButton(el));
    if (primaryActions.length > 0) {
      primaryActions[0].focus({ preventScroll: options.preventScroll });
      return;
    }

    // 3. First visible focusable element
    const focusables = getFocusableElements(root.value);
    if (focusables.length > 0) {
      focusables[0].focus({ preventScroll: options.preventScroll });
      return;
    }

    // 4. Container itself if no focusable elements
    if (!root.value.hasAttribute("tabindex")) {
      root.value.setAttribute("tabindex", "-1");
    }
    root.value.focus({ preventScroll: options.preventScroll });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (!isCurrentTopLayer()) return;
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;

    const elements = getFocusableElements(root.value);
    if (elements.length === 0) {
      event.preventDefault();
      if (root.value) {
        if (!root.value.hasAttribute("tabindex")) {
          root.value.setAttribute("tabindex", "-1");
        }
        root.value.focus({ preventScroll: options.preventScroll });
      }
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || active === root.value || !root.value?.contains(active)) {
        event.preventDefault();
        last.focus({ preventScroll: options.preventScroll });
      }
    } else {
      if (active === last || active === root.value || !root.value?.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: options.preventScroll });
      }
    }
  };

  const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (!isCurrentTopLayer()) return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    close();
  };

  const handleGlobalFocusIn = (event: FocusEvent) => {
    if (!isCurrentTopLayer()) return;
    if (!root.value) return;
    const target = event.target as HTMLElement | null;
    if (target && root.value.contains(target)) return;

    event.preventDefault();
    const elements = getFocusableElements(root.value);
    if (elements.length > 0) {
      elements[0].focus({ preventScroll: options.preventScroll });
    } else {
      if (!root.value.hasAttribute("tabindex")) {
        root.value.setAttribute("tabindex", "-1");
      }
      root.value.focus({ preventScroll: options.preventScroll });
    }
  };

  const attachListeners = () => {
    if (isListening) return;
    isListening = true;
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", handleGlobalKeydown);
      document.addEventListener("focusin", handleGlobalFocusIn);
    }
  };

  const detachListeners = () => {
    if (!isListening) return;
    isListening = false;
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", handleGlobalKeydown);
      document.removeEventListener("focusin", handleGlobalFocusIn);
    }
  };

  watch(
    open,
    (isOpen, wasOpen) => {
      if (isOpen) {
        previousFocus =
          document.activeElement instanceof HTMLElement &&
          document.activeElement.isConnected
            ? document.activeElement
            : null;
        pushToStack();
        lockBodyScroll();
        attachListeners();
        void focusDialog();
      } else if (wasOpen) {
        detachListeners();
        removeFromStack();
        unlockBodyScroll();
        restoreFocus();
      }
    },
    { immediate: true },
  );

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      detachListeners();
      removeFromStack();
      unlockBodyScroll();
      restoreFocus();
    });
  }

  return {
    handleKeydown,
    focusDialog,
    restoreFocus,
  };
}
