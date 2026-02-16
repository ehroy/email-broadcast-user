<template>
  <div class="admin-dashboard">
    <div class="header">
      <div class="header-content">
        <div>
          <h1>⚙️ Admin Dashboard</h1>
          <p class="user-info">
            Halo Admin, <strong>{{ authStore.user?.username }}</strong>
          </p>
        </div>
        <div class="header-actions">
          <button
            @click="activeTab = 'messages'"
            :class="{ active: activeTab === 'messages' }"
            class="tab-btn"
          >
            📧 Pesan
          </button>
          <button
            @click="activeTab = 'users'"
            :class="{ active: activeTab === 'users' }"
            class="tab-btn"
          >
            👥 Users
          </button>
          <button @click="handleLogout" class="btn-logout">Keluar</button>
        </div>
      </div>
    </div>

    <div class="container">
      <!-- Messages Tab -->
      <div v-if="activeTab === 'messages'" class="tab-content">
        <div class="section-header">
          <h2>📨 Semua Pesan Email</h2>
          <div class="stats">
            <span class="badge">{{ messages.length }} pesan</span>
            <button @click="fetchMessages" class="btn-refresh">
              🔄 Refresh
            </button>
          </div>
        </div>

        <div class="search-bar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="🔍 Cari email..."
            @input="debouncedSearch"
          />
        </div>

        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <p>Memuat pesan...</p>
        </div>

        <div v-else-if="messages.length === 0" class="empty-state">
          <p>Tidak ada pesan</p>
        </div>

        <div v-else class="messages-table">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Subject</th>
                <th>Dari</th>
                <th>Keywords</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="message in messages" :key="message.id">
                <td class="date-cell">
                  {{ formatDate(message.received_date) }}
                </td>
                <td class="subject-cell">
                  {{ message.subject || "(No Subject)" }}
                </td>
                <td class="from-cell">{{ message.from_email }}</td>
                <td class="keywords-cell">
                  <span
                    v-for="keyword in message.keywords.split(',')"
                    :key="keyword"
                    class="keyword-tag"
                  >
                    {{ keyword }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button @click="viewMessage(message)" class="btn-view">
                    👁️ View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="tab-content">
        <div class="section-header">
          <h2>👥 Kelola Users</h2>
          <button @click="showCreateUser = true" class="btn-create">
            + Buat User Baru
          </button>
        </div>

        <div v-if="loadingUsers" class="loading">
          <div class="spinner"></div>
          <p>Memuat users...</p>
        </div>

        <div v-else class="users-table">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Allowed Emails</th>
                <th>Allowed Keywords</th>
                <th>Created At</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.username }}</td>
                <td>
                  <span v-if="user.allowed_emails" class="keywords-display">
                    {{ user.allowed_emails }}
                  </span>
                  <span v-else class="no-keywords">Tidak ada</span>
                </td>
                <td>
                  <span v-if="user.allowed_keywords" class="keywords-display">
                    {{ user.allowed_keywords }}
                  </span>
                  <span v-else class="no-keywords">Tidak ada</span>
                </td>
                <td>{{ formatDate(user.created_at) }}</td>
                <td class="actions-cell">
                  <button @click="editUserPermissions(user)" class="btn-edit">
                    ✏️ Edit
                  </button>
                  <button @click="deleteUser(user.id)" class="btn-delete">
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create User Modal -->
    <div v-if="showCreateUser" class="modal" @click="showCreateUser = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Buat User Baru</h2>
          <button @click="showCreateUser = false" class="btn-close">×</button>
        </div>

        <form @submit.prevent="createUser" class="modal-body">
          <div class="form-group">
            <label>Username</label>
            <input v-model="newUser.username" type="text" required />
          </div>

          <div class="form-group">
            <label>Password</label>
            <input v-model="newUser.password" type="password" required />
          </div>

          <div class="form-group">
            <label>Allowed Emails (pisahkan dengan koma) *</label>
            <input
              v-model="newUser.allowedEmails"
              type="text"
              placeholder="noreply@facebook.com, support@twitter.com"
              required
            />
            <small
              >⚠️ PENTING: User hanya bisa akses email dari alamat ini. Contoh:
              noreply@facebook.com, notifications@instagram.com</small
            >
          </div>

          <div class="form-group">
            <label>Allowed Keywords (pisahkan dengan koma)</label>
            <input
              v-model="newUser.allowedKeywords"
              type="text"
              placeholder="otp, verification, kode verifikasi"
            />
            <small>Contoh: otp, verification code, kode otp</small>
          </div>

          <div class="form-actions">
            <button
              type="button"
              @click="showCreateUser = false"
              class="btn-cancel"
            >
              Batal
            </button>
            <button type="submit" class="btn-submit">Buat User</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Permissions Modal -->
    <div v-if="editingUser" class="modal" @click="editingUser = null">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Edit Permissions: {{ editingUser.username }}</h2>
          <button @click="editingUser = null" class="btn-close">×</button>
        </div>

        <form @submit.prevent="updatePermissions" class="modal-body">
          <div class="form-group">
            <label>Allowed Emails (pisahkan dengan koma) *</label>
            <input
              v-model="editingUser.allowed_emails"
              type="text"
              placeholder="noreply@facebook.com, support@twitter.com"
              required
            />
            <small
              >⚠️ PENTING: User hanya bisa akses email dari alamat ini</small
            >
          </div>

          <div class="form-group">
            <label>Allowed Keywords (pisahkan dengan koma)</label>
            <input
              v-model="editingUser.allowed_keywords"
              type="text"
              placeholder="otp, verification, kode verifikasi"
            />
            <small>Contoh: otp, verification code, kode otp</small>
          </div>

          <div class="form-actions">
            <button
              type="button"
              @click="editingUser = null"
              class="btn-cancel"
            >
              Batal
            </button>
            <button type="submit" class="btn-submit">Update</button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Message Modal -->
    <div v-if="selectedMessage" class="modal" @click="selectedMessage = null">
      <div class="modal-content large" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedMessage.subject || "(No Subject)" }}</h2>
          <button @click="selectedMessage = null" class="btn-close">×</button>
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
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import axios from "axios";

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref("messages");
const messages = ref([]);
const users = ref([]);
const selectedMessage = ref(null);
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

