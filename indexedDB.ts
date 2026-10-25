/**
 * IndexedDB helper for persisting PDF Materials locally in the browser.
 * Ensures robust storage and byte retrieval for PDF.js and native viewers.
 */

export interface MaterialItem {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  pdfBlob: Blob;
  connectionString: string; // e.g. "#Physics101"
  studyNotes: string;
  fileType?: 'pdf' | 'image' | 'drive';
  previewUrl?: string;
  driveFileId?: string;
}

const DB_NAME = 'LiquidGlassProductivityDB';
const DB_VERSION = 1;
const STORE_NAME = 'materials';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('connectionString', 'connectionString', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

export async function getAllMaterials(): Promise<MaterialItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result as MaterialItem[]).map((item) => {
        // Guarantee pdfBlob is a true application/pdf Blob
        if (item.pdfBlob && !(item.pdfBlob instanceof Blob)) {
          item.pdfBlob = new Blob([item.pdfBlob as any], { type: 'application/pdf' });
        }
        return item;
      });
      resolve(items);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to fetch materials'));
    };
  });
}

export async function saveMaterial(item: MaterialItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to save material'));
    };
  });
}

export async function deleteMaterial(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to delete material'));
    };
  });
}

export async function updateMaterialNotes(
  id: string,
  studyNotes: string,
  connectionString: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as MaterialItem | undefined;
      if (!item) {
        reject(new Error(`Material with ID ${id} not found`));
        return;
      }
      item.studyNotes = studyNotes;
      item.connectionString = connectionString;
      const putRequest = store.put(item);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => {
      reject(getRequest.error || new Error('Failed to retrieve material for update'));
    };
  });
}

export async function renameMaterial(id: string, newFilename: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as MaterialItem | undefined;
      if (!item) {
        reject(new Error(`Material with ID ${id} not found`));
        return;
      }
      item.filename = newFilename.trim() || item.filename;
      const putRequest = store.put(item);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => {
      reject(getRequest.error || new Error('Failed to retrieve material for rename'));
    };
  });
}

