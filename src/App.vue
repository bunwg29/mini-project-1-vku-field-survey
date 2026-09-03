<script setup lang="ts">
import { ref, onMounted } from 'vue';
import SurveyForm from './components/SurveyForm.vue';
import SurveyList from './components/SurveyList.vue';
import { isOnline, initNetworkService } from './services/networkService';
import { pendingSyncCount, isSyncing, syncPendingSurveys, refreshPendingCount } from './services/syncService';

const activeTab = ref<'form' | 'list'>('form');
const surveyListRef = ref<InstanceType<typeof SurveyList> | null>(null);

onMounted(async () => {
  await refreshPendingCount();
  
  // Initialize network listeners and hook automatic background sync on reconnection
  await initNetworkService(async () => {
    console.log('[Network] Reconnected! Triggering automatic background sync...');
    await syncPendingSurveys();
    if (surveyListRef.value) {
      await surveyListRef.value.loadSurveys();
    }
  });
});

async function handleSurveySaved() {
  await refreshPendingCount();
  if (surveyListRef.value) {
    await surveyListRef.value.loadSurveys();
  }
}

async function triggerManualSync() {
  await syncPendingSurveys();
  if (surveyListRef.value) {
    await surveyListRef.value.loadSurveys();
  }
}
</script>

<template>
  <div class="app-root">
    <!-- Top Header -->
    <header class="app-header">
      <div class="header-branding">
        <div class="header-logo-badge">VKU</div>
        <div class="header-titles">
          <h1>VKU Field Survey</h1>
          <p class="subtitle">Hệ thống khảo sát cơ sở vật chất ngoại tuyến</p>
        </div>
      </div>

      <div class="header-meta-actions">
        <!-- Student Info Chip -->
        <div class="student-chip" title="Sinh viên thực hiện">
          <span class="user-avatar">👤</span>
          <div class="user-info-text">
            <strong>Trần Ka Bun</strong>
            <span>23IT.B015 • 23SE4</span>
          </div>
        </div>

        <!-- Network Status Indicator -->
        <div
          class="network-badge"
          :class="isOnline ? 'online' : 'offline'"
          :title="isOnline ? 'Đang trực tuyến (Online)' : 'Đang ngoại tuyến (Offline)'"
        >
          <span class="pulsing-dot"></span>
          <span>{{ isOnline ? 'Online' : 'Offline' }}</span>
        </div>

        <!-- Sync Button -->
        <button
          type="button"
          class="sync-indicator-btn"
          :disabled="isSyncing || !isOnline"
          :title="isOnline ? 'Đồng bộ dữ liệu' : 'Chưa có mạng để đồng bộ'"
          @click="triggerManualSync"
        >
          <span class="sync-icon" :class="{ rotating: isSyncing }">🔄</span>
          <span v-if="pendingSyncCount > 0" class="pending-pill">
            {{ pendingSyncCount }}
          </span>
        </button>
      </div>
    </header>

    <!-- Offline Banner Alert -->
    <div v-if="!isOnline" class="offline-banner">
      <span class="banner-icon">⚠️</span>
      <div class="banner-content">
        <strong>Chế độ Ngoại tuyến (Offline Mode) đang kích hoạt.</strong>
        <span>Mọi khảo sát bạn tạo sẽ được lưu an toàn vào IndexedDB và tự động đồng bộ ngay khi có mạng trở lại.</span>
      </div>
    </div>

    <!-- App Navigation Tabs -->
    <nav class="app-navigation">
      <button
        type="button"
        class="nav-tab"
        :class="{ active: activeTab === 'form' }"
        @click="activeTab = 'form'"
      >
        <span class="nav-icon">📝</span>
        <span class="nav-label">Tạo Khảo Sát Mới</span>
      </button>

      <button
        type="button"
        class="nav-tab"
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        <span class="nav-icon">📋</span>
        <span class="nav-label">Danh Sách & Đồng Bộ</span>
        <span v-if="pendingSyncCount > 0" class="nav-badge-count">
          {{ pendingSyncCount }}
        </span>
      </button>
    </nav>

    <!-- Main Content Area -->
    <main class="app-main-content">
      <div v-show="activeTab === 'form'">
        <SurveyForm @survey-saved="handleSurveySaved" />
      </div>

      <div v-show="activeTab === 'list'">
        <SurveyList ref="surveyListRef" />
      </div>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <p>© 2026 VKU Field Survey • Lập trình Ứng dụng Di động Đa nền tảng (Cross-Platform Mobile App)</p>
    </footer>
  </div>
</template>