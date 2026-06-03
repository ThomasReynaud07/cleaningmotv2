<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { adminApi, adminMessagesApi, auditApi, checklistApi, type AdminUser, type UserWarning, type AuditLog, type Message, type ChecklistItem } from '@/services/api'
import {
  Users, Shield, AlertTriangle, Search, ChevronDown,
  Crown, UserCheck, Trash2, X, Plus, Eye, ScrollText, ChevronLeft, ChevronRight, Mail, Send,
  ClipboardList, ClipboardCheck, GripVertical,
} from 'lucide-vue-next'

const activeTab = ref<'users' | 'audit' | 'checklist'>('users')

const users = ref<AdminUser[]>([])
const loading = ref(false)
const searchQuery = ref('')
const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const selectedUser = ref<AdminUser | null>(null)
const showUserModal = ref(false)
const showWarnModal = ref(false)
const warnReason = ref('')
const warnLoading = ref(false)
const warnError = ref('')
const roleLoading = ref<number | null>(null)
const userMessages = ref<Message[]>([])
const adminReply = ref('')
const replyLoading = ref(false)
const msgThreadRef = ref<HTMLElement | null>(null)
const filterRole = ref<'all' | 'user' | 'admin'>('all')

const filteredUsers = computed(() =>
  filterRole.value === 'all' ? users.value : users.value.filter(u => u.role === filterRole.value)
)
const totalWarns = computed(() => users.value.reduce((s, u) => s + u.warningCount, 0))

onMounted(() => { fetchUsers(); loadChecklist() })

async function fetchUsers(search?: string) {
  loading.value = true
  try { const { data } = await adminApi.getUsers(search); users.value = data } catch {}
  finally { loading.value = false }
}

function onSearch() {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(() => fetchUsers(searchQuery.value || undefined), 300)
}

async function openUser(user: AdminUser) {
  try {
    const [{ data }, { data: msgs }] = await Promise.all([adminApi.getUser(user.id), adminMessagesApi.getThread(user.id)])
    selectedUser.value = data
    userMessages.value = msgs
    showUserModal.value = true
    await nextTick()
    msgThreadRef.value?.scrollTo({ top: msgThreadRef.value.scrollHeight })
  } catch {}
}

async function sendReply() {
  if (!selectedUser.value || !adminReply.value.trim() || replyLoading.value) return
  replyLoading.value = true
  try {
    const { data } = await adminMessagesApi.reply(selectedUser.value.id, adminReply.value)
    userMessages.value.push(data)
    adminReply.value = ''
    await nextTick()
    msgThreadRef.value?.scrollTo({ top: msgThreadRef.value.scrollHeight, behavior: 'smooth' })
  } finally { replyLoading.value = false }
}

function openWarnModal() { warnReason.value = ''; warnError.value = ''; showWarnModal.value = true }

async function submitWarn() {
  if (!selectedUser.value || !warnReason.value.trim()) return
  warnLoading.value = true; warnError.value = ''
  try {
    const { data } = await adminApi.addWarning(selectedUser.value.id, warnReason.value)
    const su = selectedUser.value
    su.warnings.unshift(data as UserWarning)
    su.warningCount++
    const lu = users.value.find(u => u.id === su.id)
    if (lu) { lu.warningCount = su.warningCount; lu.warnings = su.warnings }
    showWarnModal.value = false; warnReason.value = ''
  } catch (e: any) { warnError.value = e.response?.data?.message || 'Erreur' }
  finally { warnLoading.value = false }
}

async function removeWarning(warning: UserWarning) {
  if (!selectedUser.value || !confirm('Supprimer cet avertissement ?')) return
  try {
    const su = selectedUser.value
    await adminApi.removeWarning(su.id, warning.id)
    su.warnings = su.warnings.filter(w => w.id !== warning.id)
    su.warningCount--
    const lu = users.value.find(u => u.id === su.id)
    if (lu) lu.warningCount = su.warningCount
  } catch {}
}

