import { describe, expect, it } from "vitest";
import { sensitiveAuthArtifacts } from "../../../scripts/check-sensitive-artifacts";

describe("sensitive browser artifacts", () => {
  it.each(["tests/e2e/.auth/admin.json", "tests/e2e/.auth/user.json", "playwright/.auth/session.json", ".auth/state.json", "nested/.auth/token.txt", "tests\\e2e\\.auth\\admin.json"])("blocks %s", (path) => {
    expect(sensitiveAuthArtifacts([path])).toEqual([path]);
  });
  it("allows test code and public configuration", () => {
    expect(sensitiveAuthArtifacts(["tests/e2e/auth.setup.ts", "src/api/auth.ts", ".env.example", ".env.production", "README.md"])).toEqual([]);
  });
});
