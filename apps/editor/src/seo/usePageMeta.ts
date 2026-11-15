import { useEffect } from 'react';

export type PageMeta = {
  title: string;
  description?: string;
  /** When set, updates robots meta (e.g. noindex for /editor). */
  robots?: string;
  /** Absolute or path-relative canonical; path is resolved against location.origin. */
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
};

const DEFAULT_TITLE =
  'PhotoshopLite — Free Browser Photo Editor | Layers, AI Cutout & Revive';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Client-side route meta for SPA pages (complements static index.html SEO). */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.head
      .querySelector('meta[name="description"]')
      ?.getAttribute('content');
    const prevRobots = document.head
      .querySelector('meta[name="robots"]')
      ?.getAttribute('content');
    const prevCanonical = document.head
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href');

    document.title = meta.title;
    if (meta.description) {
      upsertMeta('name', 'description', meta.description);
      upsertMeta('property', 'og:description', meta.ogDescription ?? meta.description);
      upsertMeta('name', 'twitter:description', meta.ogDescription ?? meta.description);
    }
    if (meta.robots) upsertMeta('name', 'robots', meta.robots);
    if (meta.ogTitle) {
      upsertMeta('property', 'og:title', meta.ogTitle);
      upsertMeta('name', 'twitter:title', meta.ogTitle);
    }
    if (meta.canonicalPath) {
      const href = meta.canonicalPath.startsWith('http')
        ? meta.canonicalPath
        : `${window.location.origin}${meta.canonicalPath}`;
      upsertLink('canonical', href);
      upsertMeta('property', 'og:url', href);
    }

    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      if (prevDesc) upsertMeta('name', 'description', prevDesc);
      if (prevRobots) upsertMeta('name', 'robots', prevRobots);
      if (prevCanonical) upsertLink('canonical', prevCanonical);
    };
  }, [
    meta.title,
    meta.description,
    meta.robots,
    meta.canonicalPath,
    meta.ogTitle,
    meta.ogDescription,
  ]);
}

export { DEFAULT_TITLE };