async function toggleRole(user: AdminUser) {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  if (!confirm(`${newRole === 'admin' ? 'Promouvoir' : 'Rétrograder'} ${user.firstName} ${user.lastName} ?`)) return
  roleLoading.value = user.id
  try {
    await adminApi.updateRole(user.id, newRole)
    user.role = newRole
    if (selectedUser.value?.id === user.id) selectedUser.value.role = newRole
  } catch {}
  finally { roleLoading.value = null }
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

function warnColor(count: number) {
  if (count === 0) return 'warn-none'
  if (count === 1) return 'warn-low'
  if (count === 2) return 'warn-mid'
  return 'warn-high'
}

// Audit log
const auditLogs = ref<AuditLog[]>([])
const auditLoading = ref(false)
const auditPage = ref(1)
const auditLastPage = ref(1)
const auditTotal = ref(0)

// Checklist
const checklistItems = ref<ChecklistItem[]>([])
const checklistLoading = ref(false)
const newItemLabel = ref('')
const addingItem = ref(false)

const actionLabels: Record<string, { label: string; color: string }> = {
  'report.created':       { label: 'Signalement créé',       color: 'audit-warning' },
  'report.status_updated':{ label: 'Statut rapport modifié', color: 'audit-info' },
  'report.deleted':       { label: 'Signalement supprimé',   color: 'audit-danger' },
  'warning.added':        { label: 'Avertissement envoyé',   color: 'audit-danger' },
  'warning.removed':      { label: 'Avertissement retiré',   color: 'audit-success' },
  'role.updated':         { label: 'Rôle modifié',           color: 'audit-info' },
  'lab.created':          { label: 'Labo créé',              color: 'audit-success' },
  'lab.deleted':          { label: 'Labo supprimé',          color: 'audit-danger' },
  'comment.deleted':      { label: 'Commentaire supprimé',   color: 'audit-danger' },
}

async function fetchAuditLogs(page = 1) {
  auditLoading.value = true
  try {
    const { data } = await auditApi.getLogs(page)
    auditLogs.value = data.data
    auditPage.value = data.meta.currentPage
    auditLastPage.value = data.meta.lastPage
    auditTotal.value = data.meta.total
  } catch {}
  finally { auditLoading.value = false }
}

function switchTab(tab: 'users' | 'audit' | 'checklist') {
  activeTab.value = tab
  if (tab === 'audit' && auditLogs.value.length === 0) fetchAuditLogs()
  if (tab === 'checklist' && checklistItems.value.length === 0) loadChecklist()
}

async function loadChecklist() {
  checklistLoading.value = true
  try { const { data } = await checklistApi.getItems(); checklistItems.value = data } catch {}
  finally { checklistLoading.value = false }
}

async function addChecklistItem() {
  if (!newItemLabel.value.trim() || addingItem.value) return
  addingItem.value = true
  try {
    const { data } = await checklistApi.addItem(newItemLabel.value)
    checklistItems.value.push(data)
    newItemLabel.value = ''
  } finally { addingItem.value = false }
}

async function toggleChecklistItem(item: ChecklistItem) {
  try {
    const { data } = await checklistApi.updateItem(item.id, { active: !item.active })
    const idx = checklistItems.value.findIndex(i => i.id === item.id)
    if (idx !== -1) checklistItems.value[idx] = data
  } catch {}
}

async function deleteChecklistItem(item: ChecklistItem) {
  if (!confirm(`Supprimer "${item.label}" ?`)) return
  try {
    await checklistApi.deleteItem(item.id)
    checklistItems.value = checklistItems.value.filter(i => i.id !== item.id)
  } catch {}
}

function auditPayloadSummary(log: AuditLog): string {
  const p = log.payload
  if (!p) return ''
  if (log.action === 'report.status_updated') return `${p.oldStatus} → ${p.newStatus}`
  if (log.action === 'role.updated') return `${p.oldRole} → ${p.newRole} (${p.targetName})`
  if (log.action === 'warning.added' || log.action === 'warning.removed') return p.targetName ?? p.reason ?? ''
  if (log.action === 'lab.created' || log.action === 'lab.deleted') return p.name ?? ''
  if (log.action === 'report.created') return p.labName ?? ''
  return ''
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Administration</h1>
      <p class="page-subtitle">Gestion des utilisateurs et des avertissements</p>
    </div>

    <!-- Tabs -->
    <div class="admin-tabs">
      <button class="atab" :class="{ active: activeTab === 'users' }" @click="switchTab('users')">
        <Users :size="15" /> Utilisateurs
      </button>
      <button class="atab" :class="{ active: activeTab === 'audit' }" @click="switchTab('audit')">
        <ScrollText :size="15" /> Journal d'audit
      </button>
      <button :class="['atab', { active: activeTab === 'checklist' }]" @click="switchTab('checklist')">
        <ClipboardList :size="15" /> Checklist
      </button>
    </div>

    <!-- Stats -->
    <div class="stats-row" v-if="activeTab === 'users'">
      <div class="stat-tile">
        <div class="stat-tile-icon icon-blue"><Users :size="18" /></div>
        <div class="stat-tile-num">{{ users.length }}</div>
        <div class="stat-tile-label">Utilisateurs</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon icon-amber"><Crown :size="18" /></div>
        <div class="stat-tile-num">{{ users.filter(u => u.role === 'admin').length }}</div>
        <div class="stat-tile-label">Administrateurs</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon icon-orange"><AlertTriangle :size="18" /></div>
        <div class="stat-tile-num">{{ totalWarns }}</div>
        <div class="stat-tile-label">Avertissements</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon icon-red"><Shield :size="18" /></div>
        <div class="stat-tile-num">{{ users.filter(u => u.warningCount >= 3).length }}</div>
        <div class="stat-tile-label">Utilisateurs à risque</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar" v-if="activeTab === 'users'">
      <div class="search-box">
        <Search :size="15" class="search-icon" />
        <input v-model="searchQuery" type="text" class="form-control search-input" placeholder="Rechercher par nom ou email..." @input="onSearch" />
      </div>
      <div class="filter-tabs">
        <button class="ftab" :class="{ active: filterRole === 'all' }" @click="filterRole = 'all'">Tous</button>
        <button class="ftab" :class="{ active: filterRole === 'user' }" @click="filterRole = 'user'">Utilisateurs</button>
        <button class="ftab" :class="{ active: filterRole === 'admin' }" @click="filterRole = 'admin'">Admins</button>
      </div>
    </div>

    <!-- Table -->
    <div class="card table-wrap" v-if="activeTab === 'users'">
      <div v-if="loading" class="loading-center"><span class="spinner spinner-dark"></span> Chargement...</div>

      <table v-else class="user-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th class="hide-sm">Email</th>
            <th>Rôle</th>
            <th>Avertissements</th>
            <th class="hide-sm">Inscrit le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id" class="user-row" @click="openUser(user)">
            <td>
              <div class="user-cell">
                <div class="u-avatar" :class="user.role === 'admin' ? 'u-avatar-admin' : ''">
                  {{ user.firstName[0] }}{{ user.lastName[0] }}
                </div>
                <span class="u-name">{{ user.firstName }} {{ user.lastName }}</span>
              </div>
            </td>
            <td class="hide-sm text-muted">{{ user.email }}</td>
            <td @click.stop>
              <button class="role-pill" :class="user.role === 'admin' ? 'role-admin' : 'role-user'" :disabled="roleLoading === user.id" @click="toggleRole(user)">
                <Crown v-if="user.role === 'admin'" :size="12" />
                <UserCheck v-else :size="12" />
                {{ user.role === 'admin' ? 'Admin' : 'User' }}
                <ChevronDown :size="11" />
              </button>
            </td>
            <td>
              <span class="warn-badge" :class="warnColor(user.warningCount)">
                <AlertTriangle :size="11" />
                {{ user.warningCount }}
              </span>
            </td>
            <td class="hide-sm text-muted text-sm">{{ formatDate(user.createdAt) }}</td>
            <td @click.stop>
              <button class="btn btn-outline btn-sm" @click="openUser(user)">
                <Eye :size="13" />
              </button>
            </td>
          </tr>
          <tr v-if="filteredUsers.length === 0">
            <td colspan="6" class="empty-row">
              <Users :size="24" style="color:var(--gray-300);display:block;margin:0 auto 0.5rem" />
              Aucun utilisateur trouvé
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Audit log section -->
    <template v-if="activeTab === 'audit'">
      <div class="audit-header">
        <span class="audit-total">{{ auditTotal }} entrées au total</span>
        <div class="audit-pagination">
          <button class="btn btn-outline btn-sm" :disabled="auditPage <= 1" @click="fetchAuditLogs(auditPage - 1)">
            <ChevronLeft :size="14" />
          </button>
          <span class="audit-page-info">{{ auditPage }} / {{ auditLastPage }}</span>
          <button class="btn btn-outline btn-sm" :disabled="auditPage >= auditLastPage" @click="fetchAuditLogs(auditPage + 1)">
            <ChevronRight :size="14" />
          </button>
        </div>
      </div>

      <div v-if="auditLoading" class="loading-center"><span class="spinner spinner-dark"></span> Chargement...</div>

      <div v-else-if="auditLogs.length === 0" class="card empty-audit">
        <ScrollText :size="32" style="color:var(--gray-300)" />
        <p>Aucune entrée dans le journal</p>
      </div>

      <div v-else class="card audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Par</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in auditLogs" :key="log.id">
              <td class="audit-date">{{ formatDate(log.createdAt) }}</td>
              <td>
                <span class="audit-badge" :class="actionLabels[log.action]?.color ?? 'audit-info'">
                  {{ actionLabels[log.action]?.label ?? log.action }}
                </span>
              </td>
              <td class="audit-actor">
                <template v-if="log.actor">{{ log.actor.firstName }} {{ log.actor.lastName }}</template>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="audit-detail text-muted">{{ auditPayloadSummary(log) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Checklist tab -->
    <template v-if="activeTab === 'checklist'">
      <div class="page-header">
        <h2 class="page-title">Checklist de nettoyage</h2>
        <p class="page-subtitle">Définissez les points à valider lors de chaque nettoyage</p>
      </div>

      <div class="card" style="padding:1.25rem">
        <div class="cl-add-row">
          <input v-model="newItemLabel" class="form-control" placeholder="Nouveau point de contrôle..." @keydown.enter="addChecklistItem" style="flex:1" />
          <button class="btn btn-primary" :disabled="!newItemLabel.trim() || addingItem" @click="addChecklistItem">
            <span v-if="addingItem" class="spinner"></span>
            <Plus v-else :size="14" /> Ajouter
          </button>
        </div>
      </div>

      <div class="card" style="margin-top:1rem;overflow:hidden">
        <div v-if="checklistLoading" class="loading-center"><span class="spinner spinner-dark"></span></div>
        <div v-else-if="!checklistItems.length" class="empty-state">
          <ClipboardList :size="36" />
          <p>Aucun élément — ajoutez des points ci-dessus.</p>
        </div>
        <div v-else class="cl-list">
          <div v-for="item in checklistItems" :key="item.id" class="cl-item" :class="{ 'cl-item-inactive': !item.active }">
            <GripVertical :size="16" style="color:var(--gray-300);flex-shrink:0" />
            <span class="cl-item-label">{{ item.label }}</span>
            <span v-if="!item.active" class="cl-inactive-tag">Désactivé</span>
            <button class="btn btn-sm" :class="item.active ? 'btn-outline' : 'btn-success'" @click="toggleChecklistItem(item)" style="flex-shrink:0">
              {{ item.active ? 'Désactiver' : 'Activer' }}
            </button>
            <button class="btn btn-sm btn-outline btn-del-cl" @click="deleteChecklistItem(item)" style="flex-shrink:0">
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- User detail modal -->
    <div v-if="showUserModal && selectedUser" class="modal-overlay" @click.self="showUserModal = false">
      <div class="modal modal-wide">
        <div class="modal-header">
          <div class="modal-user-head">
            <div class="u-avatar u-avatar-lg" :class="selectedUser.role === 'admin' ? 'u-avatar-admin' : ''">
              {{ selectedUser.firstName[0] }}{{ selectedUser.lastName[0] }}
            </div>
            <div>
              <h3>{{ selectedUser.firstName }} {{ selectedUser.lastName }}</h3>
              <p class="modal-email">{{ selectedUser.email }}</p>
            </div>
          </div>
          <button class="modal-close" @click="showUserModal = false"><X :size="14" /></button>
        </div>
        <div class="modal-body">
          <div class="info-cards">
            <div class="info-card">
              <div class="ic-label">Rôle</div>
              <div class="ic-val">
                <span class="role-badge-lg" :class="selectedUser.role === 'admin' ? 'rb-admin' : 'rb-user'">
                  <Crown v-if="selectedUser.role === 'admin'" :size="13" />
                  <UserCheck v-else :size="13" />
                  {{ selectedUser.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}
                </span>
              </div>
            </div>
            <div class="info-card" :class="warnColor(selectedUser.warningCount)">
              <div class="ic-label">Avertissements</div>
              <div class="ic-num">{{ selectedUser.warningCount }}</div>
            </div>
            <div class="info-card">
              <div class="ic-label">Membre depuis</div>
              <div class="ic-val-sm">{{ formatDate(selectedUser.createdAt) }}</div>
            </div>
          </div>

          <div class="modal-actions-row">
            <button class="btn btn-danger" @click="openWarnModal">
              <AlertTriangle :size="15" /> Avertir
            </button>
            <button class="btn btn-outline" :class="selectedUser.role === 'admin' ? 'btn-demote' : ''" @click="toggleRole(selectedUser)">
              <Crown v-if="selectedUser.role !== 'admin'" :size="15" />
              <UserCheck v-else :size="15" />
              {{ selectedUser.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin' }}
            </button>
          </div>

          <div class="warn-section">
            <div class="warn-section-title">
              Historique des avertissements
              <span class="count-chip">{{ selectedUser.warnings.length }}</span>
            </div>
            <div v-if="!selectedUser.warnings.length" class="empty-warns">
              <AlertTriangle :size="20" style="color:var(--gray-300)" />
              <p>Aucun avertissement</p>
            </div>
            <div v-else class="warn-list">
              <div v-for="w in selectedUser.warnings" :key="w.id" class="warn-item">
                <div class="warn-item-header">
                  <div class="warn-item-meta">
                    <AlertTriangle :size="14" style="color:var(--warning);flex-shrink:0" />
                    <span class="warn-admin-name">{{ w.admin.firstName }} {{ w.admin.lastName }}</span>
                    <span class="warn-item-date">{{ formatDate(w.createdAt) }}</span>
                  </div>
                  <button class="btn-icon-del" @click="removeWarning(w)" title="Supprimer">
                    <Trash2 :size="13" />
                  </button>
                </div>
                <p class="warn-reason">{{ w.reason }}</p>
              </div>
            </div>
          </div>

          <!-- Messages section -->
          <div class="msg-section">
            <div class="warn-section-title">
              <Mail :size="14" style="color:#7c3aed" /> Messages
              <span class="count-chip">{{ userMessages.length }}</span>
            </div>
            <div class="admin-msg-thread" ref="msgThreadRef">
              <div v-if="!userMessages.length" class="empty-warns">
                <Mail :size="20" style="color:var(--gray-300)" />
                <p>Aucun message</p>
              </div>
              <div v-for="m in userMessages" :key="m.id" class="bubble-row" :class="m.fromMe ? 'bubble-row-right' : 'bubble-row-left'">
                <div class="bubble" :class="m.fromMe ? 'bubble-admin-sent' : 'bubble-user'">
                  <div class="bubble-sender">{{ m.fromMe ? 'Vous' : m.sender.firstName + ' ' + m.sender.lastName }}</div>
                  <div class="bubble-text">{{ m.content }}</div>
                  <div class="bubble-time">{{ formatDate(m.createdAt) }}</div>
                </div>
              </div>
            </div>
            <div class="admin-msg-compose">
              <textarea v-model="adminReply" class="form-control msg-input-sm" rows="2" placeholder="Répondre à l'utilisateur..." @keydown.ctrl.enter="sendReply"></textarea>
              <button class="btn btn-primary btn-sm" @click="sendReply" :disabled="!adminReply.trim() || replyLoading">
                <span v-if="replyLoading" class="spinner"></span>
                <Send v-else :size="13" /> Envoyer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Warn modal -->
    <div v-if="showWarnModal" class="modal-overlay" @click.self="showWarnModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Avertissement — {{ selectedUser?.firstName }} {{ selectedUser?.lastName }}</h3>
          <button class="modal-close" @click="showWarnModal = false"><X :size="14" /></button>
        </div>
        <form @submit.prevent="submitWarn">
          <div class="modal-body">
            <div v-if="warnError" class="alert alert-error">{{ warnError }}</div>
            <div class="form-group">
              <label class="form-label">Raison de l'avertissement *</label>
              <textarea v-model="warnReason" class="form-control" rows="4" placeholder="Motif de l'avertissement..." required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showWarnModal = false">Annuler</button>
            <button type="submit" class="btn btn-danger" :disabled="warnLoading">
              <span v-if="warnLoading" class="spinner"></span>
              <AlertTriangle v-else :size="15" />
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 1.75rem; }
.stat-tile { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 1.1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow); }
.stat-tile-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-blue { background: var(--primary-light); color: var(--primary); }
.icon-amber { background: #fffbeb; color: #b45309; }
.icon-orange { background: #fff7ed; color: #c2410c; }
.icon-red { background: var(--danger-light); color: var(--danger); }
.stat-tile-num { font-size: 1.75rem; font-weight: 700; line-height: 1; }
.stat-tile-label { font-size: 0.75rem; color: var(--gray-500); margin-top: 0.2rem; }

.toolbar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.search-box { position: relative; flex: 1; min-width: 220px; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
.search-input { padding-left: 2.5rem; }
.filter-tabs { display: flex; background: var(--gray-100); border-radius: var(--radius-sm); padding: 3px; gap: 2px; }
.ftab { padding: 0.35rem 0.875rem; border: none; background: none; cursor: pointer; font-size: 0.8rem; font-weight: 500; color: var(--gray-500); border-radius: calc(var(--radius-sm) - 2px); transition: all 0.15s; font-family: inherit; }
.ftab.active { background: white; color: var(--gray-900); box-shadow: var(--shadow-sm); }
.ftab:hover:not(.active) { color: var(--gray-700); }

.table-wrap { overflow: hidden; }
.user-table { width: 100%; border-collapse: collapse; }
.user-table th { padding: 0.75rem 1rem; text-align: left; font-size: 0.72rem; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.06em; background: var(--gray-50); border-bottom: 1px solid var(--gray-200); }
.user-table td { padding: 0.875rem 1rem; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
.user-row { cursor: pointer; transition: background 0.1s; }
.user-row:hover { background: var(--gray-50); }
.user-row:last-child td { border-bottom: none; }

.user-cell { display: flex; align-items: center; gap: 0.75rem; }
.u-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
.u-avatar-lg { width: 44px; height: 44px; font-size: 0.85rem; }
.u-avatar-admin { background: #b45309; }
.u-name { font-size: 0.875rem; font-weight: 500; }
.text-muted { color: var(--gray-500); }
.text-sm { font-size: 0.8rem; }

.role-pill { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid; transition: all 0.15s; font-family: inherit; }
.role-pill:disabled { opacity: 0.5; cursor: not-allowed; }
.role-admin { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.role-admin:hover:not(:disabled) { background: #fde68a; }
.role-user { background: var(--gray-100); color: var(--gray-600); border-color: var(--gray-200); }
.role-user:hover:not(:disabled) { background: var(--gray-200); }

.warn-badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.775rem; font-weight: 600; }
.warn-none { background: #dcfce7; color: #166534; }
.warn-low { background: #fef9c3; color: #92400e; }
.warn-mid { background: #ffedd5; color: #c2410c; }
.warn-high { background: #fee2e2; color: #991b1b; }

.empty-row { text-align: center; padding: 2.5rem !important; color: var(--gray-400); font-size: 0.875rem; }

/* User modal */
.modal-user-head { display: flex; align-items: center; gap: 0.875rem; }
.modal-user-head h3 { font-size: 1rem; font-weight: 600; }
.modal-email { font-size: 0.8rem; color: var(--gray-400); margin-top: 0.15rem; }

.info-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
.info-card { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 0.875rem; }
.ic-label { font-size: 0.72rem; color: var(--gray-400); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem; }
.ic-val { font-size: 0.875rem; font-weight: 600; }
.ic-val-sm { font-size: 0.8rem; font-weight: 600; color: var(--gray-700); }
.ic-num { font-size: 1.75rem; font-weight: 700; }
.info-card.warn-low { border-color: #fde68a; background: #fef9c3; }
.info-card.warn-mid { border-color: #fdba74; background: #ffedd5; }
.info-card.warn-high { border-color: #fca5a5; background: #fee2e2; }
.role-badge-lg { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
.rb-admin { background: #fffbeb; color: #b45309; }
.rb-user { background: var(--gray-100); color: var(--gray-600); }

.modal-actions-row { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.btn-demote { color: var(--danger) !important; border-color: #fecaca !important; }

.warn-section { border-top: 1px solid var(--gray-200); padding-top: 1.25rem; }
.warn-section-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
.count-chip { background: var(--gray-100); color: var(--gray-600); padding: 0.1rem 0.45rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
.empty-warns { text-align: center; padding: 1.5rem; color: var(--gray-400); font-size: 0.875rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }

.warn-list { display: flex; flex-direction: column; gap: 0.75rem; }
.warn-item { background: #fff7ed; border: 1px solid #fed7aa; border-radius: var(--radius-sm); padding: 0.875rem; }
.warn-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.warn-item-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.warn-admin-name { font-size: 0.8rem; font-weight: 600; color: #c2410c; }
.warn-item-date { font-size: 0.72rem; color: var(--gray-400); }
.warn-reason { font-size: 0.875rem; color: var(--gray-700); line-height: 1.5; }
.btn-icon-del { background: none; border: none; cursor: pointer; color: var(--gray-300); display: flex; padding: 0.2rem; border-radius: 4px; transition: all 0.15s; }
.btn-icon-del:hover { color: var(--danger); }

/* Admin tabs */
.admin-tabs { display: flex; gap: 0.25rem; background: var(--gray-100); border-radius: var(--radius-sm); padding: 3px; margin-bottom: 1.75rem; width: fit-content; }
.atab { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1rem; border: none; background: none; cursor: pointer; font-size: 0.85rem; font-weight: 500; color: var(--gray-500); border-radius: calc(var(--radius-sm) - 2px); transition: all 0.15s; font-family: inherit; }
.atab.active { background: white; color: var(--gray-900); box-shadow: var(--shadow-sm); }
.atab:hover:not(.active) { color: var(--gray-700); }

/* Audit */
.audit-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; }
.audit-total { font-size: 0.825rem; color: var(--gray-500); }
.audit-pagination { display: flex; align-items: center; gap: 0.5rem; }
.audit-page-info { font-size: 0.825rem; color: var(--gray-600); min-width: 4rem; text-align: center; }
.audit-table-wrap { overflow: hidden; }
.audit-table { width: 100%; border-collapse: collapse; }
.audit-table th { padding: 0.65rem 1rem; text-align: left; font-size: 0.72rem; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.06em; background: var(--gray-50); border-bottom: 1px solid var(--gray-200); }
.audit-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--gray-100); vertical-align: middle; font-size: 0.85rem; }
.audit-table tr:last-child td { border-bottom: none; }
.audit-date { font-size: 0.78rem; color: var(--gray-500); white-space: nowrap; }
.audit-actor { font-size: 0.85rem; font-weight: 500; white-space: nowrap; }
.audit-detail { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }

.audit-badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
.audit-success { background: #dcfce7; color: #166534; }
.audit-danger  { background: #fee2e2; color: #991b1b; }
.audit-warning { background: #fef9c3; color: #92400e; }
.audit-info    { background: #eff6ff; color: #1d4ed8; }

.empty-audit { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem; text-align: center; color: var(--gray-400); font-size: 0.875rem; }

/* Messages in admin modal */
.msg-section { border-top: 1px solid var(--gray-200); padding-top: 1.25rem; margin-top: 1.25rem; }
.admin-msg-thread { display: flex; flex-direction: column; gap: 0.6rem; max-height: 280px; overflow-y: auto; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-sm); margin-bottom: 0.75rem; }
.bubble-row { display: flex; }
.bubble-row-right { justify-content: flex-end; }
.bubble-row-left { justify-content: flex-start; }
.bubble { max-width: 75%; padding: 0.5rem 0.75rem; border-radius: 10px; }
.bubble-admin-sent { background: #7c3aed; color: white; border-bottom-right-radius: 3px; }
.bubble-user { background: white; border: 1px solid var(--gray-200); color: var(--gray-900); border-bottom-left-radius: 3px; }
.bubble-sender { font-size: 0.68rem; font-weight: 600; margin-bottom: 0.2rem; opacity: 0.75; }
.bubble-text { font-size: 0.825rem; line-height: 1.5; white-space: pre-wrap; }
.bubble-time { font-size: 0.65rem; margin-top: 0.25rem; opacity: 0.6; text-align: right; }
.admin-msg-compose { display: flex; gap: 0.6rem; align-items: flex-end; }
.msg-input-sm { flex: 1; resize: none; font-size: 0.85rem; }

.cl-add-row { display: flex; gap: 0.75rem; align-items: center; }
.cl-list { display: flex; flex-direction: column; }
.cl-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--gray-100);
  transition: background 0.1s;
}
.cl-item:last-child { border-bottom: none; }
.cl-item:hover { background: var(--gray-50); }
.cl-item-inactive { opacity: 0.55; }
.cl-item-label { flex: 1; font-size: 0.875rem; color: var(--gray-700); }
.cl-inactive-tag { font-size: 0.7rem; font-weight: 600; background: var(--gray-100); color: var(--gray-400); padding: 0.1rem 0.4rem; border-radius: 4px; }
.btn-del-cl { color: var(--danger) !important; border-color: #fecaca !important; }
.btn-del-cl:hover { background: var(--danger-light) !important; }

.hide-sm { }
@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2,1fr); }
  .hide-sm { display: none; }
  .toolbar { flex-direction: column; align-items: stretch; }
  .info-cards { grid-template-columns: 1fr; }
}
</style>
