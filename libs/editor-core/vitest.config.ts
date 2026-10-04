import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@photoshop-lite/shared-types': resolve(root, 'libs/shared/types/src/index.ts'),
    },
  },
  test: {
    name: '@photoshop-lite/editor-core',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
});
