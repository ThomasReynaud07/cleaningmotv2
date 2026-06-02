<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  Sparkles, Settings, User, LogOut, Menu, X, ChevronDown,
} from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()
const mobileOpen = ref(false)
const userMenuOpen = ref(false)

onMounted(() => auth.fetchMe())

async function handleLogout() {
  await auth.logout()
  router.push('/login')
  mobileOpen.value = false
}
</script>

<template>
  <div id="app">
    <header class="navbar">
      <div class="navbar-inner">
        <RouterLink to="/" class="navbar-brand" @click="mobileOpen = false">
          <div class="brand-icon-wrap">
            <Sparkles :size="18" />
          </div>
          <span class="brand-text">ETML Cleaning</span>
        </RouterLink>

        <nav class="navbar-center">
          <RouterLink to="/" class="nav-item">Laboratoires</RouterLink>
        </nav>

        <div class="navbar-right">
          <template v-if="auth.isLoggedIn && auth.user">
            <RouterLink v-if="auth.isAdmin" to="/admin" class="nav-admin-btn">
              <Settings :size="15" />
              Admin
            </RouterLink>

            <div class="user-menu" @click="userMenuOpen = !userMenuOpen" v-click-outside="() => userMenuOpen = false">
              <div class="user-avatar" :class="{ 'avatar-admin': auth.isAdmin }">
                {{ auth.user.firstName[0] }}{{ auth.user.lastName[0] }}
              </div>
              <span class="user-name-text">{{ auth.user.firstName }}</span>
              <ChevronDown :size="14" :class="{ rotated: userMenuOpen }" class="chevron" />

              <div v-if="userMenuOpen" class="user-dropdown">
                <div class="user-dropdown-header">
                  <div class="user-avatar avatar-lg" :class="{ 'avatar-admin': auth.isAdmin }">
                    {{ auth.user.firstName[0] }}{{ auth.user.lastName[0] }}
                  </div>
                  <div>
                    <div class="dropdown-name">{{ auth.user.firstName }} {{ auth.user.lastName }}</div>
                    <div class="dropdown-email">{{ auth.user.email }}</div>
                  </div>
                </div>
                <div class="dropdown-divider"></div>
                <RouterLink to="/profile" class="dropdown-item" @click="userMenuOpen = false">
                  <User :size="15" /> Mon profil
                </RouterLink>
                <button class="dropdown-item dropdown-item-danger" @click="handleLogout">
                  <LogOut :size="15" /> Déconnexion
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <RouterLink to="/login" class="btn-login">Se connecter</RouterLink>
          </template>

          <button class="mobile-toggle" @click="mobileOpen = !mobileOpen" aria-label="Menu">
            <X v-if="mobileOpen" :size="22" />
            <Menu v-else :size="22" />
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <div class="mobile-menu" :class="{ open: mobileOpen }">
        <RouterLink to="/" class="mobile-link" @click="mobileOpen = false">Laboratoires</RouterLink>
        <template v-if="auth.isLoggedIn && auth.user">
          <RouterLink v-if="auth.isAdmin" to="/admin" class="mobile-link" @click="mobileOpen = false">
            <Settings :size="16" /> Administration
          </RouterLink>
          <RouterLink to="/profile" class="mobile-link" @click="mobileOpen = false">
            <User :size="16" /> Mon profil
          </RouterLink>
          <button class="mobile-link mobile-link-danger" @click="handleLogout">
            <LogOut :size="16" /> Déconnexion
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="mobile-link" @click="mobileOpen = false">Se connecter</RouterLink>
          <RouterLink to="/register" class="mobile-link" @click="mobileOpen = false">S'inscrire</RouterLink>
        </template>
      </div>
    </header>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-light: #eff6ff;
  --success: #16a34a;
  --success-light: #f0fdf4;
  --warning: #d97706;
  --warning-light: #fffbeb;
  --danger: #dc2626;
  --danger-light: #fef2f2;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-600: #475569;
  --gray-700: #334155;
  --gray-800: #1e293b;
  --gray-900: #0f172a;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05);
  --nav-height: 64px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
}

