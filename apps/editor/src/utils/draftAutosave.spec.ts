import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDraftFromState, clearDraft, loadDraft, saveDraft } from './draftAutosave';

type Store = Map<IDBValidKey, unknown>;

/** Enough of IndexedDB for put/get/delete against one object store. */
function installMemoryIdb() {
  const stores = new Map<string, Store>();

  class Req<T = unknown> implements Partial<IDBRequest<T>> {
    result!: T;
    error: DOMException | null = null;
    onsuccess: ((this: IDBRequest<T>, ev: Event) => void) | null = null;
    onerror: ((this: IDBRequest<T>, ev: Event) => void) | null = null;
    onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => void) | null = null;

    _fireSuccess(value: T) {
      this.result = value;
      queueMicrotask(() => {
        this.onsuccess?.call(this as unknown as IDBRequest<T>, new Event('success'));
      });
    }
  }

  class Tx {
    oncomplete: ((this: IDBTransaction, ev: Event) => void) | null = null;
    onerror: ((this: IDBTransaction, ev: Event) => void) | null = null;
    error: DOMException | null = null;
    constructor(private readonly store: Store) {}
    objectStore() {
      const store = this.store;
      const tx = this;
      return {
        put(value: unknown, key: IDBValidKey) {
          store.set(key, structuredClone(value));
          queueMicrotask(() => tx.oncomplete?.call(tx as unknown as IDBTransaction, new Event('complete')));
          return new Req();
        },
        get(key: IDBValidKey) {
          const req = new Req();
          req._fireSuccess(store.has(key) ? structuredClone(store.get(key)) : undefined);
          return req;
        },
        delete(key: IDBValidKey) {
          store.delete(key);
          queueMicrotask(() => tx.oncomplete?.call(tx as unknown as IDBTransaction, new Event('complete')));
          return new Req();
        },
      };
    }
  }

  class Db {
    objectStoreNames = {
      contains: (name: string) => stores.has(name),
    };
    createObjectStore(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
    }
    transaction(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      return new Tx(stores.get(name)!);
    }
    close() {}
  }

  vi.stubGlobal('indexedDB', {
    open() {
      const req = new Req<Db>();
      const db = new Db();
      // Mirror real IDB: result is set before upgrade + success handlers run
      queueMicrotask(() => {
        (req as Req<Db>).result = db;
        if (!stores.has('drafts')) {
          req.onupgradeneeded?.call(
            req as unknown as IDBOpenDBRequest,
            { target: req } as unknown as IDBVersionChangeEvent
          );
        }
        req.onsuccess?.call(req as unknown as IDBRequest<Db>, new Event('success'));
      });
      return req;
    },
  });

  return () => stores.clear();
}

describe('draftAutosave', () => {
  let wipe: () => void;

  beforeEach(() => {
    wipe = installMemoryIdb();
  });

  afterEach(() => {
    wipe();
    vi.unstubAllGlobals();
  });

  it('buildDraftFromState clones layer snapshot into a project file', () => {
    const project = buildDraftFromState({
      projectTitle: 'Night',
      canvasWidth: 640,
      canvasHeight: 480,
      backgroundColor: '#000',
      layers: [
        {
          id: 't1',
          type: 'text',
          name: 'Title',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          text: 'Hi',
          fontFamily: 'Source Sans 3',
          fontSize: 24,
          fill: '#fff',
          fontStyle: 'normal',
          textDecoration: 'none',
          align: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
        },
      ],
    });
    expect(project.version).toBe('1.0');
    expect(project.title).toBe('Night');
    expect(project.layers).toHaveLength(1);
    expect(project.layers[0]).toMatchObject({ id: 't1', type: 'text' });
  });

  it('round-trips a draft through IndexedDB', async () => {
    const project = buildDraftFromState({
      projectTitle: 'Draft',
      canvasWidth: 100,
      canvasHeight: 100,
      backgroundColor: 'transparent',
      layers: [],
    });
    expect(await saveDraft(project)).toBe('ok');
    const snap = await loadDraft();
    expect(snap?.project.title).toBe('Draft');
    expect(snap?.savedAt).toBeTruthy();

    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });
});
