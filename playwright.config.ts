import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    video: "on",
    trace: "on",
    // Willkommens-Dialog (Hilfe & Support) in allen Tests aus; e2e/help.spec.ts schaltet ihn gezielt ein.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [{ name: "class-y:e2e-skip-onboarding", value: "1" }],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
