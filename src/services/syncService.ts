import { ref } from 'vue';
import { getSyncQueue, removeSyncItem, getSyncQueueCount, type SyncItem } from '../db/syncRepository';
import { updateSurveyStatus } from '../db/surveyRepository';
import { uploadSurvey } from './api';
import { isOnline } from './networkService';

export const isSyncing = ref<boolean>(false);
export const pendingSyncCount = ref<number>(0);
export const lastSyncTime = ref<number | null>(null);
export const syncError = ref<string | null>(null);

export async function refreshPendingCount(): Promise<number> {
  const count = await getSyncQueueCount();
  pendingSyncCount.value = count;
  return count;
}

export async function syncPendingSurveys(): Promise<{ synced: number; failed: number }> {
  if (isSyncing.value) {
    return { synced: 0, failed: 0 };
  }

  if (!isOnline.value) {
    syncError.value = 'Không thể đồng bộ khi đang ngoại tuyến.';
    return { synced: 0, failed: 0 };
  }

  isSyncing.value = true;
  syncError.value = null;

  let synced = 0;
  let failed = 0;

  try {
    const queue: SyncItem[] = await getSyncQueue();
    pendingSyncCount.value = queue.length;

    for (const item of queue) {
      try {
        await uploadSurvey(item.payload);
        await removeSyncItem(item.id);
        await updateSurveyStatus(item.id, 'SYNCED', true);
        synced++;
        pendingSyncCount.value = Math.max(0, pendingSyncCount.value - 1);
      } catch (err) {
        console.error(`Sync failed for survey ${item.id}:`, err);
        failed++;
        syncError.value = `Đồng bộ gián đoạn tại bản ghi ${item.id.slice(0, 8)}...`;
        break; // Stop sequential sync if network fails mid-way
      }
    }

    lastSyncTime.value = Date.now();
  } finally {
    await refreshPendingCount();
    isSyncing.value = false;
  }

  return { synced, failed };
}