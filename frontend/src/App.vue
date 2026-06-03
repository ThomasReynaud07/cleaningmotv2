<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { messagesApi, adminMessagesApi, type Message, type ThreadSummary } from '@/services/api'
import {
  Sparkles, Settings, User, LogOut, Menu, X, ChevronDown,
  MessageCircle, Send, Mail, ChevronLeft, Moon, Sun,
} from 'lucide-vue-next'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const route = useRoute()
const isAuthPage = computed(() => route.name === 'login' || route.name === 'register')
const mobileOpen = ref(false)
const userMenuOpen = ref(false)

// ─── Chat (shared) ───────────────────────────────────────────────────────────
const chatOpen = ref(false)
const chatUnread = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null

// ─── Chat (non-admin user) ───────────────────────────────────────────────────
const chatMessages = ref<Message[]>([])
const chatLoading = ref(false)
const chatNewMsg = ref('')
const chatSending = ref(false)
const chatThreadRef = ref<HTMLElement | null>(null)

// ─── Chat (admin) ────────────────────────────────────────────────────────────
const adminChatView = ref<'list' | 'thread'>('list')
const adminChatUsers = ref<ThreadSummary[]>([])
const adminSelectedUser = ref<{ id: number; firstName: string; lastName: string } | null>(null)
const adminChatMessages = ref<Message[]>([])
const adminChatLoading = ref(false)
const adminChatNewMsg = ref('')
const adminChatSending = ref(false)
const adminChatThreadRef = ref<HTMLElement | null>(null)

// ─── Unread polling ───────────────────────────────────────────────────────────
async function fetchUnread() {
  if (!auth.isLoggedIn) return
  try {
    if (auth.isAdmin) {
      const { data } = await adminMessagesApi.unreadCount()
      chatUnread.value = data.unread
    } else {
      const { data } = await messagesApi.unreadCount()
      chatUnread.value = data.unread
    }
  } catch {}
}

// ─── Toggle bubble ────────────────────────────────────────────────────────────
async function toggleChat() {
  if (chatOpen.value) { chatOpen.value = false; return }
  chatOpen.value = true
  if (auth.isAdmin) {
    adminChatView.value = 'list'
    await loadAdminList()
  } else {
    await loadUserThread()
  }
}

// ─── User thread ──────────────────────────────────────────────────────────────
async function loadUserThread() {
  chatLoading.value = true
  try {
    const { data } = await messagesApi.getThread()
    chatMessages.value = data
    chatUnread.value = 0
    await nextTick()
    chatThreadRef.value?.scrollTo({ top: chatThreadRef.value.scrollHeight })
  } finally { chatLoading.value = false }
}

async function sendChatMessage() {
  if (!chatNewMsg.value.trim() || chatSending.value) return
  chatSending.value = true
  try {
    const { data } = await messagesApi.send(chatNewMsg.value)
    chatMessages.value.push(data)
    chatNewMsg.value = ''
    await nextTick()
    chatThreadRef.value?.scrollTo({ top: chatThreadRef.value.scrollHeight, behavior: 'smooth' })
  } finally { chatSending.value = false }
}

// ─── Admin: list + thread ─────────────────────────────────────────────────────
async function loadAdminList() {
  adminChatLoading.value = true
  try {
    const { data } = await adminMessagesApi.listThreads()
    adminChatUsers.value = data
  } finally { adminChatLoading.value = false }
}

async function openAdminThread(user: { id: number; firstName: string; lastName: string }) {
  adminSelectedUser.value = user
  adminChatView.value = 'thread'
  adminChatLoading.value = true
  try {
    const { data } = await adminMessagesApi.getThread(user.id)
    adminChatMessages.value = data
    const t = adminChatUsers.value.find(t => t.user.id === user.id)
    if (t) t.unreadCount = 0
    chatUnread.value = adminChatUsers.value.reduce((s, t) => s + t.unreadCount, 0)
    await nextTick()
    adminChatThreadRef.value?.scrollTo({ top: adminChatThreadRef.value.scrollHeight })
  } finally { adminChatLoading.value = false }
}

async function sendAdminMessage() {
  if (!adminSelectedUser.value || !adminChatNewMsg.value.trim() || adminChatSending.value) return
  adminChatSending.value = true
  try {
    const { data } = await adminMessagesApi.reply(adminSelectedUser.value.id, adminChatNewMsg.value)
    adminChatMessages.value.push(data)
    adminChatNewMsg.value = ''
    await nextTick()
    adminChatThreadRef.value?.scrollTo({ top: adminChatThreadRef.value.scrollHeight, behavior: 'smooth' })
  } finally { adminChatSending.value = false }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))
}

function formatShortDate(d: string | null) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  if (date.toDateString() === now.toDateString())
    return new Intl.DateTimeFormat('fr-CH', { hour: '2-digit', minute: '2-digit' }).format(date)
  return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short' }).format(date)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await auth.fetchMe()
  if (auth.isLoggedIn) {
    fetchUnread()
    pollTimer = setInterval(fetchUnread, 30_000)
  }
})

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

