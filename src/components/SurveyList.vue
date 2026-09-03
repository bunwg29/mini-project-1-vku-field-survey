<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Survey, SurveySyncStatus } from '../types/survey';
import { getAllSurveys, deleteSurvey } from '../db/surveyRepository';
import { removeSyncItem } from '../db/syncRepository';
import { isSyncing, syncPendingSurveys, refreshPendingCount } from '../services/syncService';
import { isOnline } from '../services/networkService';

const surveys = ref<Survey[]>([]);
const currentFilter = ref<'ALL' | SurveySyncStatus>('ALL');
const selectedPhoto = ref<string | null>(null);

const categoryIcons: Record<string, string> = {
  Hardware: '💻',
  Projector: '📽️',
  AC: '❄️',
  Electrical: '⚡',
  Furniture: '🪑',
};

async function loadSurveys() {
  surveys.value = await getAllSurveys();
  await refreshPendingCount();
}

onMounted(() => {
  loadSurveys();
});

defineExpose({
  loadSurveys,
});

const filteredSurveys = computed(() => {
  if (currentFilter.value === 'ALL') {
    return surveys.value;
  }
  return surveys.value.filter((s) => s.status === currentFilter.value);
});

const stats = computed(() => {
  const total = surveys.value.length;
  const pending = surveys.value.filter((s) => s.status === 'PENDING_SYNC').length;
  const synced = surveys.value.filter((s) => s.status === 'SYNCED').length;
  return { total, pending, synced };
});

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function handleDelete(id: string) {
  if (confirm('Bạn có chắc chắn muốn xóa bản ghi khảo sát này?')) {
    await deleteSurvey(id);
    await removeSyncItem(id);
    await loadSurveys();
  }
}

async function handleManualSync() {
  await syncPendingSurveys();
  await loadSurveys();
}
</script>

<template>
  <div class="survey-list-container">
    <!-- Header with statistics -->
    <div class="stats-overview-grid">
      <div class="stat-card total">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-lbl">Tổng phiếu</span>
      </div>
      <div class="stat-card pending">
        <span class="stat-num">{{ stats.pending }}</span>
        <span class="stat-lbl">Chờ đồng bộ</span>
      </div>
      <div class="stat-card synced">
        <span class="stat-num">{{ stats.synced }}</span>
        <span class="stat-lbl">Đã đồng bộ</span>
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="list-controls-bar">
      <div class="filter-tabs">
        <button
          type="button"
          class="filter-tab-btn"
          :class="{ active: currentFilter === 'ALL' }"
          @click="currentFilter = 'ALL'"
        >
          Tất cả ({{ stats.total }})
        </button>
        <button
          type="button"
          class="filter-tab-btn tab-pending"
          :class="{ active: currentFilter === 'PENDING_SYNC' }"
          @click="currentFilter = 'PENDING_SYNC'"
        >
          ⏳ Chờ Sync ({{ stats.pending }})
        </button>
        <button
          type="button"
          class="filter-tab-btn tab-synced"
          :class="{ active: currentFilter === 'SYNCED' }"
          @click="currentFilter = 'SYNCED'"
        >
          ✓ Đã Sync ({{ stats.synced }})
        </button>
      </div>

      <button
        v-if="stats.pending > 0"
        type="button"
        class="btn-quick-sync"
        :disabled="isSyncing || !isOnline"
        @click="handleManualSync"
      >
        <span v-if="isSyncing">🔄 Đang đồng bộ...</span>
        <span v-else-if="!isOnline">⚠️ Offline (Tự sync khi có mạng)</span>
        <span v-else>🚀 Đồng bộ ngay ({{ stats.pending }})</span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="filteredSurveys.length === 0" class="empty-surveys-card">
      <div class="empty-icon">📂</div>
      <h4>Chưa có phiếu khảo sát nào</h4>
      <p>Các dữ liệu khảo sát bạn thực hiện offline sẽ được hiển thị và quản lý tại đây.</p>
    </div>

    <!-- Cards list -->
    <div v-else class="surveys-cards-stack">
      <div
        v-for="survey in filteredSurveys"
        :key="survey.id"
        class="survey-item-card"
        :class="survey.status === 'SYNCED' ? 'card-synced' : 'card-pending'"
      >
        <div class="item-card-header">
          <div class="header-main-info">
            <span class="category-tag">
              {{ categoryIcons[survey.category] || '📦' }} {{ survey.category }}
            </span>
            <h4 class="location-title">
              {{ survey.building }} • {{ survey.floor ? survey.floor + ' • ' : '' }}{{ survey.room }}
            </h4>
          </div>

          <div class="header-badges">
            <span
              class="status-badge"
              :class="survey.status === 'SYNCED' ? 'badge-synced' : 'badge-pending'"
            >
              <span class="badge-dot"></span>
              {{ survey.status === 'SYNCED' ? 'ĐÃ ĐỒNG BỘ' : 'PENDING_SYNC' }}
            </span>
          </div>
        </div>

        <div class="item-card-body">
          <div class="rating-display">
            <span class="star-text">
              <span
                v-for="star in 5"
                :key="star"
                class="star"
                :class="{ filled: star <= survey.conditionRating }"
              >
                ★
              </span>
            </span>
            <span class="rating-number">({{ survey.conditionRating }}/5 sao)</span>
          </div>

          <p v-if="survey.defectNotes" class="defect-text">
            <strong>Ghi chú:</strong> {{ survey.defectNotes }}
          </p>
          <p v-else class="defect-text empty-note">
            <em>Không có ghi chú khuyết tật bổ sung.</em>
          </p>

          <div v-if="survey.latitude && survey.longitude" class="gps-info-chip">
            📍 GPS: {{ survey.latitude }}, {{ survey.longitude }}
          </div>

          <!-- Thumbnails -->
          <div v-if="survey.photos && survey.photos.length > 0" class="card-photos-grid">
            <img
              v-for="(photo, pIdx) in survey.photos"
              :key="pIdx"
              :src="photo"
              alt="Ảnh hiện trường"
              @click="selectedPhoto = photo"
            />
          </div>
        </div>

        <div class="item-card-footer">
          <span class="timestamp-text">🕒 Tạo lúc: {{ formatDate(survey.createdAt) }}</span>
          <div class="footer-buttons">
            <button
              type="button"
              class="btn-card-del"
              title="Xóa khảo sát"
              @click="handleDelete(survey.id)"
            >
              🗑️ Xóa
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Full Image Modal -->
    <div v-if="selectedPhoto" class="image-modal-overlay" @click="selectedPhoto = null">
      <div class="image-modal-content">
        <img :src="selectedPhoto" alt="Ảnh phóng to" />
        <button class="btn-close-modal" @click="selectedPhoto = null">✕ Đóng</button>
      </div>
    </div>
  </div>
</template>
