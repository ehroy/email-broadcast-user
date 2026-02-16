<template>
  <div class="admin-dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-container">
        <div class="logo-section">
          <h1 class="logo">⚡ ADMIN CONTROL</h1>
          <div class="user-badge">
            <span class="user-label">LOGGED AS:</span>
            <span class="user-name">{{ authStore.user?.username }}</span>
          </div>
        </div>
        <button @click="handleLogout" class="btn-logout">
          <span>EXIT</span>
          <span class="icon">→</span>
        </button>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <div class="nav-container">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>
    </nav>

    <div class="dashboard-content">
      <!-- Messages Tab -->
      <div v-if="activeTab === 'messages'" class="tab-panel">
        <!-- Stats Cards -->
        <div class="stats-grid">
          <div
            v-for="category in messageCategories"
            :key="category.id"
            class="stat-card"
            :class="category.id"
          >
            <div class="stat-header">
              <span class="stat-icon">{{ category.icon }}</span>
              <h3 class="stat-title">{{ category.title }}</h3>
            </div>
            <div class="stat-body">
              <div class="stat-number">{{ category.count }}</div>
              <div class="stat-label">MESSAGES</div>
            </div>
            <button
              @click="filterByCategory(category.id)"
              :class="[
                'stat-action',
                { active: selectedCategory === category.id },
              ]"
            >
              {{ selectedCategory === category.id ? "✓ ACTIVE" : "VIEW ALL" }}
            </button>
          </div>
        </div>

        <!-- Search & Filters -->
        <div class="controls-section">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="SEARCH MESSAGES..."
              @input="debouncedSearch"
            />
          </div>
          <button @click="fetchMessages" class="btn-refresh">
            <span class="icon">↻</span>
            <span>REFRESH</span>
          </button>
          <button
            v-if="selectedCategory"
            @click="clearFilter"
            class="btn-clear"
          >
            <span class="icon">✕</span>
            <span>CLEAR FILTER</span>
          </button>
        </div>

        <!-- Messages List -->
        <div v-if="loading" class="loading-state">
          <div class="loader"></div>
          <p>LOADING MESSAGES...</p>
        </div>

        <div v-else-if="filteredMessages.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>NO MESSAGES FOUND</h3>
          <p>No messages match your current filter</p>
        </div>

        <div v-else class="messages-grid">
          <div
            v-for="message in filteredMessages"
            :key="message.id"
            class="message-card"
            :class="getCategoryClass(message)"
            @click="viewMessage(message)"
          >
            <div class="message-header">
              <div class="message-category">
                {{ getCategoryLabel(message) }}
              </div>
              <div class="message-date">
                {{ formatDate(message.received_date) }}
              </div>
            </div>
            <h4 class="message-subject">
              {{ message.subject || "[NO SUBJECT]" }}
            </h4>
            <div class="message-from">
              <span class="label">FROM:</span>
              <span class="value">{{ message.from_email }}</span>
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
          </div>
        </div>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">
            <span class="icon">👥</span>
            <span>USER MANAGEMENT</span>
          </h2>
          <button @click="showCreateUser = true" class="btn-primary">
            <span class="icon">+</span>
            <span>CREATE USER</span>
          </button>
        </div>

        <div v-if="loadingUsers" class="loading-state">
          <div class="loader"></div>
          <p>LOADING USERS...</p>
        </div>

        <div v-else class="users-grid">
          <div v-for="user in users" :key="user.id" class="user-card">
            <div class="user-header">
              <div class="user-avatar">
                {{ user.username.charAt(0).toUpperCase() }}
              </div>
              <div class="user-info">
                <h3 class="user-name">{{ user.username }}</h3>
                <div class="user-date">
                  Created: {{ formatDate(user.created_at) }}
                </div>
              </div>
            </div>

            <div class="user-details">
              <div class="detail-block">
                <div class="detail-label">ALLOWED EMAILS</div>
                <div class="detail-value">
                  {{ user.allowed_emails || "None" }}
                </div>
              </div>
              <div class="detail-block">
                <div class="detail-label">ALLOWED KEYWORDS</div>
                <div class="detail-value">
                  {{ user.allowed_keywords || "None" }}
                </div>
              </div>
            </div>

            <div class="user-actions">
              <button @click="editUserPermissions(user)" class="btn-edit">
                ✏️ EDIT
              </button>
              <button @click="deleteUser(user.id)" class="btn-delete">
                🗑️ DELETE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create User Modal -->
    <teleport to="body">
      <div
        v-if="showCreateUser"
        class="modal-overlay"
        @click="showCreateUser = false"
      >
        <div class="modal brutal" @click.stop>
          <div class="modal-header">
            <h2>CREATE NEW USER</h2>
            <button @click="showCreateUser = false" class="btn-close">✕</button>
          </div>

          <form @submit.prevent="createUser" class="modal-form">
            <div class="form-field">
              <label>USERNAME</label>
              <input v-model="newUser.username" type="text" required />
            </div>

            <div class="form-field">
              <label>PASSWORD</label>
              <input v-model="newUser.password" type="password" required />
            </div>

            <div class="form-field">
              <label>ALLOWED EMAILS *</label>
              <input
                v-model="newUser.allowedEmails"
                type="text"
                placeholder="email1@example.com, email2@example.com"
                required
              />
              <small>Separate multiple emails with commas</small>
            </div>

            <div class="form-field">
              <label>ALLOWED KEYWORDS</label>
              <input
                v-model="newUser.allowedKeywords"
                type="text"
                placeholder="otp, verification, password"
              />
              <small>Optional: Separate keywords with commas</small>
            </div>

            <div class="form-actions">
              <button
                type="button"
                @click="showCreateUser = false"
                class="btn-secondary"
              >
                CANCEL
              </button>
              <button type="submit" class="btn-primary">CREATE USER</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit User Modal -->
      <div v-if="editingUser" class="modal-overlay" @click="editingUser = null">
        <div class="modal brutal" @click.stop>
          <div class="modal-header">
            <h2>EDIT USER: {{ editingUser.username }}</h2>
            <button @click="editingUser = null" class="btn-close">✕</button>
          </div>

          <form @submit.prevent="updatePermissions" class="modal-form">
            <div class="form-field">
              <label>ALLOWED EMAILS *</label>
              <input
                v-model="editingUser.allowed_emails"
                type="text"
                required
              />
              <small>Separate multiple emails with commas</small>
            </div>

            <div class="form-field">
              <label>ALLOWED KEYWORDS</label>
              <input v-model="editingUser.allowed_keywords" type="text" />
              <small>Optional: Separate keywords with commas</small>
            </div>

            <div class="form-actions">
              <button
                type="button"
                @click="editingUser = null"
                class="btn-secondary"
              >
                CANCEL
              </button>
              <button type="submit" class="btn-primary">UPDATE</button>
            </div>
          </form>
        </div>
      </div>

      <!-- View Message Modal -->
      <div
        v-if="selectedMessage"
        class="modal-overlay"
        @click="selectedMessage = null"
      >
        <div class="modal brutal large" @click.stop>
          <div class="modal-header">
            <div
              class="message-badge"
              :class="getCategoryClass(selectedMessage)"
            >
              {{ getCategoryLabel(selectedMessage) }}
            </div>
            <button @click="selectedMessage = null" class="btn-close">✕</button>
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
                  formatDate(selectedMessage.received_date)
                }}</span>
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
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import axios from "axios";

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref("messages");
const messages = ref([]);
const users = ref([]);
const selectedMessage = ref(null);
const selectedCategory = ref(null);
const searchQuery = ref("");
const loading = ref(false);
const loadingUsers = ref(false);
const showCreateUser = ref(false);
const editingUser = ref(null);

