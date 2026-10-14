import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Cloud sessions cannot download Playwright's browser; they use the preinstalled one (docs/decisions.md, D12).
const local = '/opt/pw-browsers/chromium';
const executablePath = process.env.CI ? undefined : existsSync(local) ? local : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/graphview/',
    viewport: { width: 1280, height: 800 },
    launchOptions: { executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /(speed|large)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    // Speed and the largest graph run alone, after the other tests, so that they do not share the processors (G17).
    {
      name: 'speed',
      workers: 1,
      testMatch: /(speed|large)\.spec\.ts/,
      dependencies: ['chromium'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npx vite preview --config shell/vite.config.ts --port 4173 --strictPort',
    url: 'http://localhost:4173/graphview/',
    reuseExistingServer: !process.env.CI,
  },
});
