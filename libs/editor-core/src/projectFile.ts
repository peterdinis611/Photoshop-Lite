import type { EditorLayer, ProjectFileData } from '@photoshop-lite/shared-types';
import { AppError } from './errors';

const PROJECT_VERSION = '1.0' as const;
export const PROJECT_FILE_EXTENSION = '.psl.json';

export function buildProjectFile(params: {
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  layers: EditorLayer[];
}): ProjectFileData {
  return {
    version: PROJECT_VERSION,
    title: params.title,
    canvasWidth: params.canvasWidth,
    canvasHeight: params.canvasHeight,
    backgroundColor: params.backgroundColor,
    layers: structuredClone(params.layers),
    savedAt: new Date().toISOString(),
  };
}

export function serializeProject(project: ProjectFileData): string {
  return JSON.stringify(project, null, 2);
}

export function parseProjectFile(raw: string): ProjectFileData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new AppError('Invalid project file — not valid JSON', {
      code: 'VALIDATION',
      cause,
    });
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AppError('Invalid project file — expected an object', { code: 'VALIDATION' });
  }

  const data = parsed as Partial<ProjectFileData>;

  if (data.version !== '1.0') {
    throw new AppError(`Unsupported project version: ${String(data.version)}`, {
      code: 'UNSUPPORTED',
    });
  }
  if (typeof data.canvasWidth !== 'number' || typeof data.canvasHeight !== 'number') {
    throw new AppError('Invalid project file — missing canvas size', { code: 'VALIDATION' });
  }
  if (!Array.isArray(data.layers)) {
    throw new AppError('Invalid project file — missing layers', { code: 'VALIDATION' });
  }

  return {
    version: '1.0',
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    backgroundColor:
      typeof data.backgroundColor === 'string' ? data.backgroundColor : 'transparent',
    layers: data.layers as EditorLayer[],
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
  };
}

export function downloadProjectFile(project: ProjectFileData): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (project.title || 'artwork').replace(/[^\w\-]+/g, '-').toLowerCase();
  link.download = `${safeName}${PROJECT_FILE_EXTENSION}`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file: File): Promise<ProjectFileData> {
  if (!file) {
    throw new AppError('No file selected', { code: 'VALIDATION' });
  }
  const text = await file.text();
  return parseProjectFile(text);
}
