import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.int.test.ts'],
    environment: 'node',
    setupFiles: ['./src/test/setup-int.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
