import { useEffect, useState } from 'react';

export type KonvaImageStatus = 'loading' | 'loaded' | 'failed';

export interface UseKonvaImageResult {
  image: HTMLImageElement | null;
  status: KonvaImageStatus;
  width: number;
  height: number;
}

/**
 * CORS-safe HTMLImageElement loader for react-konva `<Image />`.
 * Replaces duplicated `new Image()` + useState patterns.
 */
export function useKonvaImage(
  src: string | null | undefined,
  crossOrigin: string | null = 'anonymous'
): UseKonvaImageResult {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<KonvaImageStatus>('loading');

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus('failed');
      return;
    }

    let cancelled = false;
    const img = new window.Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;

    setStatus('loading');

    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setStatus('loaded');
    };
    img.onerror = () => {
      if (cancelled) return;
      setImage(null);
      setStatus('failed');
    };
    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, crossOrigin]);

  return {
    image,
    status,
    width: image?.naturalWidth || 0,
    height: image?.naturalHeight || 0,
  };
}
