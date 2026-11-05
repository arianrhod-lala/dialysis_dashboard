import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  use: {
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    locale: "en-US",
  },
});
