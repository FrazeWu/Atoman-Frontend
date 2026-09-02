import { describe, expect, it } from "vitest";
import {
  moduleNavOrder,
  moduleRooms,
  topbarNavOrder,
} from "@/config/moduleRooms";
import { moduleFeatureRoutes } from "@/router/routes/modules";
import { buildAppRoutes } from "@/router/buildAppRoutes";
import { mergeSiteAccess, siteAccessFeatures } from "@/config/siteAccess";
import { getMobileMoreItems, getMobilePrimaryTabs } from "@/composables/useResponsiveShell";

describe("books module foundation", () => {
  it("exposes a compact books room in shared navigation config", () => {
    expect(moduleRooms.books).toMatchObject({
      name: "读书",
      helper: "书目与阅读",
      publicPathSegment: "books",
      homePath: "/",
    });
    expect(moduleNavOrder).toContain("books");
    expect(topbarNavOrder).not.toContain("books");
  });

  it("keeps the books feature definitions but disables the module by default", () => {
    const access = mergeSiteAccess(null);

    expect(siteAccessFeatures.books).toEqual([
      { key: "books.submit", label: "提交书目" },
      { key: "books.review", label: "书目审核" },
      { key: "books.publish_asset", label: "发布公共正文" },
    ]);
    expect(access.modules.books.enabled).toBe(false);
    expect(access.modules.books.features).toEqual({
      "books.submit": true,
      "books.review": true,
      "books.publish_asset": true,
    });
  });

  it("does not register public books routes before the module launches", () => {
    expect(buildAppRoutes().some((route) => route.path === "/books")).toBe(false);
    expect(getMobilePrimaryTabs("books")).toEqual([]);
    expect(getMobileMoreItems().some((item) => item.module === "books")).toBe(false);
  });

  it("registers public and authenticated book route groups with feature gates", () => {
    const root = moduleFeatureRoutes.books.find((route) => route.path === "/");
    expect(root).toBeDefined();
    const children = root?.children ?? [];
    expect(children.map((route) => route.path)).toEqual([
      "",
      "search",
      "work/:workId",
      "edition/:editionId",
      "library",
      "import/:importId",
      "read/:assetId",
      "public-read/:assetId",
      "contributions",
      "review",
    ]);
    expect(
      children.find((route) => route.path === "library")?.meta?.requiresAuth,
    ).toBe(true);
    expect(
      children.find((route) => route.path === "contributions")?.meta
        ?.featureGate,
    ).toEqual({
      module: "books",
      feature: "books.submit",
    });
    expect(
      children.find((route) => route.path === "review")?.meta?.featureGate,
    ).toEqual({
      module: "books",
      feature: "books.review",
    });
  });
});
