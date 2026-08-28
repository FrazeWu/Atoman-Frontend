import { readFileSync } from "node:fs";
import path from "node:path";

const contentCardSource = readFileSync(
  path.resolve(process.cwd(), "src/components/ui/PContentCard.vue"),
  "utf8",
);
const shortNoteCardSource = readFileSync(
  path.resolve(process.cwd(), "src/components/shortnote/ShortNoteCard.vue"),
  "utf8",
);
const portalSource = readFileSync(
  path.resolve(process.cwd(), "src/views/portal/PortalView.vue"),
  "utf8",
);

const contentStreamRule =
  contentCardSource.match(
    /\.p-entry\.content-stream-entry \{[\s\S]*?\n\}/,
  )?.[0] ?? "";
const shortNoteRule =
  shortNoteCardSource.match(/\.sticky-memo-card \{[\s\S]*?\n\}/)?.[0] ?? "";
const portalStreamRule =
  portalSource.match(/\.feed-timeline-box \{[\s\S]*?\n\}/)?.[0] ?? "";

describe("content stream card styles", () => {
  it("uses single top and bottom separators for article and feed entries", () => {
    expect(contentStreamRule).toContain("border: 0;");
    expect(contentStreamRule).toContain(
      "border-top: 1px solid color-mix(in srgb, var(--a-color-text) 6%, transparent);",
    );
    expect(contentStreamRule).not.toMatch(/border-(right|left):/);
    expect(contentCardSource).toContain(
      ".p-entry.content-stream-entry:not(:has(~ .p-entry.content-stream-entry)) {\n  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 6%, transparent);",
    );
  });

  it("uses the same compact avatar-to-content gap as short-note headers", () => {
    expect(contentCardSource).toContain(
      ".p-entry.content-stream-entry .p-entry__body {\n  gap: 0.35rem;",
    );
  });

  it("uses single top and bottom separators for short notes", () => {
    expect(shortNoteRule).toContain("border: 0;");
    expect(shortNoteRule).toContain(
      "border-top: 1px solid var(--a-color-border-soft);",
    );
    expect(shortNoteRule).not.toMatch(/border-(right|left):/);
    expect(shortNoteCardSource).toContain(
      ".sticky-memo-card:not(:has(~ .sticky-memo-card)) {\n  border-bottom: 1px solid var(--a-color-border-soft);",
    );
  });

  it("does not frame portal content streams", () => {
    expect(portalStreamRule).toContain("border: 0;");
    expect(portalStreamRule).toContain("border-radius: 0;");
    expect(portalStreamRule).toContain("overflow: visible;");
  });
});
