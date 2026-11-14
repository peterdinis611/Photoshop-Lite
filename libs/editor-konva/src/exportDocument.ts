import type Konva from 'konva';
import { getStage } from './stageContext';

export interface CanvasExportOptions {
  format: 'png' | 'jpeg' | 'webp' | 'avif';
  quality: number;
  scale: number;
  transparentBackground: boolean;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
}

const MIME: Record<CanvasExportOptions['format'], string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

/**
 * Export the document content layer via Konva so preview === download.
 * Contract: Stage has `#export-content`, `#export-ui`, `#export-bg`.
 */
export async function exportDocumentToDataUrl(
  options: CanvasExportOptions,
  stageOverride?: Konva.Stage | null
): Promise<string> {
  const stage = stageOverride ?? getStage();
  if (!stage) throw new Error('Canvas stage is not ready');

  const contentLayer = stage.findOne<Konva.Layer>('#export-content');
  const uiLayer = stage.findOne<Konva.Layer>('#export-ui');
  const bgNode = stage.findOne<Konva.Rect>('#export-bg');

  if (!contentLayer) throw new Error('Export content layer not found');

  const mimeType = MIME[options.format] ?? 'image/png';
  const needsSolidBg =
    options.format === 'jpeg' ||
    !options.transparentBackground ||
    (options.backgroundColor !== 'transparent' && options.backgroundColor.length > 0);

  const solidFill =
    options.backgroundColor === 'transparent' ? '#ffffff' : options.backgroundColor;

  const prevUiVisible = uiLayer?.visible() ?? true;
  const prevBgFill = bgNode?.fill();
  const prevBgShadowOpacity = bgNode?.shadowOpacity();
  const prevBgListening = bgNode?.listening();
  const prevX = contentLayer.x();
  const prevY = contentLayer.y();
  const prevSX = contentLayer.scaleX();
  const prevSY = contentLayer.scaleY();

  try {
    // Hide transformer / UI chrome
    if (uiLayer) uiLayer.visible(false);

    contentLayer.find('Transformer').forEach((t) => t.visible(false));
    contentLayer.find('Image').forEach((node) => {
      // Ensure filters are baked into cache before export
      if ((node as Konva.Image).filters()?.length) {
        (node as Konva.Image).cache();
      }
    });

    contentLayer.position({ x: 0, y: 0 });
    contentLayer.scale({ x: 1, y: 1 });

    if (bgNode) {
      bgNode.listening(false);
      bgNode.shadowOpacity(0);
      bgNode.fill(needsSolidBg ? solidFill : 'rgba(0,0,0,0)');
    }

    contentLayer.batchDraw();
    stage.batchDraw();

    return contentLayer.toDataURL({
      x: 0,
      y: 0,
      width: options.canvasWidth,
      height: options.canvasHeight,
      pixelRatio: options.scale,
      mimeType,
      quality: options.quality,
    });
  } finally {
    contentLayer.position({ x: prevX, y: prevY });
    contentLayer.scale({ x: prevSX, y: prevSY });
    if (uiLayer) uiLayer.visible(prevUiVisible);
    contentLayer.find('Transformer').forEach((t) => t.visible(true));
    if (bgNode) {
      if (prevBgFill !== undefined) bgNode.fill(prevBgFill);
      if (prevBgShadowOpacity !== undefined) bgNode.shadowOpacity(prevBgShadowOpacity);
      if (prevBgListening !== undefined) bgNode.listening(prevBgListening);
    }
    contentLayer.batchDraw();
    stage.batchDraw();
  }
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}
