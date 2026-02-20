import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import Login from "../views/Login.vue";
import UserDashboard from "../views/UserDashboard.vue";
import AdminDashboard from "../views/AdminDashboard.vue";

const routes = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/dashboard",
    name: "UserDashboard",
    component: UserDashboard,
    meta: { requiresAuth: true, requiresAdmin: false },
  },
  {
    path: "/admin",
    name: "AdminDashboard",
    component: AdminDashboard,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // 🔥 Jika ada token tapi user belum dimuat
  if (authStore.token && !authStore.user) {
    await authStore.fetchUser();
  }

  // Belum login
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next("/login");
  }

  // Sudah login dan buka login lagi
  if (to.path === "/login" && authStore.isLoggedIn) {
    return next(authStore.isAdmin ? "/admin" : "/dashboard");
  }

  // Cegah user masuk admin
  if (to.path.startsWith("/admin") && !authStore.isAdmin) {
    return next("/dashboard");
  }

  // Cegah admin masuk dashboard
  if (to.path.startsWith("/dashboard") && authStore.isAdmin) {
    return next("/admin");
  }

  next();
});

export default router;
