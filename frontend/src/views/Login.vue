<template>
  <div class="login-page">
    <div class="background-grid"></div>

    <div class="login-container">
      <!-- Logo Section -->
      <div class="logo-section">
        <div class="logo-box">
          <div class="logo-icon">📧</div>
          <h1 class="logo-text">OTP BROADCAST</h1>
        </div>
        <div class="logo-tagline">
          <span class="bracket">[</span>
          <span class="text">SECURE EMAIL GATEWAY</span>
          <span class="bracket">]</span>
        </div>
      </div>

      <!-- Login Box -->
      <div class="login-box">
        <div class="box-header">
          <h2>ACCESS CONTROL</h2>
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">SYSTEM ONLINE</span>
          </div>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="username">
              <span class="label-icon">👤</span>
              <span class="label-text">USERNAME</span>
            </label>
            <div class="input-wrapper">
              <input
                id="username"
                v-model="username"
                type="text"
                placeholder="Enter username"
                required
                :disabled="loading"
                autocomplete="username"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="password">
              <span class="label-icon">🔒</span>
              <span class="label-text">PASSWORD</span>
            </label>
            <div class="input-wrapper">
              <input
                id="password"
                v-model="password"
                type="password"
                placeholder="Enter password"
                required
                :disabled="loading"
                autocomplete="current-password"
              />
            </div>
          </div>

          <div v-if="error" class="error-box">
            <div class="error-icon">⚠️</div>
            <div class="error-content">
              <div class="error-title">ACCESS DENIED</div>
              <div class="error-message">{{ error }}</div>
            </div>
          </div>

          <button type="submit" class="btn-login" :disabled="loading">
            <span v-if="!loading" class="btn-content">
              <span class="btn-text">LOGIN</span>
              <span class="btn-arrow">→</span>
            </span>
            <span v-else class="btn-loading">
              <span class="loading-spinner"></span>
              <span class="loading-text">AUTHENTICATING...</span>
            </span>
          </button>
        </form>
      </div>

      <!-- Footer -->
      <div class="login-footer">
        <div class="footer-text">POWERED BY <strong>BRUTALISM UI</strong></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const handleLogin = async () => {
  loading.value = true;
  error.value = "";

  try {
    await authStore.login(username.value, password.value);

    // Redirect based on role
    if (authStore.isAdmin) {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  } catch (err) {
    error.value = err.response?.data?.error || "Invalid credentials";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f5f5f0;
  font-family: "Space Mono", "Courier New", monospace;
  position: relative;
  overflow: hidden;
}

/* Background Grid */
.background-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 50px,
      rgba(0, 0, 0, 0.03) 50px,
      rgba(0, 0, 0, 0.03) 51px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 50px,
      rgba(0, 0, 0, 0.03) 50px,
      rgba(0, 0, 0, 0.03) 51px
    );
  pointer-events: none;
}

/* Container */
.login-container {
  width: 100%;
  max-width: 520px;
  position: relative;
  z-index: 1;
  animation: slideIn 0.6s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Logo Section */
.logo-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo-box {
  background: #000;
  color: #fff;
  padding: 24px;
  border: 6px solid #000;
  box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.2);
  margin-bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  font-size: 48px;
  line-height: 1;
}

.logo-text {
  font-size: 32px;
  font-weight: 900;
  margin: 0;
  letter-spacing: -1px;
  text-transform: uppercase;
}

.logo-tagline {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #000;
}

.bracket {
  opacity: 0.3;
  margin: 0 8px;
}

.text {
  background: #ffeb3b;
  padding: 6px 16px;
  border: 3px solid #000;
}

/* Login Box */
.login-box {
  background: #fff;
  border: 8px solid #000;
  box-shadow: 16px 16px 0 rgba(0, 0, 0, 0.2);
  animation: boxFloat 3s ease-in-out infinite;
}

