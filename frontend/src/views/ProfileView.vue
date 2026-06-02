<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { profileApi, type MyWarning, type MyComment } from '@/services/api'
import { AlertTriangle, MessageSquare, CheckCircle2, ExternalLink } from 'lucide-vue-next'

const auth = useAuthStore()
const warnings = ref<MyWarning[]>([])
const comments = ref<MyComment[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [wRes, cRes] = await Promise.all([profileApi.myWarnings(), profileApi.myComments()])
    warnings.value = wRes.data
    comments.value = cRes.data
  } finally { loading.value = false }
})

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

function warnSeverity(count: number) {
  if (count === 0) return { cls: 'sev-none', label: 'Aucun avertissement' }
  if (count === 1) return { cls: 'sev-low', label: '1 avertissement' }
  if (count === 2) return { cls: 'sev-mid', label: '2 avertissements' }
  return { cls: 'sev-high', label: `${count} avertissements` }
}
</script>

<template>
  <div>
    <!-- Profile hero -->
    <div class="profile-hero card">
      <div class="profile-avatar" :class="auth.isAdmin ? 'avatar-admin' : ''">
        {{ auth.user?.firstName[0] }}{{ auth.user?.lastName[0] }}
      </div>
      <div class="profile-info">
        <h1 class="profile-name">{{ auth.user?.firstName }} {{ auth.user?.lastName }}</h1>
        <p class="profile-email">{{ auth.user?.email }}</p>
        <span class="role-chip" :class="auth.isAdmin ? 'chip-admin' : 'chip-user'">
          {{ auth.isAdmin ? 'Administrateur' : 'Utilisateur' }}
        </span>
      </div>
      <div class="profile-stats">
        <div class="ps-item">
          <div class="ps-num" :class="warnings.length > 0 ? 'ps-num-warn' : ''">{{ warnings.length }}</div>
          <div class="ps-label">Avertissements</div>
        </div>
        <div class="ps-divider"></div>
        <div class="ps-item">
          <div class="ps-num">{{ comments.length }}</div>
          <div class="ps-label">Commentaires</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-center">
      <span class="spinner spinner-dark"></span> Chargement...
    </div>

    <div v-else class="profile-grid">
      <!-- Warnings -->
      <div class="panel card">
        <div class="panel-head" :class="warnings.length > 0 ? warnSeverity(warnings.length).cls + '-bg' : 'clean-bg'">
          <div class="panel-head-left">
            <AlertTriangle :size="18" :class="warnings.length > 0 ? 'icon-warn' : 'icon-ok'" />
            <div>
              <div class="panel-title">Avertissements</div>
              <div class="panel-sub">{{ warnSeverity(warnings.length).label }}</div>
            </div>
          </div>
          <span class="panel-count" :class="warnings.length > 0 ? warnSeverity(warnings.length).cls : 'sev-none'">
            {{ warnings.length }}
          </span>
        </div>
        <div class="panel-body">
          <div v-if="!warnings.length" class="panel-empty">
            <CheckCircle2 :size="32" style="color:var(--success);opacity:0.7" />
            <p>Aucun avertissement — continuez comme ça !</p>
          </div>
          <div v-else>
            <div class="warn-alert">
              <AlertTriangle :size="15" style="flex-shrink:0" />
              Vous avez <strong>{{ warnings.length }}</strong> avertissement{{ warnings.length > 1 ? 's' : '' }}. Contactez un administrateur si vous pensez qu'il y a une erreur.
            </div>
            <div class="panel-list">
              <div v-for="w in warnings" :key="w.id" class="warn-item">
                <div class="warn-header">
                  <AlertTriangle :size="14" style="color:var(--warning);flex-shrink:0;margin-top:1px" />
                  <div>
                    <span class="warn-by">Par {{ w.admin.firstName }} {{ w.admin.lastName }}</span>
                    <span class="warn-date">{{ formatDate(w.createdAt) }}</span>
                  </div>
                </div>
                <p class="warn-reason">{{ w.reason }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Comments -->
      <div class="panel card">
        <div class="panel-head comments-bg">
          <div class="panel-head-left">
            <MessageSquare :size="18" style="color:var(--primary)" />
            <div>
              <div class="panel-title">Mes commentaires</div>
              <div class="panel-sub">Laissés sur les laboratoires</div>
            </div>
          </div>
          <span class="panel-count sev-comments">{{ comments.length }}</span>
        </div>
        <div class="panel-body">
          <div v-if="!comments.length" class="panel-empty">
            <MessageSquare :size="32" style="color:var(--gray-300)" />
            <p>Vous n'avez encore laissé aucun commentaire</p>
          </div>
          <div v-else class="panel-list">
            <div v-for="c in comments" :key="c.id" class="comment-item">
              <div class="comment-meta">
                <RouterLink v-if="c.lab" :to="`/labs/${c.lab.id}`" class="lab-link">
                  <ExternalLink :size="12" /> {{ c.lab.name }}
                </RouterLink>
                <span v-else class="lab-deleted">Salle supprimée</span>
                <span class="comment-date">{{ formatDate(c.createdAt) }}</span>
              </div>
              <p class="comment-text">{{ c.content }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-hero {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 1.75rem; margin-bottom: 1.75rem; flex-wrap: wrap;
}
.profile-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--primary); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0;
}
.avatar-admin { background: #b45309; }
.profile-info { flex: 1; }
.profile-name { font-size: 1.375rem; font-weight: 700; margin-bottom: 0.2rem; }
.profile-email { color: var(--gray-500); font-size: 0.875rem; margin-bottom: 0.5rem; }
.role-chip { display: inline-flex; align-items: center; padding: 0.2rem 0.65rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.chip-admin { background: #fffbeb; color: #b45309; }
.chip-user { background: var(--gray-100); color: var(--gray-600); }
.profile-stats { display: flex; align-items: center; gap: 1.25rem; }
.ps-item { text-align: center; }
.ps-num { font-size: 1.5rem; font-weight: 700; line-height: 1; }
.ps-num-warn { color: var(--danger); }
.ps-label { font-size: 0.72rem; color: var(--gray-500); margin-top: 0.2rem; }
.ps-divider { width: 1px; height: 36px; background: var(--gray-200); }

.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.panel { overflow: hidden; }

.panel-head { padding: 1rem 1.25rem; border-bottom: 1px solid var(--gray-200); display: flex; align-items: center; justify-content: space-between; }
.panel-head-left { display: flex; align-items: center; gap: 0.75rem; }
.panel-title { font-size: 0.9rem; font-weight: 600; }
.panel-sub { font-size: 0.75rem; color: var(--gray-500); margin-top: 0.1rem; }
.panel-count { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; }

.clean-bg { background: var(--success-light); }
.sev-none-bg { background: var(--success-light); }
.sev-low-bg { background: #fffbeb; }
.sev-mid-bg { background: #fff7ed; }
.sev-high-bg { background: var(--danger-light); }
.comments-bg { background: var(--primary-light); }

.sev-none { background: #dcfce7; color: #166534; }
.sev-low { background: #fef9c3; color: #92400e; }
.sev-mid { background: #ffedd5; color: #c2410c; }
.sev-high { background: #fee2e2; color: #991b1b; }
.sev-comments { background: #dbeafe; color: #1d4ed8; }

.icon-ok { color: var(--success); }
.icon-warn { color: var(--warning); }

.panel-body { padding: 1.25rem; }
.panel-empty { text-align: center; padding: 2rem; color: var(--gray-400); font-size: 0.875rem; }
.panel-empty svg { display: block; margin: 0 auto 0.75rem; }

.warn-alert { display: flex; align-items: flex-start; gap: 0.6rem; background: var(--warning-light); border: 1px solid #fde68a; padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: #92400e; margin-bottom: 1rem; }

.panel-list { display: flex; flex-direction: column; gap: 0.75rem; }
.warn-item { background: #fff7ed; border: 1px solid #fed7aa; border-radius: var(--radius-sm); padding: 0.875rem; }
.warn-header { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
.warn-by { font-size: 0.8rem; font-weight: 600; color: #c2410c; display: block; }
.warn-date { font-size: 0.72rem; color: var(--gray-400); }
.warn-reason { font-size: 0.875rem; color: var(--gray-700); line-height: 1.5; }

.comment-item { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 0.875rem; }
.comment-meta { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.lab-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: var(--primary); }
.lab-link:hover { text-decoration: underline; }
.lab-deleted { font-size: 0.8rem; color: var(--gray-400); }
.comment-date { font-size: 0.72rem; color: var(--gray-400); margin-left: auto; }
.comment-text { font-size: 0.875rem; color: var(--gray-700); line-height: 1.5; }

@media (max-width: 768px) {
  .profile-hero { flex-direction: column; align-items: flex-start; }
  .profile-grid { grid-template-columns: 1fr; }
  .profile-stats { margin-top: 0.5rem; }
}
</style>
