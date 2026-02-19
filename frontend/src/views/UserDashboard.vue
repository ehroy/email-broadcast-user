<template>
  <div class="user-dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-container">
        <div class="logo-section">
          <h1 class="logo">📧 OTP INBOX</h1>
          <div class="user-badge">
            <span class="user-label">USER:</span>
            <span class="user-name">{{ authStore.user?.username }}</span>
          </div>
        </div>
        <button @click="handleLogout" class="btn-logout">
          <span>LOGOUT</span>
          <span class="icon">→</span>
        </button>
      </div>
    </header>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-container">
        <div class="status-item">
          <span class="status-label">TOTAL MESSAGES:</span>
          <span class="status-value">{{ messages.length }}</span>
        </div>
        <div class="status-item" :class="{ active: autoRefresh }">
          <span class="status-icon">{{ autoRefresh ? "●" : "○" }}</span>
          <span class="status-label">AUTO-REFRESH</span>
        </div>
        <div class="status-item">
          <span class="status-label">LAST UPDATE:</span>
          <span class="status-value">{{ lastUpdate }}</span>
        </div>
      </div>
    </div>

    <div class="dashboard-content">
      <!-- Permission Info -->
      <div v-if="hasPermissions" class="permission-banner">
        <div class="banner-header">
          <span class="banner-icon">⚠️</span>
          <h3>YOUR ACCESS PERMISSIONS</h3>
        </div>
        <div class="permission-grid">
          <div v-if="authStore.user?.allowedEmails" class="permission-item">
            <div class="permission-label">📧 ALLOWED EMAILS</div>
            <div class="permission-value">
              {{ authStore.user.allowedEmails }}
            </div>
          </div>
          <div v-if="authStore.user?.allowedKeywords" class="permission-item">
            <div class="permission-label">🔑 ALLOWED KEYWORDS</div>
            <div class="permission-value">
              {{ authStore.user.allowedKeywords }}
            </div>
          </div>
        </div>
      </div>

      <!-- Category Stats -->
      <div class="category-stats">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-card"
          :class="[category.id, { active: activeCategory === category.id }]"
          @click="filterByCategory(category.id)"
        >
          <div class="category-icon">{{ category.icon }}</div>
          <div class="category-info">
            <div class="category-name">{{ category.name }}</div>
            <div class="category-count">{{ category.count }}</div>
          </div>
          <div class="category-arrow">→</div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="SEARCH MESSAGES..."
            @input="debouncedSearch"
          />
        </div>
        <button
          v-if="activeCategory || searchQuery"
          @click="clearFilters"
          class="btn-clear"
        >
          <span class="icon">✕</span>
          <span>CLEAR</span>
        </button>
        <button @click="fetchMessages" class="btn-refresh">
          <span class="icon">↻</span>
          <span>REFRESH</span>
        </button>
      </div>

      <!-- Messages Grid -->
      <div v-if="loading && messages.length === 0" class="loading-state">
        <div class="loader"></div>
        <p>LOADING MESSAGES...</p>
      </div>

      <div v-else-if="filteredMessages.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>NO MESSAGES FOUND</h3>
        <p v-if="activeCategory || searchQuery">
          Try clearing your filters or search
        </p>
        <p v-else>Messages will appear here (Last 15 minutes)</p>
      </div>

      <div v-else class="messages-container">
        <div class="messages-header">
          <h2 class="section-title">
            <span v-if="activeCategory">{{
              getCategoryName(activeCategory)
            }}</span>
            <span v-else>ALL MESSAGES</span>
          </h2>
          <div class="message-count">{{ filteredMessages.length }} FOUND</div>
        </div>

        <div class="messages-grid">
          <div
            v-for="message in filteredMessages"
            :key="message.id"
            class="message-card"
            :class="getCategoryClass(message)"
            @click="selectMessage(message)"
          >
            <div class="card-header">
              <div class="category-badge">{{ getCategoryLabel(message) }}</div>
              <div class="time-badge">
                {{ formatDate(message.received_date) }}
              </div>
            </div>

            <h4 class="message-subject">
              {{ message.subject || "[NO SUBJECT]" }}
            </h4>

            <div class="message-from">
              <span class="from-label">FROM:</span>
              <span class="from-value">{{ message.from_email }}</span>
            </div>

            <div class="message-keywords">
              <span
                v-for="keyword in message.keywords.split(',').slice(0, 3)"
                :key="keyword"
                class="keyword"
              >
                {{ keyword.trim() }}
              </span>
            </div>

            <div class="card-arrow">→</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Detail Modal -->
    <teleport to="body">
      <div v-if="selectedMessage" class="modal-overlay" @click="closeModal">
        <div class="modal brutal" @click.stop>
          <div class="modal-header">
            <div
              class="message-badge"
              :class="getCategoryClass(selectedMessage)"
            >
              {{ getCategoryLabel(selectedMessage) }}
            </div>
            <button @click="closeModal" class="btn-close">✕</button>
          </div>

          <div class="modal-body">
            <h2 class="message-title">
              {{ selectedMessage.subject || "[NO SUBJECT]" }}
            </h2>

            <div class="message-meta">
              <div class="meta-item">
                <span class="meta-label">FROM:</span>
                <span class="meta-value">{{ selectedMessage.from_email }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">TO:</span>
                <span class="meta-value">{{ selectedMessage.to_email }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">DATE:</span>
                <span class="meta-value">{{
                  formatDateFull(selectedMessage.received_date)
                }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">KEYWORDS:</span>
                <div class="meta-keywords">
                  <span
                    v-for="keyword in selectedMessage.keywords.split(',')"
                    :key="keyword"
                    class="keyword-tag"
                  >
                    {{ keyword.trim() }}
                  </span>
                </div>
              </div>
            </div>

            <div class="message-content">
              <div class="content-label">MESSAGE BODY:</div>
              <div class="content-body" v-html="selectedMessage.body"></div>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import axios from "axios";

const router = useRouter();
const authStore = useAuthStore();

const messages = ref([]);
const selectedMessage = ref(null);
const activeCategory = ref(null);
const searchQuery = ref("");
const loading = ref(false);
const autoRefresh = ref(true);
const lastUpdate = ref("Never");

let refreshInterval = null;
let searchTimeout = null;

// Categorize message
const categorizeMessage = (message) => {
  const subject = (message.subject || "").toLowerCase();
  const keywords = (message.keywords || "").toLowerCase();
  const combined = subject + " " + keywords;
  console.log("Categorizing message:", { subject, keywords, combined });
  // Check for password reset first (more specific)
  if (
    combined.includes("reset") ||
    combined.includes("lupa") ||
    combined.includes("forgot") ||
    combined.includes("sandi") ||
    combined.includes("mengatur ulangsandi")
  ) {
    return "forgot_password";
  }

  // Check for household
  if (
    combined.includes("household") ||
    combined.includes("rumah") ||
    combined.includes("keluarga") ||
    combined.includes("akses sementara") ||
    combined.includes("temporary access") ||
    combined.includes("memperbarui rumah") ||
    combined.includes("update your netflix household")
  ) {
    return "household";
  }

  // Check for login (sign-in code)
  if (
    combined.includes("sign in") ||
    combined.includes("sign-in") ||
    combined.includes("masuk") ||
    combined.includes("kode masuk") ||
    combined.includes("login") ||
    combined.includes("code")
  ) {
    return "login";
  }

  return "unknown";
};
// Categories with counts
const categories = computed(() => {
  const counts = {
    household: 0,
    login: 0,
    forgot_password: 0,
    unknown: 0,
  };

  messages.value.forEach((msg) => {
    const category = categorizeMessage(msg);
    counts[category]++;
  });

  return [
    {
      id: "household",
      icon: "🏠",
      name: "HOUSEHOLD",
      count: counts.household,
    },
    {
      id: "login",
      icon: "🔐",
      name: "LOGIN",
      count: counts.login,
    },
    {
      id: "forgot_password",
      icon: "🔑",
      name: "PASSWORD",
      count: counts.forgot_password,
    },
    {
      id: "unknown",
      icon: "❓",
      name: "UNKNOWN",
      count: counts.unknown,
    },
  ];
});

// Filtered messages
const filteredMessages = computed(() => {
  let filtered = messages.value;

  if (activeCategory.value) {
    filtered = filtered.filter(
      (msg) => categorizeMessage(msg) === activeCategory.value,
    );
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (msg) =>
        (msg.subject || "").toLowerCase().includes(query) ||
        (msg.from_email || "").toLowerCase().includes(query) ||
        (msg.body || "").toLowerCase().includes(query) ||
        (msg.keywords || "").toLowerCase().includes(query),
    );
  }

  return filtered;
});

const hasPermissions = computed(() => {
  return authStore.user?.allowedEmails || authStore.user?.allowedKeywords;
});

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
    // Search handled by computed property
  }, 300);
};

