import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function loadConfig() {
  vi.resetModules();
  return (await import("../../../playwright.smoke.config")).default;
}

describe("isolated smoke server configuration", () => {
  it("uses an owned loopback server and refuses port fallback", async () => {
    vi.stubEnv("PLAYWRIGHT_SMOKE_PORT", "54931");
    const config = await loadConfig();
    expect(config.use?.baseURL).toBe("http://127.0.0.1:54931");
    expect(config.webServer).toMatchObject({
      url: "http://127.0.0.1:54931/", reuseExistingServer: false,
      command: expect.stringContaining("--port 54931 --strictPort"),
    });
  });
  it.each(["0", "65536", "1.5", "invalid", "5175;echo unsafe"])("rejects invalid port %s", async (port) => {
    vi.stubEnv("PLAYWRIGHT_SMOKE_PORT", port);
    await expect(loadConfig()).rejects.toThrow("PLAYWRIGHT_SMOKE_PORT");
  });
});
