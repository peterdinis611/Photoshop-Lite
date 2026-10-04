import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@photoshop-lite/shared-types': resolve(root, 'libs/shared/types/src/index.ts'),
      '@photoshop-lite/ai': resolve(root, 'libs/ai/src/index.ts'),
    },
  },
  test: {
    name: '@photoshop-lite/api',
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
});
