import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const DEFAULT_SITE_URL = 'https://photoshoplite.app';

function normalizeSiteUrl(raw?: string): string {
  const value = (raw || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  return value || DEFAULT_SITE_URL;
}

/** Inject absolute site URL into HTML + rewrite sitemap/robots after build. */
function seoSiteUrlPlugin(siteUrl: string): Plugin {
  const rewritePublicSeoFiles = (outDir: string) => {
    for (const file of ['sitemap.xml', 'robots.txt', 'site.webmanifest']) {
      const path = resolve(outDir, file);
      if (!existsSync(path)) continue;
      const next = readFileSync(path, 'utf8').replaceAll(DEFAULT_SITE_URL, siteUrl);
      writeFileSync(path, next);
    }
  };

  return {
    name: 'seo-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl);
    },
    configureServer(server) {
      // Dev: serve rewritten robots/sitemap with the configured site URL
      server.middlewares.use((req, res, next) => {
        if (req.url === '/robots.txt' || req.url === '/sitemap.xml') {
          const file = resolve(import.meta.dirname, 'public', req.url.slice(1));
          if (existsSync(file)) {
            const body = readFileSync(file, 'utf8').replaceAll(DEFAULT_SITE_URL, siteUrl);
            res.setHeader(
              'Content-Type',
              req.url.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8'
            );
            res.end(body);
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      const outDir = resolve(import.meta.dirname, 'dist');
      rewritePublicSeoFiles(outDir);
    },
  };
}

export default defineConfig(() => {
  const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL);

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/editor',
    resolve: {
      alias: {
        '@photoshop-lite/shared-types': resolve(root, 'libs/shared/types/src/index.ts'),
        '@photoshop-lite/editor-core': resolve(root, 'libs/editor-core/src/index.ts'),
        '@photoshop-lite/editor-ai-client': resolve(root, 'libs/editor-ai-client/src/index.ts'),
        '@photoshop-lite/ai': resolve(root, 'libs/ai/src/index.ts'),
      },
    },
    server: {
      port: 4200,
      host: 'localhost',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4300,
      host: 'localhost',
    },
    plugins: [react(), tailwindcss(), seoSiteUrlPlugin(siteUrl)],
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    test: {
      name: '@photoshop-lite/editor',
      watch: false,
      globals: true,
      environment: 'jsdom',
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: './test-output/vitest/coverage',
        provider: 'v8' as const,
      },
    },
  };
});
