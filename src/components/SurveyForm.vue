<script setup lang="ts">
import { reactive, ref, onMounted, watch } from 'vue';
import type { Survey, SurveyCategory, SurveyDraft } from '../types/survey';
import { saveSurvey, saveDraft, getDraft, clearDraft } from '../db/surveyRepository';
import { addToSyncQueue } from '../db/syncRepository';
import { takePhoto } from '../services/cameraService';
import { getCurrentLocation } from '../services/locationService';
import { isOnline } from '../services/networkService';
import { syncPendingSurveys, refreshPendingCount } from '../services/syncService';

const emit = defineEmits<{
  (e: 'survey-saved', survey: Survey): void;
}>();

const categories: { id: SurveyCategory; label: string; icon: string }[] = [
  { id: 'Hardware', label: 'Phần cứng / Máy tính', icon: '💻' },
  { id: 'Projector', label: 'Máy chiếu / Tivi', icon: '📽️' },
  { id: 'AC', label: 'Điều hòa / Quạt', icon: '❄️' },
  { id: 'Electrical', label: 'Hệ thống điện / Đèn', icon: '⚡' },
  { id: 'Furniture', label: 'Bàn ghế / Cơ sở', icon: '🪑' },
];

const ratingLabels: Record<number, string> = {
  1: '1/5 - Hư hỏng nặng / Không sử dụng được',
  2: '2/5 - Kém / Cần bảo trì sớm',
  3: '3/5 - Trung bình / Hoạt động được',
  4: '4/5 - Tốt / Xuống cấp nhẹ',
  5: '5/5 - Rất tốt / Hoàn hảo',
};

const form = reactive<{
  building: string;
  floor: string;
  room: string;
  category: SurveyCategory;
  conditionRating: number;
  defectNotes: string;
  latitude?: number;
  longitude?: number;
}>({
  building: '',
  floor: '',
  room: '',
  category: 'Hardware',
  conditionRating: 5,
  defectNotes: '',
  latitude: undefined,
  longitude: undefined,
});

const photos = ref<string[]>([]);
const cameraError = ref('');
const isLocating = ref(false);
const draftRestoredNotice = ref(false);
const lastDraftSavedTime = ref<string | null>(null);
const isSubmitting = ref(false);

// Auto-save draft debounce
let draftTimeout: ReturnType<typeof setTimeout> | null = null;

function triggerAutoSaveDraft() {
  if (draftTimeout) clearTimeout(draftTimeout);
  draftTimeout = setTimeout(async () => {
    const draft: SurveyDraft = {
      building: form.building,
      floor: form.floor,
      room: form.room,
      category: form.category,
      conditionRating: form.conditionRating,
      defectNotes: form.defectNotes,
      photos: [...photos.value],
      latitude: form.latitude,
      longitude: form.longitude,
      lastSavedAt: Date.now(),
    };

    // Only save if at least one field has input
    if (form.building || form.room || form.defectNotes || photos.value.length > 0) {
      await saveDraft(draft);
      const now = new Date();
      lastDraftSavedTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }
  }, 500);
}

// Watch all form inputs for real-time IndexedDB persistence
watch(() => [form.building, form.floor, form.room, form.category, form.conditionRating, form.defectNotes, photos.value.length], () => {
  triggerAutoSaveDraft();
}, { deep: true });

onMounted(async () => {
  // Try restoring draft from IndexedDB
  try {
    const draft = await getDraft();
    if (draft && (draft.building || draft.room || draft.defectNotes || draft.photos.length > 0)) {
      form.building = draft.building || '';
      form.floor = draft.floor || '';
      form.room = draft.room || '';
      form.category = draft.category || 'Hardware';
      form.conditionRating = draft.conditionRating || 5;
      form.defectNotes = draft.defectNotes || '';
      photos.value = draft.photos || [];
      form.latitude = draft.latitude;
      form.longitude = draft.longitude;

      draftRestoredNotice.value = true;
      const d = new Date(draft.lastSavedAt);
      lastDraftSavedTime.value = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      
      setTimeout(() => {
        draftRestoredNotice.value = false;
      }, 4000);
    }
  } catch (err) {
    console.warn('Could not restore draft:', err);
  }
});

async function addPhoto() {
  cameraError.value = '';
  try {
    const photo = await takePhoto();
    if (photo) {
      photos.value.push(photo);
      triggerAutoSaveDraft();
    }
  } catch {
    cameraError.value = 'Không thể mở camera. Hãy cấp quyền camera hoặc tải ảnh từ thiết bị.';
  }
}

