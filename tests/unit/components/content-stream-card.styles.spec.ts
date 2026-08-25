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

const contentStreamRule = contentCardSource.match(
  /\.p-entry\.content-stream-entry \{[\s\S]*?\n\}/,
)?.[0] ?? "";
const shortNoteRule = shortNoteCardSource.match(
  /\.sticky-memo-card \{[\s\S]*?\n\}/,
)?.[0] ?? "";
const portalStreamRule = portalSource.match(
  /\.feed-timeline-box \{[\s\S]*?\n\}/,
)?.[0] ?? "";

describe("content stream card styles", () => {
  it("keeps article and feed entries unframed", () => {
    expect(contentStreamRule).toContain("border: 0;");
    expect(contentStreamRule).not.toMatch(/border-(top|right|bottom|left):/);
    expect(contentCardSource).not.toContain(
      ".p-entry.content-stream-entry:last-child",
    );
  });

  it("keeps short notes unframed", () => {
    expect(shortNoteRule).toContain("border: 0;");
    expect(shortNoteRule).not.toMatch(/border-(top|right|bottom|left):/);
    expect(shortNoteCardSource).not.toContain(".sticky-memo-card:last-child");
  });

  it("does not frame portal content streams", () => {
    expect(portalStreamRule).toContain("border: 0;");
    expect(portalStreamRule).toContain("border-radius: 0;");
    expect(portalStreamRule).toContain("overflow: visible;");
  });
});
