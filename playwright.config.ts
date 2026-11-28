import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// E2E_PORT erlaubt einen zweiten Dev-Server (z. B. aus einem git worktree) neben Port 3000.
const port = process.env.E2E_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    video: "on",
    trace: "on",
    // Willkommens-Dialog (Hilfe & Support) in allen Tests aus; e2e/help.spec.ts schaltet ihn gezielt ein.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
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
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