async function handleLogout() {
  await auth.logout()
  router.push('/login')
  mobileOpen.value = false
  chatOpen.value = false
}
</script>

<template>
  <div id="app">
    <header class="navbar">
      <div class="navbar-inner">
        <RouterLink to="/" class="navbar-brand" @click="mobileOpen = false">
          <div class="brand-icon-wrap"><Sparkles :size="18" /></div>
          <span class="brand-text">ETML Cleaning</span>
        </RouterLink>

        <nav v-if="!isAuthPage" class="navbar-center">
          <RouterLink to="/" class="nav-item">Laboratoires</RouterLink>
        </nav>

        <div class="navbar-right">
          <template v-if="auth.isLoggedIn && auth.user">
            <RouterLink v-if="auth.isAdmin" to="/admin" class="nav-admin-btn">
              <Settings :size="15" /> Admin
            </RouterLink>

            <!-- Chat bubble (tous les users connectés) -->
            <button
              class="chat-btn"
              :class="{ 'chat-btn-active': chatOpen }"
              @click="toggleChat"
              aria-label="Messages"
            >
              <MessageCircle :size="20" />
              <span v-if="chatUnread > 0" class="chat-badge">{{ chatUnread > 9 ? '9+' : chatUnread }}</span>
            </button>

            <div class="user-menu" @click="userMenuOpen = !userMenuOpen" v-click-outside="() => userMenuOpen = false">
              <div class="user-avatar" :class="{ 'avatar-admin': auth.isAdmin }">
                <img v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" class="avatar-img" alt="" />
                <template v-else>{{ auth.user.firstName[0] }}{{ auth.user.lastName[0] }}</template>
              </div>
              <span class="user-name-text">{{ auth.user.firstName }}</span>
              <ChevronDown :size="14" :class="{ rotated: userMenuOpen }" class="chevron" />

              <div v-if="userMenuOpen" class="user-dropdown">
                <div class="user-dropdown-header">
                  <div class="user-avatar avatar-lg" :class="{ 'avatar-admin': auth.isAdmin }">
                    <img v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" class="avatar-img" alt="" />
                    <template v-else>{{ auth.user.firstName[0] }}{{ auth.user.lastName[0] }}</template>
                  </div>
                  <div>
                    <div class="dropdown-name">{{ auth.user.firstName }} {{ auth.user.lastName }}</div>
                    <div class="dropdown-email">{{ auth.user.email }}</div>
                  </div>
                </div>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" @click="theme.toggle()">
                  <Moon v-if="!theme.isDark" :size="15" /> <Sun v-else :size="15" />
                  {{ theme.isDark ? 'Mode clair' : 'Mode sombre' }}
                </button>
                <RouterLink to="/profile" class="dropdown-item" @click="userMenuOpen = false">
                  <User :size="15" /> Mon profil
                </RouterLink>
                <button class="dropdown-item dropdown-item-danger" @click="handleLogout">
                  <LogOut :size="15" /> Déconnexion
                </button>
              </div>
            </div>
          </template>

          <template v-else-if="!isAuthPage">
            <RouterLink to="/login" class="btn-login">Se connecter</RouterLink>
          </template>

          <button v-if="!isAuthPage" class="mobile-toggle" @click="mobileOpen = !mobileOpen" aria-label="Menu">
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

    <!-- Backdrop -->
    <div v-if="chatOpen" class="chat-backdrop" @click="chatOpen = false"></div>

    <!-- ─── Chat panel ─── -->
    <div v-if="chatOpen && auth.isLoggedIn" class="chat-panel card">

      <!-- ══ Mode USER ══ -->
      <template v-if="!auth.isAdmin">
        <div class="chat-panel-header">
          <div class="chat-panel-title">
            <MessageCircle :size="15" style="color:#7c3aed" />
            <span>Messages — Administration</span>
          </div>
          <button class="modal-close" @click="chatOpen = false"><X :size="14" /></button>
        </div>
        <div class="chat-panel-thread" ref="chatThreadRef">
          <div v-if="chatLoading" class="chat-loading"><span class="spinner spinner-dark"></span></div>
          <div v-else-if="!chatMessages.length" class="chat-empty">
            <Mail :size="28" style="color:var(--gray-300);display:block;margin:0 auto 0.5rem" />
            <p>Aucun message.<br>Écrivez pour contacter un administrateur.</p>
          </div>
          <template v-else>
            <div v-for="m in chatMessages" :key="m.id" class="bubble-row" :class="m.fromMe ? 'bubble-row-right' : 'bubble-row-left'">
              <div class="bubble" :class="m.fromMe ? 'bubble-me' : 'bubble-other'">
                <div class="bubble-sender">{{ m.fromMe ? 'Moi' : m.sender.firstName + ' ' + m.sender.lastName }}</div>
                <div class="bubble-text">{{ m.content }}</div>
                <div class="bubble-time">{{ formatDate(m.createdAt) }}</div>
              </div>
            </div>
          </template>
        </div>
        <div class="chat-compose">
          <textarea v-model="chatNewMsg" class="form-control chat-input" rows="2" placeholder="Votre message… (Ctrl+Entrée)" @keydown.ctrl.enter="sendChatMessage"></textarea>
          <button class="btn btn-primary chat-send" @click="sendChatMessage" :disabled="!chatNewMsg.trim() || chatSending">
            <span v-if="chatSending" class="spinner"></span>
            <Send v-else :size="14" />
          </button>
        </div>
      </template>

      <!-- ══ Mode ADMIN — liste des fils ══ -->
      <template v-else-if="adminChatView === 'list'">
        <div class="chat-panel-header">
          <div class="chat-panel-title">
            <MessageCircle :size="15" style="color:#7c3aed" />
            <span>Messages utilisateurs</span>
            <span v-if="chatUnread > 0" class="chat-panel-badge">{{ chatUnread }}</span>
          </div>
          <button class="modal-close" @click="chatOpen = false"><X :size="14" /></button>
        </div>
        <div class="chat-panel-thread chat-list-thread">
          <div v-if="adminChatLoading" class="chat-loading"><span class="spinner spinner-dark"></span></div>
          <div v-else-if="!adminChatUsers.length" class="chat-empty">
            <Mail :size="28" style="color:var(--gray-300);display:block;margin:0 auto 0.5rem" />
            <p>Aucun message reçu pour l'instant.</p>
          </div>
          <button
            v-else
            v-for="t in adminChatUsers"
            :key="t.user.id"
            class="chat-user-row"
            :class="{ 'chat-user-row-unread': t.unreadCount > 0 }"
            @click="openAdminThread(t.user)"
          >
            <div class="chat-user-avatar">{{ t.user.firstName[0] }}{{ t.user.lastName[0] }}</div>
            <div class="chat-user-info">
              <div class="chat-user-name">
                {{ t.user.firstName }} {{ t.user.lastName }}
                <span v-if="t.unreadCount > 0" class="chat-unread-pill">{{ t.unreadCount }}</span>
              </div>
              <div class="chat-user-preview">{{ t.lastMessage }}</div>
            </div>
            <div class="chat-user-time">{{ formatShortDate(t.lastMessageAt) }}</div>
          </button>
        </div>
      </template>

      <!-- ══ Mode ADMIN — fil d'un user ══ -->
      <template v-else>
        <div class="chat-panel-header">
          <button class="chat-back-btn" @click="adminChatView = 'list'">
            <ChevronLeft :size="16" />
          </button>
          <div class="chat-panel-title" style="flex:1">
            {{ adminSelectedUser?.firstName }} {{ adminSelectedUser?.lastName }}
          </div>
          <button class="modal-close" @click="chatOpen = false"><X :size="14" /></button>
        </div>
        <div class="chat-panel-thread" ref="adminChatThreadRef">
          <div v-if="adminChatLoading" class="chat-loading"><span class="spinner spinner-dark"></span></div>
          <div v-else-if="!adminChatMessages.length" class="chat-empty">
            <Mail :size="28" style="color:var(--gray-300);display:block;margin:0 auto 0.5rem" />
            <p>Aucun message dans ce fil.</p>
          </div>
          <template v-else>
            <div v-for="m in adminChatMessages" :key="m.id" class="bubble-row" :class="m.fromMe ? 'bubble-row-right' : 'bubble-row-left'">
              <div class="bubble" :class="m.fromMe ? 'bubble-admin-me' : 'bubble-other'">
                <div class="bubble-sender">{{ m.fromMe ? 'Vous' : m.sender.firstName + ' ' + m.sender.lastName }}</div>
                <div class="bubble-text">{{ m.content }}</div>
                <div class="bubble-time">{{ formatDate(m.createdAt) }}</div>
              </div>
            </div>
          </template>
        </div>
        <div class="chat-compose">
          <textarea v-model="adminChatNewMsg" class="form-control chat-input" rows="2" placeholder="Répondre… (Ctrl+Entrée)" @keydown.ctrl.enter="sendAdminMessage"></textarea>
          <button class="btn btn-primary chat-send" @click="sendAdminMessage" :disabled="!adminChatNewMsg.trim() || adminChatSending">
            <span v-if="adminChatSending" class="spinner"></span>
            <Send v-else :size="14" />
          </button>
        </div>
      </template>

    </div>

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
  font-family: var(--font); background: var(--gray-50); color: var(--gray-900);
  min-height: 100vh; line-height: 1.5; -webkit-font-smoothing: antialiased;
}
a { text-decoration: none; color: inherit; }
button { font-family: inherit; }

