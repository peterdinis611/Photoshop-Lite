import type Konva from 'konva';
import { getStage } from './stageRegistry';

export interface CanvasExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  scale: number;
  transparentBackground: boolean;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
}

/**
 * Export the document content layer via Konva so preview === download
 * (filters, drawings, shapes, blend modes, opacity).
 * Temporarily resets pan/zoom so export is resolution-accurate.
 */
export async function exportDocumentToDataUrl(options: CanvasExportOptions): Promise<string> {
  const stage = getStage();
  if (!stage) {
    throw new Error('Canvas stage is not ready');
  }

  const contentLayer = stage.findOne<Konva.Layer>('#export-content');
  const uiLayer = stage.findOne<Konva.Layer>('#export-ui');
  const bgNode = stage.findOne<Konva.Rect>('#export-bg');

  if (!contentLayer) {
    throw new Error('Export content layer not found');
  }

  const mimeType =
    options.format === 'jpeg'
      ? 'image/jpeg'
      : options.format === 'webp'
        ? 'image/webp'
        : 'image/png';

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
    if (uiLayer) uiLayer.visible(false);

    // Neutralize view transform so export is 1 document px = 1 export px × scale
    contentLayer.position({ x: 0, y: 0 });
    contentLayer.scale({ x: 1, y: 1 });

    if (bgNode) {
      bgNode.listening(false);
      bgNode.shadowOpacity(0);
      if (needsSolidBg) {
        bgNode.fill(solidFill);
      } else {
        bgNode.fill('rgba(0,0,0,0)');
      }
    }

    contentLayer.batchDraw();
    stage.batchDraw();

    const dataUrl = contentLayer.toDataURL({
      x: 0,
      y: 0,
      width: options.canvasWidth,
      height: options.canvasHeight,
      pixelRatio: options.scale,
      mimeType,
      quality: options.quality,
    });

    return dataUrl;
  } finally {
    contentLayer.position({ x: prevX, y: prevY });
    contentLayer.scale({ x: prevSX, y: prevSY });
    if (uiLayer) uiLayer.visible(prevUiVisible);
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
