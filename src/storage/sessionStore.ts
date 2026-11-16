import type { SessionWorkspace, StoryFormInput } from '../types/story';

const DB_NAME = 'storyforge_temp_session';
const STORE_NAME = 'workspace';
const KEY_NAME = 'current';

export const DEFAULT_STORY_INPUT: StoryFormInput = {
  prompt: '',
  title: '',
  genre: 'Adventure',
  targetDurationSec: 30,
  language: 'English',
  aspectRatio: '9:16',
  ttsPreference: 'auto',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTempSession(workspace: SessionWorkspace): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(workspace, KEY_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Graceful no-op if IndexedDB is blocked in private browsing
  }
}

export async function loadTempSession(): Promise<SessionWorkspace | null> {
  try {
    const db = await openDb();
    const result = await new Promise<SessionWorkspace | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY_NAME);
      req.onsuccess = () => resolve((req.result as SessionWorkspace | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearTempSession(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(KEY_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Graceful no-op
  }
}
