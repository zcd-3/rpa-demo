// @ts-check
import { defineConfig, devices } from "@playwright/test";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/mcp.test.js",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: "list",
  use: {
    locale: "zh-CN",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "Microsoft Edge",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.BROWSER_CHANNEL || "msedge",
      },
    },
  ],
  webServer: {
    command: `${npmCommand} --prefix ../seller-platform-simulator run dev`,
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