const filterByCategory = (categoryId) => {
  if (activeCategory.value === categoryId) {
    activeCategory.value = null;
  } else {
    activeCategory.value = categoryId;
  }
};

const clearFilters = () => {
  activeCategory.value = null;
  searchQuery.value = "";
};

const selectMessage = (message) => {
  selectedMessage.value = message;
};

const closeModal = () => {
  selectedMessage.value = null;
};

const getCategoryClass = (message) => {
  return `category-${categorizeMessage(message)}`;
};

const getCategoryLabel = (message) => {
  const category = categorizeMessage(message);
  const labels = {
    household: "HOUSEHOLD",
    login: "LOGIN",
    forgot_password: "PASSWORD",
    unknown: "UNKNOWN",
  };
  return labels[category] || "UNKNOWN";
};

const getCategoryName = (categoryId) => {
  const category = categories.value.find((cat) => cat.id === categoryId);
  return category ? category.name : "";
};

const handleLogout = () => {
  authStore.logout();
  router.push("/login");
};

const updateLastUpdate = () => {
  const now = new Date();
  lastUpdate.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "NOW";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatDateFull = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  }, 60000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (searchTimeout) clearTimeout(searchTimeout);
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.user-dashboard {
  min-height: 100vh;
  background: #f5f5f0;
  font-family: "Space Mono", "Courier New", monospace;
}

