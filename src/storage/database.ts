export const DATABASE_NAME = 'local-poker-game-v1';
export const DATABASE_VERSION = 1;
export const STORE_NAMES = ['career', 'currentHand', 'handHistory', 'settings'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORE_NAMES) if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
  return databasePromise;
}

export async function readRecord<T = unknown>(storeName: StoreName, key: string): Promise<T | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  return requestResult(transaction.objectStore(storeName).get(key)) as Promise<T | undefined>;
}

export async function writeRecords(records: readonly { storeName: StoreName; key: string; value: unknown }[], deletes: readonly { storeName: StoreName; key: string }[] = []): Promise<void> {
  const database = await openDatabase();
  const stores = [...new Set([...records.map((record) => record.storeName), ...deletes.map((record) => record.storeName)])];
  const transaction = database.transaction(stores, 'readwrite');
  for (const record of records) transaction.objectStore(record.storeName).put(record.value, record.key);
  for (const record of deletes) transaction.objectStore(record.storeName).delete(record.key);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function deleteDatabase(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise.catch(() => null);
    database?.close();
  }
  databasePromise = null;
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to delete IndexedDB'));
    request.onblocked = () => resolve();
  });
}