const newUser = ref({
  username: "",
  password: "",
  allowedKeywords: "",
  allowedEmails: "",
});

const tabs = computed(() => [
  {
    id: "messages",
    icon: "📨",
    label: "MESSAGES",
    count: messages.value.length,
  },
  { id: "users", icon: "👥", label: "USERS", count: users.value.length },
]);

// Categorize messages based on subject
const categorizeMessage = (message) => {
  const subject = (message.subject || "").toLowerCase();
  const keywords = (message.keywords || "").toLowerCase();
  const combined = subject + " " + keywords;

  if (
    combined.includes("household") ||
    combined.includes("rumah") ||
    combined.includes("keluarga")
  ) {
    return "household";
  }
  if (
    combined.includes("login") ||
    combined.includes("sign in") ||
    combined.includes("masuk")
  ) {
    return "login";
  }
  if (
    combined.includes("forgot") ||
    combined.includes("reset") ||
    combined.includes("lupa") ||
    combined.includes("password")
  ) {
    return "forgot_password";
  }
  return "unknown";
};

const messageCategories = computed(() => {
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
      title: "HOUSEHOLD",
      count: counts.household,
    },
    {
      id: "login",
      icon: "🔐",
      title: "LOGIN",
      count: counts.login,
    },
    {
      id: "forgot_password",
      icon: "🔑",
      title: "PASSWORD RESET",
      count: counts.forgot_password,
    },
    {
      id: "unknown",
      icon: "❓",
      title: "UNKNOWN",
      count: counts.unknown,
    },
  ];
});

