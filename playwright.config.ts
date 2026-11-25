import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run dev -- --host 127.0.0.1 --port 4179 --strictPort",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-1080p",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "mobile-390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-393",
      use: {
        browserName: "chromium",
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-430",
      use: {
        browserName: "chromium",
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