html { scroll-behavior: smooth; }

body {
  font-family: var(--font);
  background: var(--gray-50);
  color: var(--gray-900);
  min-height: 100vh;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a { text-decoration: none; color: inherit; }
button { font-family: inherit; }

/* ─── NAVBAR ─── */
.navbar {
  background: white;
  border-bottom: 1px solid var(--gray-200);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}
.navbar-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.navbar-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--gray-900);
  flex-shrink: 0;
}
.brand-icon-wrap {
  width: 32px; height: 32px;
  background: var(--primary);
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: white;
}
.navbar-center { display: flex; align-items: center; gap: 0.25rem; flex: 1; }
.nav-item {
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  transition: all 0.15s;
}
.nav-item:hover, .nav-item.router-link-active { color: var(--primary); background: var(--primary-light); }

.navbar-right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }

.nav-admin-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: var(--gray-100);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gray-700);
  transition: all 0.15s;
}
.nav-admin-btn:hover { background: var(--gray-200); }
.nav-admin-btn.router-link-active { background: var(--primary-light); color: var(--primary); border-color: #bfdbfe; }

/* User menu */
.user-menu {
  position: relative;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}
.user-menu:hover { background: var(--gray-100); }
.user-name-text { font-size: 0.85rem; font-weight: 500; color: var(--gray-700); }
.chevron { color: var(--gray-400); transition: transform 0.2s; }
.chevron.rotated { transform: rotate(180deg); }

.user-avatar {
  width: 30px; height: 30px;
  background: var(--primary);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; color: white; text-transform: uppercase; flex-shrink: 0;
}
.user-avatar.avatar-lg { width: 40px; height: 40px; font-size: 0.85rem; }
.avatar-admin { background: #b45309; }

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px); right: 0;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  min-width: 220px;
  z-index: 200;
  overflow: hidden;
}
.user-dropdown-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem;
  background: var(--gray-50);
}
.dropdown-name { font-size: 0.875rem; font-weight: 600; color: var(--gray-900); }
.dropdown-email { font-size: 0.75rem; color: var(--gray-500); }
.dropdown-divider { height: 1px; background: var(--gray-200); }
.dropdown-item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 1rem;
  font-size: 0.85rem; font-weight: 500;
  color: var(--gray-700);
  background: none; border: none;
  width: 100%; text-align: left;
  cursor: pointer;
  transition: background 0.1s;
  font-family: inherit;
}
.dropdown-item:hover { background: var(--gray-50); }
.dropdown-item-danger { color: var(--danger); }
.dropdown-item-danger:hover { background: var(--danger-light); }

.btn-login {
  padding: 0.45rem 1rem;
  background: var(--primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s;
}
.btn-login:hover { background: var(--primary-dark); }

.mobile-toggle {
  display: none;
  background: none; border: none;
  color: var(--gray-600); cursor: pointer;
  padding: 0.25rem; border-radius: var(--radius-sm);
}
.mobile-menu {
  display: none;
  flex-direction: column;
  border-top: 1px solid var(--gray-200);
  padding: 0.5rem 1rem 1rem;
  gap: 0.25rem;
}
.mobile-menu.open { display: flex; }
.mobile-link {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem; font-weight: 500;
  color: var(--gray-700);
  background: none; border: none;
  width: 100%; text-align: left; cursor: pointer;
  font-family: inherit; transition: background 0.1s;
}
.mobile-link:hover { background: var(--gray-100); }
.mobile-link-danger { color: var(--danger); }
.mobile-link-danger:hover { background: var(--danger-light); }

@media (max-width: 768px) {
  .mobile-toggle { display: flex; }
  .navbar-center { display: none; }
  .nav-admin-btn, .user-menu, .btn-login { display: none; }
}

/* ─── MAIN ─── */
.main-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}
@media (max-width: 640px) { .main-content { padding: 1rem; } }