/* Header */
.dashboard-header {
  background: #000;
  color: #fff;
  padding: 24px 0;
  border-bottom: 6px solid #4ecdc4;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.2);
}

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.logo {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -1px;
  margin: 0;
  text-transform: uppercase;
}

.user-badge {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #4ecdc4;
  color: #000;
  padding: 6px 12px;
  border: 3px solid #000;
  width: fit-content;
}

.user-label {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.8;
}

.user-name {
  font-size: 14px;
  font-weight: 900;
}

.btn-logout {
  background: #fff;
  color: #000;
  border: 4px solid #000;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.1s;
  box-shadow: 4px 4px 0 #4ecdc4;
}

.btn-logout:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #4ecdc4;
}

.btn-logout:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 #4ecdc4;
}

/* Status Bar */
.status-bar {
  background: #ffeb3b;
  border-bottom: 4px solid #000;
  padding: 12px 0;
}

.status-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 32px;
  align-items: center;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
  font-size: 13px;
  text-transform: uppercase;
}

.status-item.active {
  color: #48bb78;
}

.status-label {
  opacity: 0.7;
}

.status-value {
  background: #000;
  color: #fff;
  padding: 4px 12px;
  border: 2px solid #000;
}

.status-icon {
  font-size: 16px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* Dashboard Content */
.dashboard-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* Permission Banner */
.permission-banner {
  background: #fff;
  border: 6px solid #000;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.1);
}

.banner-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 4px solid #000;
}

.banner-icon {
  font-size: 24px;
}

.banner-header h3 {
  font-size: 16px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
  letter-spacing: 1px;
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.permission-item {
  background: #f5f5f0;
  border: 4px solid #000;
  padding: 16px;
}

.permission-label {
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  margin-bottom: 8px;
  opacity: 0.6;
  letter-spacing: 1px;
}

.permission-value {
  font-size: 14px;
  font-weight: 700;
  word-break: break-word;
  font-family: monospace;
}

/* Category Stats */
.category-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.category-card {
  background: #fff;
  border: 6px solid #000;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.category-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 100%;
  transition: width 0.2s;
}

.category-card.household::before {
  background: #4ecdc4;
}

.category-card.login::before {
  background: #ff6b6b;
}

.category-card.forgot_password::before {
  background: #95e1d3;
}

.category-card.unknown::before {
  background: #f38181;
}

.category-card:hover::before {
  width: 100%;
  opacity: 0.1;
}

.category-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.1);
}

.category-card.active {
  background: #ffeb3b;
  transform: translate(-3px, -3px);
  box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.1);
}

.category-icon {
  font-size: 36px;
}

.category-info {
  flex: 1;
}

.category-name {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  margin-bottom: 4px;
  letter-spacing: 1px;
}

.category-count {
  font-size: 32px;
  font-weight: 900;
  line-height: 1;
}

.category-arrow {
  font-size: 28px;
  font-weight: 900;
  opacity: 0.3;
  transition: all 0.2s;
}

.category-card:hover .category-arrow {
  opacity: 1;
  transform: translateX(5px);
}

/* Search Section */
.search-section {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 300px;
  background: #fff;
  border: 4px solid #000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.1);
}

.search-icon {
  font-size: 20px;
}

.search-box input {
  flex: 1;
  border: none;
  padding: 16px 0;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  text-transform: uppercase;
}

.search-box input:focus {
  outline: none;
}

