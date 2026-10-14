import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const local = '/opt/pw-browsers/chromium';
const executablePath = process.env.CI ? undefined : existsSync(local) ? local : undefined;

export default defineConfig({
  testDir: '.',
  testMatch: 'trial.spec.ts',
  timeout: 300000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4180/',
    viewport: { width: 1000, height: 700 },
    launchOptions: {
      executablePath,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'],
    },
  },
  webServer: {
    command: 'npx vite preview --config trial/vite.config.ts --port 4180 --strictPort',
    cwd: '..',
    url: 'http://localhost:4180/sigma.html',
    reuseExistingServer: true,
  },
});
