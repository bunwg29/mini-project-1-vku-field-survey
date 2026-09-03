import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'vku-field-survey';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('surveys')) {
          database.createObjectStore('surveys', {
            keyPath: 'id',
          });
        }

        if (!database.objectStoreNames.contains('syncQueue')) {
          database.createObjectStore('syncQueue', {
            keyPath: 'id',
          });
        }

        if (!database.objectStoreNames.contains('drafts')) {
          database.createObjectStore('drafts', {
            keyPath: 'key',
          });
        }
      },
    });
  }
  return dbPromise;
}