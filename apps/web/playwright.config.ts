import { defineConfig, devices } from "@playwright/test";

// Smoke test against a production build (`npm run build` first): `npm run e2e`.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, ...devices["Pixel 7"] },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `next start -p ${PORT}`, port: PORT, reuseExistingServer: true, timeout: 120_000 },
});