/* ─── GLOBAL UTILITIES ─── */
.btn {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem; font-weight: 500;
  cursor: pointer; border: none;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-danger { background: var(--danger); color: white; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.btn-success { background: var(--success); color: white; }
.btn-success:hover:not(:disabled) { background: #15803d; }
.btn-outline {
  background: white; color: var(--gray-700);
  border: 1px solid var(--gray-200);
}
.btn-outline:hover:not(:disabled) { background: var(--gray-50); border-color: var(--gray-300); }
.btn-ghost { background: transparent; color: var(--gray-600); }
.btn-ghost:hover:not(:disabled) { background: var(--gray-100); }
.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; }
.btn-lg { padding: 0.65rem 1.25rem; font-size: 0.95rem; }

.badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em;
}
.badge-clean { background: #dcfce7; color: #166534; }
.badge-dirty { background: #fee2e2; color: #991b1b; }
.badge-needs_attention { background: #fef9c3; color: #92400e; }
.badge-pending { background: #fef9c3; color: #92400e; }
.badge-resolved { background: #dcfce7; color: #166534; }
.badge-ignored { background: var(--gray-100); color: var(--gray-500); }

.card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.form-group { margin-bottom: 1.1rem; }
.form-label {
  display: block;
  font-size: 0.8rem; font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--gray-700);
  letter-spacing: 0.01em;
}
.form-control {
  width: 100%;
  padding: 0.55rem 0.875rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  font-size: 0.875rem; font-family: inherit;
  color: var(--gray-900);
  background: white;
  transition: all 0.15s;
  outline: none;
}
.form-control:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.form-control::placeholder { color: var(--gray-400); }
textarea.form-control { resize: vertical; min-height: 90px; }

.alert { padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.875rem; margin-bottom: 1rem; display: flex; align-items: flex-start; gap: 0.5rem; }
.alert-error { background: var(--danger-light); color: #991b1b; border: 1px solid #fecaca; }
.alert-success { background: var(--success-light); color: #166534; border: 1px solid #bbf7d0; }

.spinner {
  display: inline-block;
  width: 1rem; height: 1rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
.spinner-dark { border-color: var(--gray-200); border-top-color: var(--primary); }
@keyframes spin { to { transform: rotate(360deg); } }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(15,23,42,0.5);
  backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; padding: 1rem;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.modal {
  background: white;
  border-radius: var(--radius-lg);
  width: 100%; max-width: 520px;
  max-height: 92vh; overflow-y: auto;
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.2s ease;
}
@keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
.modal-wide { max-width: 640px; }
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem;
}
.modal-header h3 { font-size: 1rem; font-weight: 600; color: var(--gray-900); }
.modal-close {
  background: var(--gray-100); border: none; cursor: pointer;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--gray-500); transition: all 0.15s; flex-shrink: 0;
}
.modal-close:hover { background: var(--gray-200); color: var(--gray-700); }
.modal-body { padding: 1.5rem; }
.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--gray-200);
  display: flex; gap: 0.75rem; justify-content: flex-end;
}

.page-header { margin-bottom: 1.75rem; }
.page-title { font-size: 1.5rem; font-weight: 700; color: var(--gray-900); margin-bottom: 0.25rem; }
.page-subtitle { color: var(--gray-500); font-size: 0.875rem; }

.empty-state { text-align: center; padding: 3rem 1rem; color: var(--gray-400); }
.empty-state svg { margin: 0 auto 1rem; opacity: 0.5; display: block; }
.empty-state p { font-size: 0.9rem; }

.loading-center {
  display: flex; align-items: center; justify-content: center;
  gap: 0.75rem; padding: 3rem; color: var(--gray-500);
  font-size: 0.875rem;
}
</style>