function handleFileInput(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        photos.value.push(e.target.result as string);
        triggerAutoSaveDraft();
      }
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto(index: number) {
  photos.value.splice(index, 1);
  triggerAutoSaveDraft();
}

async function fetchLocation() {
  isLocating.value = true;
  try {
    const loc = await getCurrentLocation();
    if (loc) {
      form.latitude = loc.latitude;
      form.longitude = loc.longitude;
      triggerAutoSaveDraft();
    }
  } finally {
    isLocating.value = false;
  }
}

async function resetForm() {
  form.building = '';
  form.floor = '';
  form.room = '';
  form.category = 'Hardware';
  form.conditionRating = 5;
  form.defectNotes = '';
  form.latitude = undefined;
  form.longitude = undefined;
  photos.value = [];
  cameraError.value = '';
  lastDraftSavedTime.value = null;
  await clearDraft();
}

async function submitSurvey() {
  if (!form.building.trim() || !form.room.trim()) {
    alert('Vui lòng nhập Tòa nhà và Phòng kiểm tra!');
    return;
  }

  isSubmitting.value = true;

  try {
    const now = Date.now();
    const surveyId = crypto.randomUUID();

    const survey: Survey = {
      id: surveyId,
      building: form.building.trim(),
      floor: form.floor.trim(),
      room: form.room.trim(),
      category: form.category,
      conditionRating: form.conditionRating,
      defectNotes: form.defectNotes.trim(),
      photos: [...photos.value],
      latitude: form.latitude,
      longitude: form.longitude,
      status: 'PENDING_SYNC',
      synced: false,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Save directly into local IndexedDB surveys store
    await saveSurvey(survey);

    // 2. Add to IndexedDB sync queue
    await addToSyncQueue({
      id: surveyId,
      type: 'CREATE_SURVEY',
      payload: survey,
      createdAt: now,
    });

    // 3. Clear active draft
    await clearDraft();
    lastDraftSavedTime.value = null;

    // 4. Update queue counter
    await refreshPendingCount();

    // 5. Emit event
    emit('survey-saved', survey);

    // 6. Reset form fields
    form.building = '';
    form.floor = '';
    form.room = '';
    form.category = 'Hardware';
    form.conditionRating = 5;
    form.defectNotes = '';
    form.latitude = undefined;
    form.longitude = undefined;
    photos.value = [];
    cameraError.value = '';

    // 7. If online, trigger background auto-sync immediately
    if (isOnline.value) {
      syncPendingSurveys();
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="survey-form-container">
    <!-- Draft restored toast -->
    <div v-if="draftRestoredNotice" class="toast-draft-restored">
      ✨ <strong>Đã khôi phục bản nháp chưa hoàn thành</strong> từ IndexedDB.
    </div>

    <form class="survey-card" @submit.prevent="submitSurvey">
      <div class="form-header">
        <div class="form-header-title">
          <h3>Phiếu Khảo Sát Hiện Trường</h3>
          <p>Thu thập tình trạng trang thiết bị phòng học & hạ tầng</p>
        </div>
        <div v-if="lastDraftSavedTime" class="draft-indicator">
          <span class="save-dot"></span>
          Đã lưu nháp lúc {{ lastDraftSavedTime }}
        </div>
      </div>

      <!-- SECTION 1: LOCATION -->
      <div class="form-section">
        <div class="section-title">
          <span class="step-num">1</span>
          <h4>Vị trí & Địa điểm (Location)</h4>
        </div>

        <div class="grid-3">
          <div class="form-group">
            <label>Tòa nhà <span class="req">*</span></label>
            <select v-model="form.building" required>
              <option value="" disabled>-- Chọn Tòa nhà --</option>
              <option value="Khu V">Khu V (Khu hiệu bộ & Giảng đường chính)</option>
              <option value="Khu K">Khu K (Tòa nhà thực hành & CNTT)</option>
              <option value="Khu A">Khu A (Giảng đường A)</option>
              <option value="Khu B">Khu B (Giảng đường B)</option>
              <option value="Khu C">Khu C (Hội trường & Thư viện)</option>
              <option value="Ký túc xá">Khu Ký túc xá sinh viên</option>
              <option value="Khu Thể thao">Khu Nhà đa năng & Thể thao</option>
            </select>
          </div>

          <div class="form-group">
            <label>Tầng</label>
            <select v-model="form.floor">
              <option value="">-- Chọn tầng --</option>
              <option value="Tầng Hầm">Tầng Hầm (Basement)</option>
              <option value="Tầng 1">Tầng 1</option>
              <option value="Tầng 2">Tầng 2</option>
              <option value="Tầng 3">Tầng 3</option>
              <option value="Tầng 4">Tầng 4</option>
              <option value="Tầng 5">Tầng 5</option>
              <option value="Tầng Thượng">Tầng Thượng / Mái</option>
            </select>
          </div>

          <div class="form-group">
            <label>Phòng số / Vị trí <span class="req">*</span></label>
            <input
              v-model="form.room"
              type="text"
              placeholder="VD: V.A101, Lab AI-02..."
              required
            />
          </div>
        </div>

        <!-- GPS Location Helper -->
        <div class="gps-location-bar">
          <button
            type="button"
            class="btn-gps"
            :disabled="isLocating"
            @click="fetchLocation"
          >
            <span v-if="isLocating">📡 Đang định vị GPS...</span>
            <span v-else>📍 Lấy tọa độ GPS hiện tại</span>
          </button>
          <span v-if="form.latitude && form.longitude" class="gps-coord-text">
            Tọa độ: {{ form.latitude }}, {{ form.longitude }}
          </span>
          <span v-else class="gps-coord-empty">Chưa gắn tọa độ GPS</span>
        </div>
      </div>

      <!-- SECTION 2: CATEGORY & RATING -->
      <div class="form-section">
        <div class="section-title">
          <span class="step-num">2</span>
          <h4>Hạng mục & Tình trạng thiết bị</h4>
        </div>

        <div class="form-group">
          <label>Hạng mục kiểm tra <span class="req">*</span></label>
          <div class="category-grid">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="category-btn"
              :class="{ active: form.category === cat.id }"
              @click="form.category = cat.id"
            >
              <span class="cat-icon">{{ cat.icon }}</span>
              <span class="cat-label">{{ cat.label }}</span>
            </button>
          </div>
        </div>

        <div class="form-group rating-group">
          <label>Đánh giá tình trạng (Condition Rating 1-5 ⭐) <span class="req">*</span></label>
          <div class="star-rating-picker">
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              class="star-btn"
              :class="{ filled: star <= form.conditionRating }"
              @click="form.conditionRating = star"
            >
              ★
            </button>
          </div>
          <p class="rating-desc">{{ ratingLabels[form.conditionRating] }}</p>
        </div>
      </div>

      <!-- SECTION 3: DEFECT NOTES & PHOTOS -->
      <div class="form-section">
        <div class="section-title">
          <span class="step-num">3</span>
          <h4>Ghi chú sự cố & Ảnh chụp hiện trường</h4>
        </div>

        <div class="form-group">
          <label>Mô tả chi tiết khuyết tật / Hư hỏng (Defect Notes)</label>
          <textarea
            v-model="form.defectNotes"
            rows="3"
            placeholder="Mô tả sự cố (VD: Máy chiếu bị mờ nhạt màu, điều hòa chảy nước sàn nhà, dây nguồn bị lỏng...)"
          ></textarea>
        </div>

        <div class="photo-capture-section">
          <label>Hình ảnh bằng chứng hiện trường (Camera / Photo Evidence)</label>
          
          <div class="photo-actions">
            <button type="button" class="btn-camera" @click="addPhoto">
              📷 Chụp ảnh bằng Camera
            </button>
            <label class="btn-upload">
              📁 Tải ảnh từ thư viện
              <input type="file" accept="image/*" @change="handleFileInput" />
            </label>
          </div>

          <p v-if="cameraError" class="camera-error">{{ cameraError }}</p>

          <div v-if="photos.length" class="photo-preview-grid">
            <div
              v-for="(photo, index) in photos"
              :key="`${index}-${photo.slice(0, 20)}`"
              class="photo-thumb-card"
            >
              <img :src="photo" :alt="`Ảnh chụp ${index + 1}`" />
              <button
                type="button"
                class="btn-delete-photo"
                title="Xóa ảnh này"
                @click="removePhoto(index)"
              >
                ✕
              </button>
            </div>
          </div>
          <div v-else class="no-photos-hint">
            Chưa có ảnh nào được đính kèm. Khuyến khích chụp ít nhất 1 ảnh hiện trường.
          </div>
        </div>
      </div>

      <!-- FORM ACTIONS -->
      <div class="form-footer-actions">
        <button
          type="button"
          class="btn-reset"
          @click="resetForm"
        >
          Làm mới
        </button>
        <button
          type="submit"
          class="btn-submit"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting">Đang lưu trữ...</span>
          <span v-else>💾 Lưu Phiếu Khảo Sát (Offline-Ready)</span>
        </button>
      </div>
    </form>
  </div>
</template>