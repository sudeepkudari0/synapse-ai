import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from default ".env" file.
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
    testDir: './e2e',
    timeout: 60000,
    fullyParallel: false, // Electron apps should run sequentially
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Run one test at a time for Electron
    reporter: [
        ['html'],
        ['json', { outputFile: 'e2e/reports/test-results.json' }],
        ['list'], // Console output
    ],

    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'electron-smoke',
            testMatch: 'app.spec.ts',
            timeout: 30000,
        },
        {
            name: 'mock-interview',
            testMatch: 'mock-interview.spec.ts',
            timeout: 300000, // 5 minutes — STT model load + multiple transcriptions + LLM calls
        },
        {
            name: 'visual',
            testMatch: 'visual-interview.spec.ts',
            timeout: 300000,
        },
    ],
});