let searchTimeout = null;

const fetchMessages = async () => {
  loading.value = true;
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
    fetchMessages();
  }, 500);
};

const viewMessage = (message) => {
  selectedMessage.value = message;
};

const createUser = async () => {
  try {
    await axios.post("/api/auth/users", newUser.value);
    alert("User berhasil dibuat!");
    showCreateUser.value = false;
    newUser.value = {
      username: "",
      password: "",
      allowedKeywords: "",
      allowedEmails: "",
    };
    fetchUsers();
  } catch (error) {
    alert(error.response?.data?.error || "Gagal membuat user");
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
    alert("Permissions berhasil diupdate!");
    editingUser.value = null;
    fetchUsers();
  } catch (error) {
    alert(error.response?.data?.error || "Gagal mengupdate permissions");
  }
};

const deleteUser = async (id) => {
  if (!confirm("Yakin ingin menghapus user ini?")) return;

  try {
    await axios.delete(`/api/auth/users/${id}`);
    users.value = users.value.filter((u) => u.id !== id);
  } catch (error) {
    alert("Gagal menghapus user");
  }
};

const handleLogout = () => {
  authStore.logout();
  router.push("/login");
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("id-ID", {
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
.admin-dashboard {
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
  max-width: 1400px;
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

.header-actions {
  display: flex;
  gap: 12px;
}

.tab-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid transparent;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tab-btn.active {
  background: white;
  color: #667eea;
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  color: #2d3748;
  font-size: 24px;
}

.stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.badge {
  background: #edf2f7;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
}

.btn-refresh,
.btn-create {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover,
.btn-create:hover {
  background: #5568d3;
  transform: translateY(-2px);
}

.search-bar {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.search-bar input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 15px;
}

.search-bar input:focus {
  outline: none;
  border-color: #667eea;
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
  padding: 60px 20px;
  color: #718096;
}

.messages-table,
.users-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f7fafc;
}

th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
}

td {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

tr:hover {
  background: #f7fafc;
}

.date-cell {
  white-space: nowrap;
  color: #718096;
  font-size: 13px;
}

.subject-cell {
  font-weight: 500;
  color: #2d3748;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.from-cell {
  color: #718096;
  font-size: 14px;
}

.keywords-cell {
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

.keywords-display {
  font-family: monospace;
  background: #f7fafc;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #4a5568;
}

.no-keywords {
  color: #a0aec0;
  font-style: italic;
  font-size: 13px;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.btn-view,
.btn-edit {
  background: #48bb78;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-view:hover,
.btn-edit:hover {
  background: #38a169;
}

.btn-delete {
  background: #fc8181;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #f56565;
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
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-content.large {
  max-width: 800px;
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  color: #2d3748;
  font-size: 20px;
}

.btn-close {
  background: #edf2f7;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #e2e8f0;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #4a5568;
  font-weight: 500;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 15px;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #718096;
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-cancel {
  background: #e2e8f0;
  color: #4a5568;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #cbd5e0;
}

.btn-submit {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-submit:hover {
  background: #5568d3;
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

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .section-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  table {
    font-size: 13px;
  }

  th,
  td {
    padding: 12px 8px;
  }
}
</style>