const filteredMessages = computed(() => {
  let filtered = messages.value;

  if (selectedCategory.value) {
    filtered = filtered.filter(
      (msg) => categorizeMessage(msg) === selectedCategory.value,
    );
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (msg) =>
        (msg.subject || "").toLowerCase().includes(query) ||
        (msg.from_email || "").toLowerCase().includes(query) ||
        (msg.keywords || "").toLowerCase().includes(query),
    );
  }

  return filtered;
});

let searchTimeout = null;

const fetchMessages = async () => {
  loading.value = true;
  try {
    const response = await axios.get("/api/messages");
    messages.value = response.data;
  } catch (error) {
    console.error("Error fetching messages:", error);
  } finally {
    loading.value = false;
  }
};

const fetchUsers = async () => {
  loadingUsers.value = true;
  try {
    const response = await axios.get("/api/auth/users");
    users.value = response.data;
  } catch (error) {
    console.error("Error fetching users:", error);
  } finally {
    loadingUsers.value = false;
  }
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // Search is handled by computed property
  }, 300);
};

const filterByCategory = (categoryId) => {
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = null;
  } else {
    selectedCategory.value = categoryId;
  }
};

const clearFilter = () => {
  selectedCategory.value = null;
  searchQuery.value = "";
};

const viewMessage = (message) => {
  selectedMessage.value = message;
};

const getCategoryClass = (message) => {
  return `category-${categorizeMessage(message)}`;
};

const getCategoryLabel = (message) => {
  const category = categorizeMessage(message);
  const labels = {
    household: "HOUSEHOLD",
    login: "LOGIN",
    forgot_password: "PASSWORD RESET",
    unknown: "UNKNOWN",
  };
  return labels[category] || "UNKNOWN";
};

const createUser = async () => {
  try {
    await axios.post("/api/auth/users", newUser.value);
    alert("User created successfully!");
    showCreateUser.value = false;
    newUser.value = {
      username: "",
      password: "",
      allowedKeywords: "",
      allowedEmails: "",
    };
    fetchUsers();
  } catch (error) {
    alert(error.response?.data?.error || "Failed to create user");
  }
};

const editUserPermissions = (user) => {
  editingUser.value = { ...user };
};

const updatePermissions = async () => {
  try {
    await axios.put(`/api/auth/users/${editingUser.value.id}/permissions`, {
      allowedKeywords: editingUser.value.allowed_keywords,
      allowedEmails: editingUser.value.allowed_emails,
    });
    alert("Permissions updated successfully!");
    editingUser.value = null;
    fetchUsers();
  } catch (error) {
    alert(error.response?.data?.error || "Failed to update permissions");
  }
};

const deleteUser = async (id) => {
  if (!confirm("Are you sure you want to delete this user?")) return;

  try {
    await axios.delete(`/api/auth/users/${id}`);
    users.value = users.value.filter((u) => u.id !== id);
    alert("User deleted successfully!");
  } catch (error) {
    alert("Failed to delete user");
  }
};

const handleLogout = () => {
  authStore.logout();
  router.push("/login");
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

onMounted(() => {
  fetchMessages();
  fetchUsers();
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.admin-dashboard {
  min-height: 100vh;
  background: #f5f5f0;
  font-family: "Space Mono", "Courier New", monospace;
}

/* Header */
.dashboard-header {
  background: #000;
  color: #fff;
  padding: 24px 0;
  border-bottom: 6px solid #ff6b6b;
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
  background: #ff6b6b;
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
  box-shadow: 4px 4px 0 #ff6b6b;
}

.btn-logout:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #ff6b6b;
}

.btn-logout:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 #ff6b6b;
}

/* Navigation */
.nav-tabs {
  background: #fff;
  border-bottom: 6px solid #000;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.1);
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 4px;
}

.tab-btn {
  background: transparent;
  color: #000;
  border: none;
  border-bottom: 4px solid transparent;
  padding: 20px 32px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
  position: relative;
}

.tab-btn:hover {
  background: #f5f5f0;
}

.tab-btn.active {
  background: #ffeb3b;
  border-bottom-color: #000;
}

.tab-icon {
  font-size: 20px;
}

.tab-count {
  background: #000;
  color: #fff;
  padding: 4px 10px;
  border-radius: 0;
  font-size: 12px;
  font-weight: 900;
  min-width: 32px;
  text-align: center;
}

/* Dashboard Content */
.dashboard-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
}

.tab-panel {
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.stat-card {
  background: #fff;
  border: 6px solid #000;
  padding: 24px;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.1);
}

.stat-card.household {
  border-color: #4ecdc4;
}

.stat-card.login {
  border-color: #ff6b6b;
}

.stat-card.forgot_password {
  border-color: #95e1d3;
}

.stat-card.unknown {
  border-color: #f38181;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-icon {
  font-size: 32px;
}