@keyframes boxFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.box-header {
  background: #4ecdc4;
  color: #000;
  padding: 24px;
  border-bottom: 6px solid #000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.box-header h2 {
  font-size: 20px;
  font-weight: 900;
  text-transform: uppercase;
  margin: 0;
  letter-spacing: 1px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #000;
  color: #fff;
  padding: 6px 12px;
  border: 3px solid #000;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #48bb78;
  border-radius: 50%;
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

/* Form */
.login-form {
  padding: 40px;
}

.form-group {
  margin-bottom: 32px;
}

label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 13px;
  letter-spacing: 1px;
}

.label-icon {
  font-size: 20px;
}

.input-wrapper {
  position: relative;
}

input {
  width: 100%;
  padding: 18px 20px;
  border: 5px solid #000;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  background: #fff;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  text-transform: uppercase;
}

input:focus {
  outline: none;
  border-color: #4ecdc4;
  box-shadow: 8px 8px 0 rgba(78, 205, 196, 0.3);
  transform: translate(-2px, -2px);
}

input::placeholder {
  opacity: 0.4;
  text-transform: none;
  font-weight: 600;
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Error Box */
.error-box {
  background: #ff6b6b;
  color: #fff;
  border: 5px solid #000;
  padding: 20px;
  margin-bottom: 32px;
  display: flex;
  gap: 16px;
  align-items: start;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.2);
  animation: shake 0.5s;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-5px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(5px);
  }
}

.error-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
}

.error-title {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.error-message {
  font-size: 13px;
  font-weight: 700;
}

/* Login Button */
.btn-login {
  width: 100%;
  background: #000;
  color: #fff;
  border: 6px solid #000;
  padding: 20px;
  font-size: 18px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;
  box-shadow: 8px 8px 0 #ffeb3b;
  position: relative;
  overflow: hidden;
  font-family: inherit;
}

.btn-login:hover:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 6px 6px 0 #ffeb3b;
}

.btn-login:active:not(:disabled) {
  transform: translate(8px, 8px);
  box-shadow: 0 0 0 #ffeb3b;
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.btn-arrow {
  font-size: 24px;
  transition: transform 0.3s;
}

.btn-login:hover:not(:disabled) .btn-arrow {
  transform: translateX(5px);
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Info Box */
.info-box {
  padding: 24px 40px 40px;
  border-top: 6px solid #000;
  background: #f5f5f0;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 3px solid #000;
}

.info-icon {
  font-size: 20px;
}

.info-title {
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  background: #fff;
  border: 4px solid #000;
  padding: 12px 16px;
}

.info-label {
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 4px;
  letter-spacing: 1px;
}

.info-value {
  font-size: 14px;
  font-weight: 700;
  font-family: monospace;
}

/* Footer */
.login-footer {
  margin-top: 32px;
  text-align: center;
}

.footer-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #000;
  color: #fff;
  padding: 12px 20px;
  border: 4px solid #000;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 1px;
  margin-bottom: 16px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.2);
}

.badge-icon {
  font-size: 16px;
}

.footer-text {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.6;
  letter-spacing: 2px;
}

.footer-text strong {
  color: #000;
  opacity: 1;
}

/* Responsive */
@media (max-width: 600px) {
  .login-page {
    padding: 16px;
  }

  .logo-box {
    flex-direction: column;
    padding: 20px;
    gap: 12px;
  }

  .logo-icon {
    font-size: 40px;
  }

  .logo-text {
    font-size: 24px;
  }

  .logo-tagline {
    font-size: 11px;
  }

  .login-box {
    border-width: 6px;
    box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.2);
  }

  .box-header {
    padding: 20px;
    flex-direction: column;
    align-items: flex-start;
  }

  .login-form,
  .info-box {
    padding: 24px;
  }

  input {
    padding: 16px;
    font-size: 15px;
  }

  .btn-login {
    padding: 18px;
    font-size: 16px;
  }

  .error-box {
    flex-direction: column;
    gap: 12px;
  }
}

@media (max-width: 400px) {
  .logo-text {
    font-size: 20px;
  }

  .logo-tagline {
    font-size: 10px;
  }

  .bracket {
    display: none;
  }
}
</style>
