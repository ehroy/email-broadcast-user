<template>
  <div class="dashboard">
    <div class="header">
      <div class="header-content">
        <div>
          <h1>📧 Email OTP Dashboard</h1>
          <p class="user-info">
            Halo, <strong>{{ authStore.user?.username }}</strong>
          </p>
        </div>
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </div>

    <div class="container">
      <!-- Search & Filter -->
      <div class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Cari email (subject, body, atau pengirim)..."
          @input="debouncedSearch"
        />
        <div class="stats">
          <span class="badge">{{ messages.length }} pesan</span>
          <span class="badge" :class="{ pulse: autoRefresh }">
            Auto-refresh: {{ autoRefresh ? "ON" : "OFF" }}
          </span>
        </div>
      </div>

      <!-- Allowed Keywords & Emails Info -->
      <div
        v-if="authStore.user?.allowedKeywords || authStore.user?.allowedEmails"
        class="info-banner"
      >
        <div v-if="authStore.user?.allowedEmails" style="margin-bottom: 8px">
          <strong>📧 Email yang diizinkan:</strong>
          <span class="keywords">{{ authStore.user.allowedEmails }}</span>
        </div>
        <div v-if="authStore.user?.allowedKeywords">
          <strong>🔐 Keyword yang diizinkan:</strong>
          <span class="keywords">{{ authStore.user.allowedKeywords }}</span>
        </div>
      </div>

      <!-- Messages List -->
      <div v-if="loading && messages.length === 0" class="loading">
        <div class="spinner"></div>
        <p>Memuat pesan...</p>
      </div>

      <div v-else-if="messages.length === 0" class="empty-state">
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
        <h3>Tidak ada pesan</h3>
        <p>Pesan OTP akan muncul di sini (15 menit terakhir)</p>
      </div>

      <div v-else class="messages-grid">
        <div
          v-for="message in messages"
          :key="message.id"
          class="message-card"
          @click="selectMessage(message)"
        >
          <div class="message-header">
            <h3>{{ message.subject || "(No Subject)" }}</h3>
            <span class="timestamp">{{
              formatDate(message.received_date)
            }}</span>
          </div>

          <div class="message-meta">
            <span class="from">📨 {{ message.from_email }}</span>
          </div>

          <!-- <div class="message-preview">
            {{ truncateText(message.body, 120) }}
          </div> -->

          <div class="message-footer">
            <div class="keywords">
              <span
                v-for="keyword in message.keywords.split(',')"
                :key="keyword"
                class="keyword-tag"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Detail Modal -->
    <div v-if="selectedMessage" class="modal" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedMessage.subject || "(No Subject)" }}</h2>
          <button @click="closeModal" class="btn-close">×</button>
        </div>

        <div class="modal-body">
          <div class="detail-row">
            <strong>Dari:</strong>
            <span>{{ selectedMessage.from_email }}</span>
          </div>
          <div class="detail-row">
            <strong>Kepada:</strong>
            <span>{{ selectedMessage.to_email }}</span>
          </div>
          <div class="detail-row">
            <strong>Tanggal:</strong>
            <span>{{ formatDate(selectedMessage.received_date) }}</span>
          </div>
          <div class="detail-row">
            <strong>Keywords:</strong>
            <div class="keywords">
              <span
                v-for="keyword in selectedMessage.keywords.split(',')"
                :key="keyword"
                class="keyword-tag"
              >
                {{ keyword }}
              </span>
            </div>
          </div>

          <div class="message-body">
            <strong>Isi Pesan:</strong>
            <p v-html="selectedMessage.body"></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import axios from "axios";

const router = useRouter();
const authStore = useAuthStore();

const messages = ref([]);
const selectedMessage = ref(null);
const searchQuery = ref("");
const loading = ref(false);
const autoRefresh = ref(true);
let refreshInterval = null;
let searchTimeout = null;

const fetchMessages = async () => {
  try {
    const params = searchQuery.value ? { search: searchQuery.value } : {};
    const response = await axios.get("/api/messages", { params });
    messages.value = response.data;
  } catch (error) {
    console.error("Error fetching messages:", error);
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchMessages();
  }, 500);
};

const selectMessage = (message) => {
  selectedMessage.value = message;
};

const closeModal = () => {
  selectedMessage.value = null;
};

const handleLogout = () => {
  authStore.logout();
  router.push("/login");
};

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;

  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const truncateText = (text, length) => {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

onMounted(async () => {
  loading.value = true;
  await authStore.fetchUser();
  await fetchMessages();

  // Auto-refresh every 10 seconds
  refreshInterval = setInterval(() => {
    if (autoRefresh.value) {
      fetchMessages();
    }
  }, 10000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
});
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 28px;
  margin-bottom: 4px;
}

.user-info {
  opacity: 0.9;
  font-size: 14px;
}

.btn-logout {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid white;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: white;
  color: #667eea;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.search-bar {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  display: flex;
  gap: 16px;
  align-items: center;
}

.search-bar input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 15px;
}

.search-bar input:focus {
  outline: none;
  border-color: #667eea;
}

.stats {
  display: flex;
  gap: 12px;
}

.badge {
  background: #edf2f7;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  white-space: nowrap;
}

.badge.pulse {
  background: #48bb78;
  color: white;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.info-banner {
  background: #bee3f8;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #3182ce;
  color: #2c5282;
}

.info-banner .keywords {
  margin-left: 8px;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
}

.loading {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #718096;
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.3;
}

.messages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.message-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.message-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
  gap: 12px;
}

.message-header h3 {
  color: #2d3748;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.timestamp {
  font-size: 12px;
  color: #a0aec0;
  white-space: nowrap;
}

.message-meta {
  margin-bottom: 12px;
}

.from {
  font-size: 13px;
  color: #718096;
}

.message-preview {
  color: #4a5568;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.keywords {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.keyword-tag {
  background: #edf2f7;
  color: #4a5568;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.btn-delete {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #fed7d7;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 20px;
}

.modal-header h2 {
  color: #2d3748;
  font-size: 20px;
  flex: 1;
}

.btn-close {
  background: #edf2f7;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #e2e8f0;
}

.modal-body {
  padding: 24px;
}

.detail-row {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.detail-row strong {
  min-width: 80px;
  color: #4a5568;
}

.message-body {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.message-body strong {
  display: block;
  margin-bottom: 12px;
  color: #4a5568;
}

.message-body pre {
  background: #f7fafc;
  padding: 16px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 14px;
  line-height: 1.6;
  color: #2d3748;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.btn-delete-modal {
  background: #fc8181;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete-modal:hover {
  background: #f56565;
}

@media (max-width: 768px) {
  .messages-grid {
    grid-template-columns: 1fr;
  }

  .search-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .stats {
    justify-content: space-between;
  }
}
</style>