.stat-title {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
  letter-spacing: 1px;
}

.stat-body {
  margin-bottom: 20px;
}

.stat-number {
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-action {
  background: #000;
  color: #fff;
  border: 4px solid #000;
  padding: 12px 20px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  width: 100%;
  transition: all 0.1s;
}

.stat-action:hover {
  background: #fff;
  color: #000;
}

.stat-action.active {
  background: #ffeb3b;
  color: #000;
  border-color: #000;
}

/* Controls */
.controls-section {
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
  border-color: #000;
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
  border-top-color: #ffeb3b;
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
}

.message-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.1);
}

.message-card.category-household {
  border-left-width: 12px;
  border-left-color: #4ecdc4;
}

.message-card.category-login {
  border-left-width: 12px;
  border-left-color: #ff6b6b;
}

.message-card.category-forgot_password {
  border-left-width: 12px;
  border-left-color: #95e1d3;
}

.message-card.category-unknown {
  border-left-width: 12px;
  border-left-color: #f38181;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.message-category {
  background: #000;
  color: #fff;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.message-date {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
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

.message-from .label {
  font-weight: 900;
  opacity: 0.6;
}

.message-from .value {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-keywords {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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

/* Panel Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.panel-title {
  font-size: 32px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-primary {
  background: #ffeb3b;
  color: #000;
  border: 4px solid #000;
  padding: 16px 32px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.1s;
  box-shadow: 6px 6px 0 #000;
}

.btn-primary:hover {
  transform: translate(2px, 2px);
  box-shadow: 4px 4px 0 #000;
}

.btn-primary:active {
  transform: translate(6px, 6px);
  box-shadow: 0 0 0 #000;
}

/* Users Grid */
.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
}

.user-card {
  background: #fff;
  border: 5px solid #000;
  padding: 24px;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.user-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.1);
}

.user-header {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 4px solid #000;
}

.user-avatar {
  width: 60px;
  height: 60px;
  background: #ffeb3b;
  border: 4px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 900;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 20px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0 0 8px;
}

.user-date {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
}

.user-details {
  margin-bottom: 24px;
}

.detail-block {
  margin-bottom: 16px;
}

.detail-label {
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.detail-value {
  font-size: 14px;
  font-weight: 700;
  padding: 12px;
  background: #f5f5f0;
  border: 3px solid #000;
  word-break: break-word;
}

.user-actions {
  display: flex;
  gap: 12px;
}

.btn-edit,
.btn-delete {
  flex: 1;
  border: 4px solid #000;
  padding: 12px 20px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.1s;
}

.btn-edit {
  background: #4ecdc4;
  color: #000;
  box-shadow: 4px 4px 0 #000;
}

.btn-edit:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #000;
}

.btn-delete {
  background: #ff6b6b;
  color: #fff;
  box-shadow: 4px 4px 0 #000;
}

.btn-delete:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #000;
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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 16px 16px 0 rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
}

.modal.large {
  max-width: 900px;
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

.modal-header h2 {
  font-size: 20px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
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
}

.meta-item:last-child {
  margin-bottom: 0;
}

.meta-label {
  font-weight: 900;
  min-width: 80px;
  opacity: 0.6;
  text-transform: uppercase;
  font-size: 13px;
}

.meta-value {
  font-weight: 700;
  flex: 1;
  word-break: break-word;
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

/* Forms */
.modal-form {
  padding: 32px;
}

.form-field {
  margin-bottom: 24px;
}

.form-field label {
  display: block;
  margin-bottom: 10px;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 13px;
  letter-spacing: 1px;
}

.form-field input {
  width: 100%;
  padding: 16px;
  border: 4px solid #000;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  background: #fff;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.1);
}

.form-field input:focus {
  outline: none;
  border-color: #ffeb3b;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.2);
}

.form-field small {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
}

.form-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 32px;
  border-top: 4px solid #000;
}

.btn-secondary {
  background: #fff;
  color: #000;
  border: 4px solid #000;
  padding: 14px 28px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.1s;
  box-shadow: 4px 4px 0 #000;
}

.btn-secondary:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #000;
}

.btn-secondary:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 #000;
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

  .nav-container {
    flex-direction: column;
    padding: 0;
  }

  .tab-btn {
    width: 100%;
    justify-content: center;
    border-bottom: 4px solid #000;
  }

  .tab-btn.active {
    border-left: 6px solid #000;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .controls-section {
    flex-direction: column;
  }

  .search-box {
    min-width: auto;
  }

  .messages-grid {
    grid-template-columns: 1fr;
  }

  .users-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .panel-title {
    font-size: 24px;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-secondary,
  .btn-primary {
    width: 100%;
  }
}
</style>
