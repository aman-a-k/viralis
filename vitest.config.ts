import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      // Integration tests run against a disposable database (never production).
      DATABASE_URL: process.env.TEST_DATABASE_URL || '',
      DIRECT_URL: process.env.TEST_DATABASE_URL || '',
      ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
      NEXTAUTH_SECRET: 'test-secret',
    },
  },
});