/* ─── NAVBAR ─── */
.navbar {
  background: white; border-bottom: 1px solid var(--gray-200);
  position: sticky; top: 0; z-index: 100; box-shadow: var(--shadow-sm);
}
.navbar-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 1.5rem;
  height: var(--nav-height); display: flex; align-items: center; gap: 1.5rem;
}
.navbar-brand {
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 1.1rem; font-weight: 700; color: var(--gray-900); flex-shrink: 0;
}
.brand-icon-wrap {
  width: 32px; height: 32px; background: var(--primary); border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; color: white;
}
.navbar-center { display: flex; align-items: center; gap: 0.25rem; flex: 1; }
.nav-item {
  padding: 0.4rem 0.75rem; border-radius: var(--radius-sm);
  font-size: 0.875rem; font-weight: 500; color: var(--gray-600); transition: all 0.15s;
}
.nav-item:hover, .nav-item.router-link-active { color: var(--primary); background: var(--primary-light); }
.navbar-right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
.nav-admin-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.85rem; background: var(--gray-100);
  border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
  font-size: 0.8rem; font-weight: 600; color: var(--gray-700); transition: all 0.15s;
}
.nav-admin-btn:hover { background: var(--gray-200); }
.nav-admin-btn.router-link-active { background: var(--primary-light); color: var(--primary); border-color: #bfdbfe; }

/* ─── Chat bubble button ─── */
.chat-btn {
  position: relative; background: none; border: none; cursor: pointer;
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--gray-500); transition: all 0.15s; flex-shrink: 0;
}
.chat-btn:hover { background: var(--gray-100); color: var(--gray-700); }
.chat-btn.chat-btn-active { color: #7c3aed; background: #f5f3ff; }
.chat-badge {
  position: absolute; top: 1px; right: 1px;
  background: var(--danger); color: white;
  min-width: 16px; height: 16px; border-radius: 999px;
  font-size: 0.6rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 3px; border: 2px solid white;
}

/* ─── Chat panel ─── */
.chat-backdrop { position: fixed; inset: 0; z-index: 150; }
.chat-panel {
  position: fixed; top: calc(var(--nav-height) + 10px); right: 1rem;
  width: 340px; height: 480px; z-index: 200;
  display: flex; flex-direction: column; overflow: hidden;
  animation: slideUp 0.2s ease;
}
.chat-panel-header {
  padding: 0.75rem 1rem; border-bottom: 1px solid var(--gray-200); background: #f5f3ff;
  display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;
}
.chat-panel-title {
  display: flex; align-items: center; gap: 0.45rem;
  font-size: 0.85rem; font-weight: 600; color: var(--gray-800); flex: 1;
}
.chat-panel-badge {
  background: var(--danger); color: white; min-width: 18px; height: 18px;
  border-radius: 999px; font-size: 0.62rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;
}
.chat-panel-thread {
  flex: 1; overflow-y: auto; padding: 0.875rem;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.chat-list-thread { padding: 0; gap: 0; }
.chat-loading { display: flex; justify-content: center; padding: 1.5rem; }
.chat-empty { text-align: center; padding: 2rem 1rem; color: var(--gray-400); font-size: 0.8rem; line-height: 1.6; }
.chat-compose {
  display: flex; gap: 0.5rem; padding: 0.75rem 0.875rem;
  border-top: 1px solid var(--gray-200); background: var(--gray-50);
  align-items: flex-end; flex-shrink: 0;
}
.chat-input { flex: 1; resize: none; font-size: 0.8rem; min-height: unset; }
.chat-send { flex-shrink: 0; height: 34px; padding: 0 0.75rem; }
.chat-back-btn {
  background: none; border: none; cursor: pointer; color: var(--gray-500);
  display: flex; align-items: center; padding: 0.2rem; border-radius: 4px;
  transition: all 0.15s; flex-shrink: 0;
}
.chat-back-btn:hover { color: var(--gray-800); background: rgba(0,0,0,0.06); }

/* Admin chat user list */
.chat-user-row {
  display: flex; align-items: center; gap: 0.75rem;
  width: 100%; padding: 0.875rem 1rem;
  border: none; background: none; cursor: pointer; text-align: left;
  border-bottom: 1px solid var(--gray-100); transition: background 0.1s;
  font-family: inherit;
}
.chat-user-row:hover { background: var(--gray-50); }
.chat-user-row:last-child { border-bottom: none; }
.chat-user-row-unread { background: #fafafe; }
.chat-user-row-unread:hover { background: #f3f0ff; }
.chat-user-avatar {
  width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0;
}
.chat-user-info { flex: 1; min-width: 0; }
.chat-user-name {
  font-size: 0.85rem; font-weight: 600; color: var(--gray-900);
  display: flex; align-items: center; gap: 0.4rem;
}
.chat-unread-pill {
  background: var(--primary); color: white; min-width: 16px; height: 16px;
  border-radius: 999px; font-size: 0.6rem; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; padding: 0 3px;
}
.chat-user-preview {
  font-size: 0.78rem; color: var(--gray-400);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.1rem;
}
.chat-user-time { font-size: 0.72rem; color: var(--gray-400); flex-shrink: 0; }

/* ─── Bubble UI ─── */
.bubble-row { display: flex; }
.bubble-row-right { justify-content: flex-end; }
.bubble-row-left { justify-content: flex-start; }
.bubble { max-width: 75%; padding: 0.55rem 0.8rem; border-radius: 12px; }
.bubble-me { background: var(--primary); color: white; border-bottom-right-radius: 3px; }
.bubble-admin-me { background: #7c3aed; color: white; border-bottom-right-radius: 3px; }
.bubble-other { background: var(--gray-100); color: var(--gray-900); border-bottom-left-radius: 3px; }
.bubble-sender { font-size: 0.68rem; font-weight: 600; margin-bottom: 0.2rem; opacity: 0.75; }
.bubble-text { font-size: 0.85rem; line-height: 1.5; white-space: pre-wrap; }
.bubble-time { font-size: 0.65rem; margin-top: 0.25rem; opacity: 0.6; text-align: right; }

/* Avatar photo */
.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* User menu */
.user-menu {
  position: relative; display: flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.6rem; border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.15s; user-select: none;
}
.user-menu:hover { background: var(--gray-100); }
.user-name-text { font-size: 0.85rem; font-weight: 500; color: var(--gray-700); }
.chevron { color: var(--gray-400); transition: transform 0.2s; }
.chevron.rotated { transform: rotate(180deg); }
.user-avatar {
  width: 30px; height: 30px; background: var(--primary); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; color: white;
  text-transform: uppercase; flex-shrink: 0; overflow: hidden;
}
.user-avatar.avatar-lg { width: 40px; height: 40px; font-size: 0.85rem; }
.avatar-admin { background: #b45309; }
.user-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  background: white; border: 1px solid var(--gray-200);
  border-radius: var(--radius); box-shadow: var(--shadow-lg);
  min-width: 220px; z-index: 200; overflow: hidden;
}
.user-dropdown-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem; background: var(--gray-50);
}
.dropdown-name { font-size: 0.875rem; font-weight: 600; color: var(--gray-900); }
.dropdown-email { font-size: 0.75rem; color: var(--gray-500); }
.dropdown-divider { height: 1px; background: var(--gray-200); }
.dropdown-item {
  display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem;
  font-size: 0.85rem; font-weight: 500; color: var(--gray-700);
  background: none; border: none; width: 100%; text-align: left;
  cursor: pointer; transition: background 0.1s; font-family: inherit;
}
.dropdown-item:hover { background: var(--gray-50); }
.dropdown-item-danger { color: var(--danger); }
.dropdown-item-danger:hover { background: var(--danger-light); }
.btn-login {
  padding: 0.45rem 1rem; background: var(--primary); color: white;
  border-radius: var(--radius-sm); font-size: 0.875rem; font-weight: 500; transition: background 0.15s;
}
.btn-login:hover { background: var(--primary-dark); }
.mobile-toggle {
  display: none; background: none; border: none; color: var(--gray-600);
  cursor: pointer; padding: 0.25rem; border-radius: var(--radius-sm);
}
.mobile-menu {
  display: none; flex-direction: column; border-top: 1px solid var(--gray-200);
  padding: 0.5rem 1rem 1rem; gap: 0.25rem;
}
.mobile-menu.open { display: flex; }
.mobile-link {
  display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.75rem;
  border-radius: var(--radius-sm); font-size: 0.9rem; font-weight: 500;
  color: var(--gray-700); background: none; border: none;
  width: 100%; text-align: left; cursor: pointer; font-family: inherit; transition: background 0.1s;
}
.mobile-link:hover { background: var(--gray-100); }
.mobile-link-danger { color: var(--danger); }
.mobile-link-danger:hover { background: var(--danger-light); }

@media (max-width: 768px) {
  .mobile-toggle { display: flex; }
  .navbar-center { display: none; }
  .nav-admin-btn, .user-menu, .btn-login, .chat-btn { display: none; }
  .chat-panel {
    position: fixed;
    top: auto;
    bottom: 0; left: 0; right: 0;
    width: 100%;
    height: 75vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: none;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .chat-compose { padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px)); }
}

/* ─── MAIN ─── */
.main-content {
  max-width: 1280px; margin: 0 auto; padding: 2rem 1.5rem;
  padding-left: max(1.5rem, env(safe-area-inset-left));
  padding-right: max(1.5rem, env(safe-area-inset-right));
}
@media (max-width: 640px) {
  .main-content {
    padding: 1rem;
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
  }
}

/* ─── GLOBAL UTILITIES ─── */
.btn {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.5rem 1rem; border-radius: var(--radius-sm);
  font-size: 0.875rem; font-weight: 500; cursor: pointer; border: none;
  transition: all 0.15s; font-family: inherit; white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-danger { background: var(--danger); color: white; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.btn-success { background: var(--success); color: white; }
.btn-success:hover:not(:disabled) { background: #15803d; }
.btn-outline { background: white; color: var(--gray-700); border: 1px solid var(--gray-200); }
.btn-outline:hover:not(:disabled) { background: var(--gray-50); border-color: var(--gray-300); }
.btn-warning-outline { background: white; color: #92400e; border: 1px solid #fde68a; }
.btn-warning-outline:hover:not(:disabled) { background: #fffbeb; border-color: #fbbf24; }
.btn-ghost { background: transparent; color: var(--gray-600); }
.btn-ghost:hover:not(:disabled) { background: var(--gray-100); }
.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; }
.btn-lg { padding: 0.65rem 1.25rem; font-size: 0.95rem; }

.badge {
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem;
  border-radius: 999px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em;
}
.badge-clean { background: #dcfce7; color: #166534; }
.badge-dirty { background: #fee2e2; color: #991b1b; }
.badge-needs_attention { background: #fef9c3; color: #92400e; }
.badge-pending { background: #fef9c3; color: #92400e; }
.badge-resolved { background: #dcfce7; color: #166534; }
.badge-ignored { background: var(--gray-100); color: var(--gray-500); }

.card {
  background: white; border: 1px solid var(--gray-200);
  border-radius: var(--radius); box-shadow: var(--shadow);
}

.form-group { margin-bottom: 1.1rem; }
.form-label {
  display: block; font-size: 0.8rem; font-weight: 600;
  margin-bottom: 0.4rem; color: var(--gray-700); letter-spacing: 0.01em;
}
.form-control {
  width: 100%; padding: 0.55rem 0.875rem;
  border: 1px solid var(--gray-300); border-radius: var(--radius-sm);
  font-size: 0.875rem; font-family: inherit; color: var(--gray-900);
  background: white; transition: all 0.15s; outline: none;
}
.form-control:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.form-control::placeholder { color: var(--gray-400); }
textarea.form-control { resize: vertical; min-height: 90px; }

.alert { padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.875rem; margin-bottom: 1rem; display: flex; align-items: flex-start; gap: 0.5rem; }
.alert-error { background: var(--danger-light); color: #991b1b; border: 1px solid #fecaca; }
.alert-success { background: var(--success-light); color: #166534; border: 1px solid #bbf7d0; }

.spinner {
  display: inline-block; width: 1rem; height: 1rem;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: currentColor;
  border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
.spinner-dark { border-color: var(--gray-200); border-top-color: var(--primary); }
@keyframes spin { to { transform: rotate(360deg); } }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(15,23,42,0.5);
  backdrop-filter: blur(2px); display: flex; align-items: center;
  justify-content: center; z-index: 300; padding: 1rem; animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.modal {
  background: white; border-radius: var(--radius-lg); width: 100%; max-width: 520px;
  max-height: 92vh; overflow-y: auto; box-shadow: var(--shadow-lg); animation: slideUp 0.2s ease;
}
@keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
.modal-wide { max-width: 640px; }
.modal-header {
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200);
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
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
  padding: 1rem 1.5rem; border-top: 1px solid var(--gray-200);
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
  gap: 0.75rem; padding: 3rem; color: var(--gray-500); font-size: 0.875rem;
}

/* ─── DARK MODE ─── */
[data-theme="dark"] {
  color-scheme: dark;
  --primary: #60a5fa;
  --primary-dark: #93c5fd;
  --primary-light: rgba(96,165,250,0.12);
  --success: #4ade80;
  --success-light: rgba(74,222,128,0.1);
  --warning: #fbbf24;
  --warning-light: rgba(251,191,36,0.1);
  --danger: #f87171;
  --danger-light: rgba(248,113,113,0.1);
  --gray-50: #181818;
  --gray-100: #202020;
  --gray-200: #2a2a2a;
  --gray-300: #3a3a3a;
  --gray-400: #6b7280;
  --gray-500: #9ca3af;
  --gray-600: #d1d5db;
  --gray-700: #e5e7eb;
  --gray-800: #f0f0f0;
  --gray-900: #f9f9f9;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.6);
  --shadow: 0 1px 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.6);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.7);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.8);
}

/* ── Page background ── */
[data-theme="dark"] body { background: #111111 !important; color: #f0f0f0; }

/* ── Cards (global .card + all local white bg classes) ── */
[data-theme="dark"] .card,
[data-theme="dark"] .stat-card,
[data-theme="dark"] .building-card,
[data-theme="dark"] .lab-card { background: #1c1c1e !important; border-color: #2a2a2a !important; }

/* ── Navbar ── */
[data-theme="dark"] .navbar { background: #161616 !important; border-color: #2a2a2a !important; box-shadow: 0 1px 0 #2a2a2a !important; }
[data-theme="dark"] .navbar-brand { color: #f0f0f0 !important; }
[data-theme="dark"] .nav-item { color: #d1d5db !important; }
[data-theme="dark"] .nav-item:hover,
[data-theme="dark"] .nav-item.router-link-active { background: rgba(96,165,250,0.1) !important; color: #60a5fa !important; }
[data-theme="dark"] .nav-admin-btn { background: #202020 !important; border-color: #2a2a2a !important; color: #d1d5db !important; }
[data-theme="dark"] .nav-admin-btn:hover { background: #2a2a2a !important; }
[data-theme="dark"] .nav-admin-btn.router-link-active { background: rgba(96,165,250,0.1) !important; color: #60a5fa !important; border-color: rgba(96,165,250,0.3) !important; }
[data-theme="dark"] .user-name-text { color: #d1d5db !important; }
[data-theme="dark"] .user-menu:hover { background: #202020 !important; }

/* ── Mobile menu ── */
[data-theme="dark"] .mobile-menu { background: #161616 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .mobile-link { color: #d1d5db !important; }
[data-theme="dark"] .mobile-link:hover { background: #202020 !important; }
[data-theme="dark"] .mobile-link-danger { color: #f87171 !important; }
[data-theme="dark"] .mobile-link-danger:hover { background: rgba(248,113,113,0.1) !important; }

/* ── User dropdown ── */
[data-theme="dark"] .user-dropdown { background: #1c1c1e !important; border-color: #2a2a2a !important; box-shadow: 0 8px 24px rgba(0,0,0,0.6) !important; }
[data-theme="dark"] .user-dropdown-header { background: #111111 !important; }
[data-theme="dark"] .dropdown-name { color: #f0f0f0 !important; }
[data-theme="dark"] .dropdown-email { color: #9ca3af !important; }
[data-theme="dark"] .dropdown-divider { background: #2a2a2a !important; }
[data-theme="dark"] .dropdown-item { color: #d1d5db !important; }
[data-theme="dark"] .dropdown-item:hover { background: #202020 !important; }
[data-theme="dark"] .dropdown-item-danger { color: #f87171 !important; }
[data-theme="dark"] .dropdown-item-danger:hover { background: rgba(248,113,113,0.1) !important; }

/* ── Forms ── */
[data-theme="dark"] .form-control { background: #111111 !important; color: #f0f0f0 !important; border-color: #3a3a3a !important; }
[data-theme="dark"] .form-control::placeholder { color: #6b7280 !important; }
[data-theme="dark"] .form-control:focus { border-color: #60a5fa !important; box-shadow: 0 0 0 3px rgba(96,165,250,0.15) !important; }
[data-theme="dark"] select option { background: #1c1c1e; color: #f0f0f0; }

/* ── Buttons ── */
[data-theme="dark"] .btn-outline { background: #1c1c1e !important; border-color: #3a3a3a !important; color: #e5e7eb !important; }
[data-theme="dark"] .btn-outline:hover:not(:disabled) { background: #2a2a2a !important; border-color: #4a4a4a !important; }
[data-theme="dark"] .btn-ghost { color: #d1d5db !important; }
[data-theme="dark"] .btn-ghost:hover:not(:disabled) { background: #202020 !important; }
[data-theme="dark"] .btn-warning-outline { background: #1c1c1e !important; color: #fbbf24 !important; border-color: rgba(251,191,36,0.3) !important; }
[data-theme="dark"] .btn-warning-outline:hover:not(:disabled) { background: rgba(251,191,36,0.08) !important; }

/* ── Modals ── */
[data-theme="dark"] .modal-overlay { background: rgba(0,0,0,0.85) !important; }
[data-theme="dark"] .modal { background: #1c1c1e !important; border: 1px solid #2a2a2a; box-shadow: 0 24px 48px rgba(0,0,0,0.8) !important; }
[data-theme="dark"] .modal-header { background: #111111 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .modal-footer { background: #111111 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .modal-header h3 { color: #f0f0f0 !important; }
[data-theme="dark"] .modal-close { background: #202020 !important; color: #9ca3af !important; }
[data-theme="dark"] .modal-close:hover { background: #2a2a2a !important; color: #f0f0f0 !important; }

/* ── Chat panel ── */
[data-theme="dark"] .chat-panel { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .chat-panel-header { background: #111111 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .chat-panel-title { color: #f0f0f0 !important; }
[data-theme="dark"] .chat-compose { background: #111111 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .chat-user-row { border-color: #2a2a2a !important; }
[data-theme="dark"] .chat-user-row:hover { background: #202020 !important; }
[data-theme="dark"] .chat-user-row-unread { background: rgba(96,165,250,0.05) !important; }
[data-theme="dark"] .chat-user-name { color: #f0f0f0 !important; }
[data-theme="dark"] .chat-user-preview { color: #6b7280 !important; }
[data-theme="dark"] .chat-back-btn { color: #9ca3af !important; }
[data-theme="dark"] .chat-back-btn:hover { color: #f0f0f0 !important; background: #202020 !important; }
[data-theme="dark"] .bubble-other { background: #2a2a2a !important; color: #f0f0f0 !important; }
[data-theme="dark"] .chat-empty { color: #6b7280 !important; }

/* ── HomeView ── */
[data-theme="dark"] .building-card:hover { border-color: #60a5fa !important; transform: translateY(-1px); }
[data-theme="dark"] .building-card.active { background: rgba(96,165,250,0.1) !important; border-color: #60a5fa !important; }
[data-theme="dark"] .building-count { color: #f0f0f0 !important; }
[data-theme="dark"] .building-name { color: #f0f0f0 !important; }
[data-theme="dark"] .building-icon { color: #6b7280 !important; }
[data-theme="dark"] .building-card.active .building-icon { color: #60a5fa !important; }
[data-theme="dark"] .lab-card:hover { border-color: #3a3a3a !important; box-shadow: 0 8px 16px rgba(0,0,0,0.5) !important; }
[data-theme="dark"] .lab-card-footer { border-color: #2a2a2a !important; color: #60a5fa !important; }
[data-theme="dark"] .lab-name { color: #f0f0f0 !important; }
[data-theme="dark"] .lab-building-badge { background: rgba(96,165,250,0.12) !important; color: #60a5fa !important; }
[data-theme="dark"] .dot-clean { box-shadow: 0 0 0 3px rgba(74,222,128,0.2) !important; }
[data-theme="dark"] .dot-dirty { box-shadow: 0 0 0 3px rgba(248,113,113,0.2) !important; }
[data-theme="dark"] .dot-needs_attention { box-shadow: 0 0 0 3px rgba(251,191,36,0.2) !important; }
[data-theme="dark"] .section-label { color: #9ca3af !important; }
[data-theme="dark"] .search-icon { color: #6b7280 !important; }
[data-theme="dark"] .filter-icon { color: #6b7280 !important; }

/* ── Profile view ── */
[data-theme="dark"] .profile-hero { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .profile-name { color: #f0f0f0 !important; }
[data-theme="dark"] .panel { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .panel-head { background: #111111 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .panel-title { color: #f0f0f0 !important; }
[data-theme="dark"] .panel-sub { color: #9ca3af !important; }
[data-theme="dark"] .clean-bg,
[data-theme="dark"] .sev-none-bg { background: rgba(74,222,128,0.08) !important; }
[data-theme="dark"] .sev-low-bg { background: rgba(251,191,36,0.08) !important; }
[data-theme="dark"] .sev-mid-bg { background: rgba(251,146,60,0.08) !important; }
[data-theme="dark"] .sev-high-bg { background: rgba(248,113,113,0.08) !important; }
[data-theme="dark"] .comments-bg { background: rgba(96,165,250,0.08) !important; }
[data-theme="dark"] .warn-item { background: rgba(120,53,15,0.25) !important; border-color: #92400e !important; }
[data-theme="dark"] .warn-reason { color: #e5e7eb !important; }
[data-theme="dark"] .warn-alert { background: rgba(251,191,36,0.08) !important; border-color: rgba(251,191,36,0.25) !important; color: #fbbf24 !important; }
[data-theme="dark"] .comment-item { background: #222222 !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .comment-text { color: #e5e7eb !important; }
[data-theme="dark"] .ps-divider { background: #2a2a2a !important; }

/* ── Auth pages ── */
[data-theme="dark"] .auth-page { background: linear-gradient(135deg, #111111 0%, #0d0d0d 100%) !important; }
[data-theme="dark"] .auth-card { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .auth-header h1 { color: #f0f0f0 !important; }
[data-theme="dark"] .auth-header p { color: #9ca3af !important; }
[data-theme="dark"] .auth-footer { color: #9ca3af !important; }

/* ── Admin / report / other cards ── */
[data-theme="dark"] .report-card,
[data-theme="dark"] .comment-card,
[data-theme="dark"] .empty-panel,
[data-theme="dark"] .cl-item { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .cl-item-inactive { opacity: 0.45 !important; }
[data-theme="dark"] .type-option { background: #1c1c1e !important; border-color: #3a3a3a !important; color: #d1d5db !important; }
[data-theme="dark"] .type-option.active { background: rgba(96,165,250,0.1) !important; border-color: #60a5fa !important; color: #93c5fd !important; }
[data-theme="dark"] .file-upload-area { background: #111111 !important; border-color: #3a3a3a !important; color: #9ca3af !important; }

/* ── Page titles ── */
[data-theme="dark"] .page-title { color: #f0f0f0 !important; }
[data-theme="dark"] .page-subtitle { color: #9ca3af !important; }

/* ── Alerts ── */
[data-theme="dark"] .alert-error { background: rgba(248,113,113,0.1) !important; border-color: rgba(248,113,113,0.25) !important; color: #fca5a5 !important; }
[data-theme="dark"] .alert-success { background: rgba(74,222,128,0.1) !important; border-color: rgba(74,222,128,0.25) !important; color: #86efac !important; }

/* ── AdminView ── */
[data-theme="dark"] .stat-tile { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .ftab.active,
[data-theme="dark"] .atab.active { background: #1c1c1e !important; color: #f0f0f0 !important; }
[data-theme="dark"] .bubble-user { background: #2a2a2a !important; border-color: #3a3a3a !important; color: #f0f0f0 !important; }

/* ── LabView ── */
[data-theme="dark"] .user-dropdown-list { background: #1c1c1e !important; border-color: #2a2a2a !important; }
[data-theme="dark"] .lightbox-close { background: #1c1c1e !important; border-color: #2a2a2a !important; }

/* ── Misc ── */
[data-theme="dark"] a { color: inherit; }
[data-theme="dark"] .spinner-dark { border-color: #2a2a2a; border-top-color: #60a5fa; }
</style>
