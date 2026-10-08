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
      name: "书籍",
      helper: "书目与阅读",
      publicPathSegment: "books",
      homePath: "/",
    });
    expect(moduleNavOrder).toContain("books");
    expect(topbarNavOrder).toEqual(["feed", "blog", "music", "video", "podcast", "books"]);
  });

  it("keeps the books feature definitions and enables the module by default", () => {
    const access = mergeSiteAccess(null);

    expect(siteAccessFeatures.books).toEqual([
      { key: "books.submit", label: "提交书目" },
      { key: "books.review", label: "书目审核" },
      { key: "books.publish_asset", label: "发布公共正文" },
    ]);
    expect(access.modules.books.enabled).toBe(true);
    expect(access.modules.books.features).toEqual({
      "books.submit": true,
      "books.review": true,
      "books.publish_asset": true,
    });
  });

  it("keeps books enabled by default while retaining its routes and navigation", () => {
    const access = mergeSiteAccess(null);

    expect(access.modules.books.enabled).toBe(true);
    expect(buildAppRoutes().some((route) => route.path === "/books")).toBe(true);
    expect(getMobilePrimaryTabs("books").length).toBeGreaterThan(0);
    expect(getMobileMoreItems().some((item) => item.module === "books")).toBe(true);
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

  it("keeps discovery mounted under route-driven detail sheets", () => {
    const children = moduleFeatureRoutes.books[0].children ?? [];
    const home = children.find(route => route.path === "")?.component;
    for (const path of ["work/:workId", "edition/:editionId"]) {
      const detail = children.find(route => route.path === path);
      expect(detail?.components?.default).toBe(home);
      expect(detail?.components?.overlay).toBeDefined();
    }
  });
});
