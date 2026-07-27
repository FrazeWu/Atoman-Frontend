# Design Spec: Button Slimming Refactor

We are refactoring the buttons in `Atoman-Frontend` to make them sleeker and less "chubby". This involves adjusting the height, horizontal padding, and font sizes across different button sizes for both desktop and mobile viewports.

## Affected Files
1. [PButton.vue](file:///root/Atoman/Atoman-Frontend/src/components/ui/PButton.vue) - Component-scoped button styles.
2. [style.css](file:///root/Atoman/Atoman-Frontend/src/style.css) - Global class-based button utility styles (`.a-btn`).

## Design Details

### 1. Desktop Button Specs (>= 768px)

| Size | Property | Current Value | Proposed Value |
| :--- | :--- | :--- | :--- |
| **Small (sm)** | Height | 32px (`2rem`) | **28px** (`1.75rem`) |
| | Horizontal Padding | 14px (`0.875rem`) | **12px** (`0.75rem`) |
| | Font Size | 10px (`var(--a-text-xs)`) | **11px** (`0.6875rem`) |
| **Medium (md)**| Height | 40px (`2.5rem`) | **36px** (`2.25rem`) |
| | Horizontal Padding | 20px (`1.25rem`) | **16px** (`1rem`) |
| | Font Size | 12px (`0.8125rem`) | **13px** (`0.8125rem`) |
| **Large (lg)** | Height | 48px (`3rem`) | **44px** (`2.75rem`) |
| | Horizontal Padding | 26px (`2rem`) | **20px** (`1.25rem`) |
| | Font Size | 13px (`var(--a-text-sm)`) | **15px** (`0.9375rem`) |

### 2. Mobile Button Specs (< 768px)

- **Small (sm)**: Height = **36px** (`2.25rem`), Font Size = **12px**
- **Medium (md)**: Height = **40px** (`2.5rem`), Font Size = **13px**
- **Large (lg)**: Height remains same as desktop (**44px**)

## Testing Plan
- Verify visually using Vite dev server.
- Verify unit tests/type-check pass.
