import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDir = resolve(import.meta.dirname, '../../public');

function readPublic(name: string): string {
  return readFileSync(resolve(publicDir, name), 'utf8');
}

describe('public SEO assets', () => {
  it('ships robots.txt with sitemap pointer', () => {
    expect(existsSync(resolve(publicDir, 'robots.txt'))).toBe(true);
    const robots = readPublic('robots.txt');
    expect(robots).toMatch(/User-agent:\s*\*/i);
    expect(robots).toMatch(/Allow:\s*\//i);
    expect(robots).toMatch(/Sitemap:\s*https:\/\/.+/i);
    expect(robots).toMatch(/Disallow:\s*\/api\//i);
  });

  it('ships a valid sitemap.xml homepage entry', () => {
    const sitemap = readPublic('sitemap.xml');
    expect(sitemap).toContain('<?xml');
    expect(sitemap).toContain('<urlset');
    expect(sitemap).toContain('<loc>https://');
    expect(sitemap).toContain('og-image.png');
    expect(sitemap).toContain('hreflang="en"');
  });

  it('ships web manifest with name and icons', () => {
    const manifest = JSON.parse(readPublic('site.webmanifest')) as {
      name: string;
      short_name: string;
      theme_color: string;
      icons: { src: string }[];
    };
    expect(manifest.name).toMatch(/PhotoshopLite/i);
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.theme_color).toBe('#0b0c0f');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it('includes favicon and social preview assets', () => {
    for (const file of [
      'favicon.ico',
      'favicon.svg',
      'apple-touch-icon.png',
      'og-image.png',
    ]) {
      expect(existsSync(resolve(publicDir, file)), file).toBe(true);
    }
  });
});

describe('index.html SEO head', () => {
  const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

  it('has primary meta, OG, Twitter, and JSON-LD', () => {
    expect(html).toContain('<title>');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="robots"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('WebApplication');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('%SITE_URL%');
  });

  it('links sitemap and manifest', () => {
    expect(html).toContain('href="/sitemap.xml"');
    expect(html).toContain('href="/site.webmanifest"');
    expect(html).toContain('rel="icon"');
  });
});
