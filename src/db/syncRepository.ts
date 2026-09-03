import { getDB } from './database';
import type { Survey } from '../types/survey';

export interface SyncItem {
  id: string;
  type: 'CREATE_SURVEY';
  payload: Survey;
  createdAt: number;
  retryCount?: number;
}

export async function addToSyncQueue(item: SyncItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function getSyncQueue(): Promise<SyncItem[]> {
  const db = await getDB();
  const queue = await db.getAll('syncQueue');
  return queue.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('syncQueue');
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}