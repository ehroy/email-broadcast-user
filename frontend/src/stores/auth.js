import { defineStore } from "pinia";
import axios from "axios";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    token: localStorage.getItem("token") || null,
    isLoaded: false, // 🔥 supaya tidak fetch berkali-kali
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === "admin",
  },

  actions: {
    // 🔥 Init auth saat app start / refresh
    async initAuth() {
      if (!this.token || this.isLoaded) return;

      try {
        axios.defaults.headers.common["Authorization"] = `Bearer ${this.token}`;

        const response = await axios.get("/api/auth/me");
        this.user = response.data;
      } catch (error) {
        this.logout();
      } finally {
        this.isLoaded = true;
      }
    },

    async login(username, password) {
      try {
        const response = await axios.post("/api/auth/login", {
          username,
          password,
        });

        this.token = response.data.token;
        this.user = response.data.user;
        this.isLoaded = true;

        localStorage.setItem("token", this.token);

        axios.defaults.headers.common["Authorization"] = `Bearer ${this.token}`;

        return true;
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },

    async fetchUser() {
      if (!this.token) return;

      try {
        axios.defaults.headers.common["Authorization"] = `Bearer ${this.token}`;

        const response = await axios.get("/api/auth/me");
        this.user = response.data;
      } catch (error) {
        this.logout();
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      this.isLoaded = false;

      localStorage.removeItem("token");

      delete axios.defaults.headers.common["Authorization"];
    },
  },
});