.search-box input::placeholder {
  opacity: 0.5;
}

.btn-refresh,
.btn-clear {
  background: #fff;
  color: #000;
  border: 4px solid #000;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.1s;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}

.btn-refresh:hover,
.btn-clear:hover {
  transform: translate(2px, 2px);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.1);
}

.btn-refresh:active,
.btn-clear:active {
  transform: translate(6px, 6px);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0.1);
}

.btn-clear {
  background: #ff6b6b;
  color: #fff;
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: 80px 20px;
}

.loader {
  width: 60px;
  height: 60px;
  border: 6px solid #000;
  border-top-color: #4ecdc4;
  border-radius: 0;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 2px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: #fff;
  border: 6px solid #000;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.1);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h3 {
  font-size: 24px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.empty-state p {
  opacity: 0.6;
  font-weight: 700;
}

/* Messages Container */
.messages-container {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.messages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 4px solid #000;
}

.section-title {
  font-size: 24px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
  letter-spacing: -1px;
}

.message-count {
  background: #000;
  color: #fff;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
  border: 3px solid #000;
}

/* Messages Grid */
.messages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.message-card {
  background: #fff;
  border: 5px solid #000;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.1);
  position: relative;
}

.message-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 8px;
  height: 100%;
}

.message-card.category-household::before {
  background: #4ecdc4;
}

.message-card.category-login::before {
  background: #ff6b6b;
}

.message-card.category-forgot_password::before {
  background: #95e1d3;
}

.message-card.category-unknown::before {
  background: #f38181;
}

.message-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
}

.category-badge {
  background: #000;
  color: #fff;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.time-badge {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
  white-space: nowrap;
}

.message-subject {
  font-size: 18px;
  font-weight: 900;
  margin: 0 0 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-transform: uppercase;
  line-height: 1.3;
}

.message-from {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.from-label {
  font-weight: 900;
  opacity: 0.6;
}

.from-value {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-keywords {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.keyword {
  background: #ffeb3b;
  color: #000;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  border: 2px solid #000;
}

.card-arrow {
  text-align: right;
  font-size: 24px;
  font-weight: 900;
  opacity: 0.3;
  transition: all 0.2s;
}

.message-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(5px);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

.modal {
  background: #fff;
  border: 8px solid #000;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 16px 16px 0 rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 24px;
  border-bottom: 6px solid #000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffeb3b;
}

.message-badge {
  background: #000;
  color: #fff;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  border: 3px solid #000;
}

.message-badge.category-household {
  background: #4ecdc4;
  color: #000;
}

.message-badge.category-login {
  background: #ff6b6b;
  color: #fff;
}

.message-badge.category-forgot_password {
  background: #95e1d3;
  color: #000;
}

.message-badge.category-unknown {
  background: #f38181;
  color: #fff;
}

.btn-close {
  background: #000;
  color: #fff;
  border: 4px solid #000;
  width: 48px;
  height: 48px;
  font-size: 28px;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background: #fff;
  color: #000;
}

.modal-body {
  padding: 32px;
}

.message-title {
  font-size: 24px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0 0 24px;
  line-height: 1.3;
}

.message-meta {
  margin-bottom: 32px;
  padding: 20px;
  background: #f5f5f0;
  border: 4px solid #000;
}

.meta-item {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: start;
}

.meta-item:last-child {
  margin-bottom: 0;
}

.meta-label {
  font-weight: 900;
  min-width: 100px;
  opacity: 0.6;
  text-transform: uppercase;
  font-size: 13px;
}

.meta-value {
  font-weight: 700;
  flex: 1;
  word-break: break-word;
}

.meta-keywords {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.keyword-tag {
  background: #ffeb3b;
  color: #000;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  border: 2px solid #000;
}

.message-content {
  border: 4px solid #000;
  padding: 24px;
  background: #fff;
}

.content-label {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  margin-bottom: 16px;
  opacity: 0.6;
  letter-spacing: 1px;
}

.content-body {
  font-size: 15px;
  line-height: 1.7;
  font-weight: 600;
  word-wrap: break-word;
}

/* Responsive */
@media (max-width: 768px) {
  .header-container {
    flex-direction: column;
    gap: 20px;
  }

  .logo {
    font-size: 24px;
  }

  .status-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .category-stats {
    grid-template-columns: 1fr;
  }

  .search-section {
    flex-direction: column;
  }

  .search-box {
    min-width: auto;
  }

  .messages-grid {
    grid-template-columns: 1fr;
  }

  .messages-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .permission-grid {
    grid-template-columns: 1fr;
  }
}
</style>
