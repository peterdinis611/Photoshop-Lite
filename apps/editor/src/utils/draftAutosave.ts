import type { ProjectFileData } from '@photoshop-lite/shared-types';
import { buildProjectFile, parseProjectFile } from '@photoshop-lite/editor-core';
import type { EditorLayer } from '../types/editor';

const DB_NAME = 'px-drafts';
const DB_VERSION = 1;
const STORE = 'drafts';
const DRAFT_KEY = 'current';
/** Soft cap — oversized drafts skip write rather than freezing the tab. */
const MAX_DRAFT_CHARS = 28_000_000;

export type DraftSnapshot = {
  project: ProjectFileData;
  savedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbPut(value: DraftSnapshot): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.objectStore(STORE).put(value, DRAFT_KEY);
    });
  } finally {
    db.close();
  }
}

async function idbGet(): Promise<DraftSnapshot | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as DraftSnapshot | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
      tx.objectStore(STORE).delete(DRAFT_KEY);
    });
  } finally {
    db.close();
  }
}

export function buildDraftFromState(state: {
  projectTitle: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  layers: EditorLayer[];
}): ProjectFileData {
  return buildProjectFile({
    title: state.projectTitle || 'Untitled plate',
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    backgroundColor: state.backgroundColor,
    layers: state.layers,
  });
}

export async function saveDraft(project: ProjectFileData): Promise<'ok' | 'skipped' | 'error'> {
  try {
    const raw = JSON.stringify(project);
    if (raw.length > MAX_DRAFT_CHARS) return 'skipped';
    await idbPut({ project, savedAt: new Date().toISOString() });
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function loadDraft(): Promise<DraftSnapshot | null> {
  try {
    const snap = await idbGet();
    if (!snap?.project) return null;
    // Re-validate shape in case of schema drift
    parseProjectFile(JSON.stringify(snap.project));
    return snap;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await idbDelete();
  } catch {
    /* ignore */
  }
}
