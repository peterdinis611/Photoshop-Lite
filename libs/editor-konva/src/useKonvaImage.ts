import { useEffect, useState } from 'react';
import { loadKonvaImage, peekKonvaImage } from './imageCache';

export type KonvaImageStatus = 'loading' | 'loaded' | 'failed';

export interface UseKonvaImageResult {
  image: HTMLImageElement | null;
  status: KonvaImageStatus;
  width: number;
  height: number;
}

/**
 * CORS-safe HTMLImageElement loader for react-konva `<Image />`.
 * Shares a process-wide decoded-image cache so remounts / dual consumers
 * (mask + layer, before/after) do not re-decode the same URL.
 */
export function useKonvaImage(
  src: string | null | undefined,
  crossOrigin: string | null = 'anonymous'
): UseKonvaImageResult {
  const warm = peekKonvaImage(src, crossOrigin);
  const [image, setImage] = useState<HTMLImageElement | null>(warm);
  const [status, setStatus] = useState<KonvaImageStatus>(
    !src ? 'failed' : warm ? 'loaded' : 'loading'
  );

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus('failed');
      return;
    }

    let cancelled = false;
    const peeked = peekKonvaImage(src, crossOrigin);
    if (peeked) {
      setImage(peeked);
      setStatus('loaded');
      return;
    }

    setStatus('loading');
    void loadKonvaImage(src, crossOrigin).then((img) => {
      if (cancelled) return;
      setImage(img);
      setStatus(img ? 'loaded' : 'failed');
    });

    return () => {
      cancelled = true;
    };
  }, [src, crossOrigin]);

  return {
    image,
    status,
    width: image?.naturalWidth || 0,
    height: image?.naturalHeight || 0,
  };
}
