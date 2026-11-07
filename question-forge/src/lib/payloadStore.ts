import type { SourcePayload } from './types';

/**
 * Web build: payloads go to IndexedDB (localStorage is too small for PDFs).
 * If IndexedDB is unavailable (private mode, blocked storage) we keep them in
 * memory for the session so the app still works.
 */
const memory = new Map<string, SourcePayload>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open('margins', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('payloads');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve) => {
        if (!d) return resolve(undefined);
        try {
          const req = fn(d.transaction('payloads', mode).objectStore('payloads'));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function putPayload(id: string, payload: SourcePayload): Promise<void> {
  memory.set(id, payload);
  await run('readwrite', (s) => s.put(payload, id));
}

export async function getPayload(id: string): Promise<SourcePayload | null> {
  if (memory.has(id)) return memory.get(id)!;
  const p = await run<SourcePayload>('readonly', (s) => s.get(id));
  return p ?? null;
}

export async function deletePayload(id: string): Promise<void> {
  memory.delete(id);
  await run('readwrite', (s) => s.delete(id));
}
