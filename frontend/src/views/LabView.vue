<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLabsStore } from '@/stores/labs'
import { useAuthStore } from '@/stores/auth'
import { reportsApi, commentsApi, adminApi, profileApi, type Report, type UserBasic, getPhotoUrl } from '@/services/api'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, MessageSquare,
  Monitor, MapPin, Layers, Building2, Plus, Trash2,
  RefreshCw, Image, Paperclip, User, Lock, X, Search, ShieldAlert, QrCode,
} from 'lucide-vue-next'
import QRCode from 'qrcode'

const props = defineProps<{ id: string }>()
const router = useRouter()
const store = useLabsStore()
const auth = useAuthStore()
const labId = computed(() => Number(props.id))

const showReportModal = ref(false)
const showCommentModal = ref(false)
const showPhotoModal = ref<string | null>(null)

const reportForm = ref({ description: '', reportType: 'lab' as 'lab' | 'workstation', workstationIdentifier: '' })
const selectedLastUser = ref<UserBasic | null>(null)
const userSearch = ref('')
const allUsers = ref<UserBasic[]>([])
const showUserDropdown = ref(false)
const reportFiles = ref<File[]>([])
const reportLoading = ref(false)
const reportError = ref('')

const filteredUsers = computed(() => {
  const q = userSearch.value.toLowerCase()
  if (!q) return allUsers.value
  return allUsers.value.filter(u => u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q))
})

const commentForm = ref({ content: '' })
const commentLoading = ref(false)
const commentError = ref('')

const showQrModal = ref(false)
const qrDataUrl = ref('')

async function openQrModal() {
  const url = `${window.location.origin}/labs/${labId.value}`
  qrDataUrl.value = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
  showQrModal.value = true
}

const showQuickWarnModal = ref(false)
const quickWarnTarget = ref<{ id: number; firstName: string; lastName: string } | null>(null)
const quickWarnReason = ref('')
const quickWarnLoading = ref(false)
const quickWarnError = ref('')

onMounted(() => store.fetchLab(labId.value))

async function openReportModal() {
  showReportModal.value = true
  if (allUsers.value.length === 0) {
    try { const { data } = await profileApi.listUsers(); allUsers.value = data } catch {}
  }
}

function selectLastUser(u: UserBasic) { selectedLastUser.value = u; userSearch.value = ''; showUserDropdown.value = false }
function clearLastUser() { selectedLastUser.value = null; userSearch.value = '' }
function delayHideDropdown() { setTimeout(() => (showUserDropdown.value = false), 150) }

const lab = computed(() => store.currentLab)

const statusConfig: Record<string, { label: string; icon: any; badgeClass: string }> = {
  clean: { label: 'Propre', icon: CheckCircle2, badgeClass: 'badge-clean' },
  dirty: { label: 'Sale', icon: XCircle, badgeClass: 'badge-dirty' },
  needs_attention: { label: 'À vérifier', icon: AlertTriangle, badgeClass: 'badge-needs_attention' },
}
const reportStatusConfig: Record<string, { label: string }> = {
  pending: { label: 'En attente' },
  resolved: { label: 'Résolu' },
  ignored: { label: 'Ignoré' },
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}
function onFilesChange(e: Event) {
  reportFiles.value = Array.from((e.target as HTMLInputElement).files ?? [])
}

async function submitReport() {
  if (!reportForm.value.description.trim()) return
  reportLoading.value = true; reportError.value = ''
  try {
    const fd = new FormData()
    fd.append('description', reportForm.value.description)
    fd.append('report_type', reportForm.value.reportType)
    if (reportForm.value.reportType === 'workstation') {
      fd.append('workstation_identifier', reportForm.value.workstationIdentifier)
      if (selectedLastUser.value) fd.append('last_user_id', String(selectedLastUser.value.id))
    }
    for (const file of reportFiles.value) fd.append('photos', file)
    await reportsApi.create(labId.value, fd)
    reportForm.value = { description: '', reportType: 'lab', workstationIdentifier: '' }
    selectedLastUser.value = null; reportFiles.value = []; showReportModal.value = false
    await store.fetchLab(labId.value)
  } catch (e: any) {
    reportError.value = e.response?.data?.message || 'Erreur lors du signalement'
  } finally { reportLoading.value = false }
}

async function updateReportStatus(report: Report, status: Report['status']) {
  try { await reportsApi.updateStatus(report.id, status); await store.fetchLab(labId.value) } catch {}
}

async function deleteReport(report: Report) {
  if (!confirm(`Supprimer définitivement ce signalement ?`)) return
  try { await reportsApi.delete(report.id); await store.fetchLab(labId.value) } catch {}
}

async function submitComment() {
  if (!commentForm.value.content.trim()) return
  commentLoading.value = true; commentError.value = ''
  try {
    await commentsApi.create(labId.value, { content: commentForm.value.content })
    commentForm.value = { content: '' }; showCommentModal.value = false
    await store.fetchLab(labId.value)
  } catch (e: any) {
    commentError.value = e.response?.data?.message || "Erreur"
  } finally { commentLoading.value = false }
}

async function deleteComment(id: number) {
  if (!confirm('Supprimer ce commentaire ?')) return
  try { await commentsApi.delete(id); await store.fetchLab(labId.value) } catch {}
}

async function markLabClean() {
  if (!lab.value) return
  await store.updateLabStatus(lab.value.id, 'clean')
  await store.fetchLab(labId.value)
}

async function deleteLab() {
  if (!lab.value || !confirm(`Supprimer définitivement "${lab.value.name}" ?`)) return
  try { await store.deleteLab(lab.value.id); router.push('/') } catch {}
}

function openQuickWarn(user: { id: number; firstName: string; lastName: string }) {
  quickWarnTarget.value = user; quickWarnReason.value = ''; quickWarnError.value = ''; showQuickWarnModal.value = true
}

async function submitQuickWarn() {
  if (!quickWarnTarget.value || !quickWarnReason.value.trim()) return
  quickWarnLoading.value = true; quickWarnError.value = ''
  try {
    await adminApi.addWarning(quickWarnTarget.value.id, quickWarnReason.value)
    showQuickWarnModal.value = false
  } catch (e: any) {
    quickWarnError.value = e.response?.data?.message || 'Erreur'
  } finally { quickWarnLoading.value = false }
}
</script>

<template>
  <div>
    <button class="back-btn" @click="router.push('/')">
      <ArrowLeft :size="16" /> Retour aux laboratoires
    </button>

    <div v-if="store.loading" class="loading-center" style="padding:5rem">
      <span class="spinner spinner-dark"></span> Chargement...
    </div>

    <template v-else-if="lab">
      <!-- Lab header -->
      <div class="lab-header card">
        <div class="lab-header-left">
          <div class="lab-title-row">
            <h1>{{ lab.name }}</h1>
            <span :class="`badge badge-${lab.status} badge-md`">
              <component :is="statusConfig[lab.status]?.icon" :size="13" />
              {{ statusConfig[lab.status]?.label }}
            </span>
            <span v-if="lab.building" class="lab-building-chip">
              <Building2 :size="12" /> Bât. {{ lab.building }}
            </span>
          </div>
          <div class="lab-info-row">
            <span v-if="lab.location"><MapPin :size="13" /> {{ lab.location }}</span>
            <span v-if="lab.floor"><Layers :size="13" /> {{ lab.floor }}</span>
          </div>
        </div>
        <div class="lab-actions">
          <button class="btn btn-danger" @click="openReportModal">
            <AlertTriangle :size="15" /> Signaler un problème
          </button>
          <button v-if="auth.isAdmin && lab.status !== 'clean'" class="btn btn-success" @click="markLabClean">
            <CheckCircle2 :size="15" /> Marquer propre
          </button>
          <button class="btn btn-outline" @click="openQrModal" title="Afficher le QR code">
            <QrCode :size="15" />
          </button>
          <button v-if="auth.isAdmin" class="btn btn-outline btn-delete" @click="deleteLab">
            <Trash2 :size="15" />
          </button>
        </div>
      </div>

      <!-- Two columns -->
      <div class="two-col">
        <!-- Reports -->
        <section>
          <div class="section-header">
            <div class="section-title-row">
              <AlertTriangle :size="16" style="color:var(--warning)" />
              <h2>Signalements</h2>
              <span class="count-chip">{{ lab.reports?.length ?? 0 }}</span>
            </div>
          </div>

          <div v-if="!lab.reports?.length" class="empty-panel">
            <CheckCircle2 :size="32" style="color:var(--success);opacity:0.6" />
            <p>Aucun signalement actif</p>
          </div>

          <div v-else class="items-list">
            <div v-for="report in lab.reports" :key="report.id" class="report-card" :class="`report-${report.status}`">
              <div class="report-card-header">
                <div class="report-meta">
                  <span class="report-author">{{ report.reporterName }}</span>
                  <span class="report-date">{{ formatDate(report.createdAt) }}</span>
                </div>
                <div class="report-tags">
                  <span v-if="report.reportType === 'workstation'" class="tag-workstation">
                    <Monitor :size="11" /> Poste
                  </span>
                  <span :class="`badge badge-${report.status} badge-sm`">
                    {{ reportStatusConfig[report.status]?.label }}
                  </span>
                </div>
              </div>

              <div v-if="report.reportType === 'workstation'" class="workstation-row">
                <span v-if="report.workstationIdentifier" class="ws-pill">
                  <Monitor :size="12" /> {{ report.workstationIdentifier }}
                </span>
                <template v-if="report.lastUser">
                  <button v-if="auth.isAdmin" class="ws-pill ws-pill-user ws-pill-clickable" @click="openQuickWarn(report.lastUser!)" title="Avertir cet utilisateur">
                    <User :size="12" /> {{ report.lastUser.firstName }} {{ report.lastUser.lastName }}
                    <AlertTriangle :size="11" class="warn-hint-icon" />
                  </button>
                  <span v-else class="ws-pill ws-pill-user">
                    <User :size="12" /> {{ report.lastUser.firstName }} {{ report.lastUser.lastName }}
                  </span>
                </template>
                <span v-else-if="report.lastUserFirstname || report.lastUserLastname" class="ws-pill ws-pill-user">
                  <User :size="12" /> {{ report.lastUserFirstname }} {{ report.lastUserLastname }}
                </span>
              </div>

              <p class="report-desc">{{ report.description }}</p>

              <div v-if="report.photos?.length" class="photos-row">
                <div v-for="photo in report.photos" :key="photo.id" class="photo-thumb" @click="showPhotoModal = getPhotoUrl(photo.url)">
                  <img :src="getPhotoUrl(photo.url)" :alt="photo.originalName" />
                </div>
              </div>

              <div class="report-actions">
                <template v-if="auth.isAdmin">
                  <button v-if="report.status !== 'resolved'" class="btn btn-success btn-sm" @click="updateReportStatus(report, 'resolved')">
                    <CheckCircle2 :size="13" /> Résolu
                  </button>
                  <button v-if="report.status !== 'ignored'" class="btn btn-outline btn-sm" @click="updateReportStatus(report, 'ignored')">
                    <X :size="13" /> Ignorer
                  </button>
                  <button v-if="report.status !== 'pending'" class="btn btn-outline btn-sm" @click="updateReportStatus(report, 'pending')">
                    <RefreshCw :size="13" /> Rouvrir
                  </button>
                  <button class="btn btn-outline btn-sm btn-delete-report" @click="deleteReport(report)" title="Supprimer définitivement">
                    <ShieldAlert :size="13" /> Supprimer
                  </button>
                </template>
                <span v-else class="admin-hint"><Lock :size="12" /> Actions réservées aux admins</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Comments -->
        <section>
          <div class="section-header">
            <div class="section-title-row">
              <MessageSquare :size="16" style="color:var(--primary)" />
              <h2>Commentaires</h2>
              <span class="count-chip">{{ lab.comments?.length ?? 0 }}</span>
            </div>
            <button class="btn btn-outline btn-sm" @click="showCommentModal = true">
              <Plus :size="14" /> Ajouter
            </button>
          </div>

          <div v-if="!lab.comments?.length" class="empty-panel">
            <MessageSquare :size="32" style="color:var(--gray-300)" />
            <p>Aucun commentaire pour ce laboratoire</p>
          </div>

          <div v-else class="items-list">
            <div v-for="comment in lab.comments" :key="comment.id" class="comment-card">
              <div class="comment-header">
                <div class="comment-author-row">
                  <div class="comment-avatar">{{ comment.authorName?.[0] ?? '?' }}</div>
                  <div>
                    <div class="comment-author">{{ comment.authorName }}</div>
                    <div class="comment-date">{{ formatDate(comment.createdAt) }}</div>
                  </div>
                </div>
                <button v-if="auth.isAdmin" class="btn-icon-del" @click="deleteComment(comment.id)" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
              <p class="comment-text">{{ comment.content }}</p>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- Report modal -->
    <div v-if="showReportModal" class="modal-overlay" @click.self="showReportModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Signaler un problème</h3>
          <button class="modal-close" @click="showReportModal = false"><X :size="14" /></button>
        </div>
        <form @submit.prevent="submitReport">
          <div class="modal-body">
            <div v-if="reportError" class="alert alert-error">{{ reportError }}</div>

            <div class="form-group">
              <label class="form-label">Type de signalement</label>
              <div class="type-selector">
                <label class="type-option" :class="{ active: reportForm.reportType === 'lab' }">
                  <input v-model="reportForm.reportType" type="radio" value="lab" class="sr-only" />
                  <Building2 :size="22" />
                  <span>Salle entière</span>
                </label>
                <label class="type-option" :class="{ active: reportForm.reportType === 'workstation' }">
                  <input v-model="reportForm.reportType" type="radio" value="workstation" class="sr-only" />
                  <Monitor :size="22" />
                  <span>Poste de travail</span>
                </label>
              </div>
            </div>

            <template v-if="reportForm.reportType === 'workstation'">
              <div class="form-group">
                <label class="form-label">Identifiant du poste *</label>
                <input v-model="reportForm.workstationIdentifier" class="form-control" placeholder="ex: Poste 5, PC-A03..." required />
              </div>
              <div class="form-group">
                <label class="form-label">Dernier utilisateur du poste</label>
                <div v-if="selectedLastUser" class="user-chip">
                  <div class="chip-avatar">{{ selectedLastUser.firstName[0] }}{{ selectedLastUser.lastName[0] }}</div>
                  <span>{{ selectedLastUser.firstName }} {{ selectedLastUser.lastName }}</span>
                  <button type="button" class="chip-remove" @click="clearLastUser"><X :size="13" /></button>
                </div>
                <div v-else class="user-search-wrap">
                  <Search :size="15" class="user-search-icon" />
                  <input
                    v-model="userSearch"
                    class="form-control user-search-input"
                    placeholder="Rechercher un utilisateur..."
                    autocomplete="off"
                    @focus="showUserDropdown = true"
                    @blur="delayHideDropdown()"
                  />
                  <div v-if="showUserDropdown && filteredUsers.length" class="user-dropdown-list">
                    <button v-for="u in filteredUsers.slice(0,8)" :key="u.id" type="button" class="user-dropdown-item" @mousedown.prevent="selectLastUser(u)">
                      <div class="dd-avatar">{{ u.firstName[0] }}{{ u.lastName[0] }}</div>
                      {{ u.firstName }} {{ u.lastName }}
                    </button>
                    <div v-if="filteredUsers.length > 8" class="dd-more">+{{ filteredUsers.length - 8 }} autres — affinez la recherche</div>
                  </div>
                  <div v-if="showUserDropdown && userSearch && !filteredUsers.length" class="user-dropdown-list">
                    <div class="dd-empty">Aucun utilisateur trouvé</div>
                  </div>
                </div>
              </div>
            </template>

            <div class="form-group">
              <label class="form-label">Description *</label>
              <textarea v-model="reportForm.description" class="form-control" placeholder="Décrivez le problème..." rows="4" required></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Photos <span style="font-weight:400;color:var(--gray-400)">(optionnel)</span></label>
              <label class="file-upload-area">
                <Image :size="20" style="color:var(--gray-400)" />
                <span>Cliquer pour ajouter des photos</span>
                <input type="file" class="sr-only" accept="image/*" multiple @change="onFilesChange" />
              </label>
              <div v-if="reportFiles.length" class="files-list">
                <span v-for="f in reportFiles" :key="f.name" class="file-chip">
                  <Paperclip :size="11" /> {{ f.name }}
                </span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showReportModal = false">Annuler</button>
            <button type="submit" class="btn btn-danger" :disabled="reportLoading">
              <span v-if="reportLoading" class="spinner"></span>
              <AlertTriangle v-else :size="15" />
              Envoyer le signalement
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Comment modal -->
    <div v-if="showCommentModal" class="modal-overlay" @click.self="showCommentModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Ajouter un commentaire</h3>
          <button class="modal-close" @click="showCommentModal = false"><X :size="14" /></button>
        </div>
        <form @submit.prevent="submitComment">
          <div class="modal-body">
            <div v-if="commentError" class="alert alert-error">{{ commentError }}</div>
            <div class="form-group">
              <label class="form-label">Commentaire *</label>
              <textarea v-model="commentForm.content" class="form-control" placeholder="Votre commentaire..." rows="4" required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showCommentModal = false">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="commentLoading">
              <span v-if="commentLoading" class="spinner"></span>
              <MessageSquare v-else :size="15" />
              Publier
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Quick warn modal -->
    <div v-if="showQuickWarnModal && quickWarnTarget" class="modal-overlay" @click.self="showQuickWarnModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Avertissement — {{ quickWarnTarget.firstName }} {{ quickWarnTarget.lastName }}</h3>
          <button class="modal-close" @click="showQuickWarnModal = false"><X :size="14" /></button>
        </div>
        <form @submit.prevent="submitQuickWarn">
          <div class="modal-body">
            <div v-if="quickWarnError" class="alert alert-error">{{ quickWarnError }}</div>
            <div class="warn-context">
              <AlertTriangle :size="15" style="flex-shrink:0" />
              Dernier utilisateur signalé sur ce poste.
            </div>
            <div class="form-group">
              <label class="form-label">Raison de l'avertissement *</label>
              <textarea v-model="quickWarnReason" class="form-control" rows="4" placeholder="Motif de l'avertissement..." required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showQuickWarnModal = false">Annuler</button>
            <button type="submit" class="btn btn-danger" :disabled="quickWarnLoading">
              <span v-if="quickWarnLoading" class="spinner"></span>
              <AlertTriangle v-else :size="15" />
              Envoyer l'avertissement
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- QR Code modal -->
    <div v-if="showQrModal" class="modal-overlay" @click.self="showQrModal = false">
      <div class="modal modal-qr">
        <div class="modal-header">
          <h3><QrCode :size="16" style="margin-right:0.4rem" /> QR Code — {{ lab?.name }}</h3>
          <button class="modal-close" @click="showQrModal = false"><X :size="14" /></button>
        </div>
        <div class="modal-body qr-body">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="qr-image" />
          <p class="qr-hint">Scannez ce code pour accéder directement à la page de signalement du labo.</p>
          <a :href="qrDataUrl" :download="`qr-${lab?.name}.png`" class="btn btn-outline btn-sm">
            Télécharger
          </a>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <div v-if="showPhotoModal" class="modal-overlay" @click="showPhotoModal = null">
      <div class="lightbox">
        <img :src="showPhotoModal" alt="Photo" />
        <button class="lightbox-close" @click="showPhotoModal = null"><X :size="16" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.back-btn { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--gray-500); font-size: 0.85rem; font-weight: 500; background: none; border: none; cursor: pointer; margin-bottom: 1.5rem; padding: 0; transition: color 0.15s; font-family: inherit; }
.back-btn:hover { color: var(--primary); }

.lab-header { padding: 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.lab-title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.lab-title-row h1 { font-size: 1.6rem; font-weight: 700; }
.badge-md { font-size: 0.8rem; padding: 0.3rem 0.75rem; }
.lab-building-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--primary-light); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; }
.lab-info-row { display: flex; align-items: center; gap: 1.25rem; font-size: 0.85rem; color: var(--gray-500); flex-wrap: wrap; }
.lab-info-row span { display: flex; align-items: center; gap: 0.35rem; }
.lab-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.btn-delete { color: var(--danger) !important; border-color: #fecaca !important; padding: 0.5rem; }
.btn-delete:hover { background: var(--danger-light) !important; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }

.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.section-title-row { display: flex; align-items: center; gap: 0.5rem; }
.section-title-row h2 { font-size: 1rem; font-weight: 600; }
.count-chip { background: var(--gray-100); color: var(--gray-600); padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }

.empty-panel { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 2.5rem 1rem; text-align: center; box-shadow: var(--shadow); }
.empty-panel svg { display: block; margin: 0 auto 0.75rem; }
.empty-panel p { font-size: 0.875rem; color: var(--gray-400); }

.items-list { display: flex; flex-direction: column; gap: 0.875rem; }

.report-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 1rem; box-shadow: var(--shadow); border-left: 3px solid var(--gray-200); }
.report-pending { border-left-color: var(--warning); }
.report-resolved { border-left-color: var(--success); }
.report-ignored { border-left-color: var(--gray-300); }
.report-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem; gap: 0.5rem; }
.report-meta { display: flex; flex-direction: column; gap: 0.15rem; }
.report-author { font-size: 0.875rem; font-weight: 600; }
.report-date { font-size: 0.72rem; color: var(--gray-400); }
.report-tags { display: flex; align-items: center; gap: 0.4rem; }
.badge-sm { padding: 0.15rem 0.5rem; font-size: 0.68rem; }
.tag-workstation { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--primary-light); color: var(--primary); padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }

.workstation-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
.ws-pill { display: inline-flex; align-items: center; gap: 0.35rem; background: var(--gray-100); color: var(--gray-600); padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.775rem; font-weight: 500; }
.ws-pill-user { background: #eff6ff; color: var(--primary); }
.ws-pill-clickable { border: none; cursor: pointer; transition: background 0.1s; font-family: inherit; }
.ws-pill-clickable:hover { background: #dbeafe; }
.warn-hint-icon { color: var(--warning); margin-left: 0.1rem; }

.report-desc { font-size: 0.875rem; line-height: 1.5; color: var(--gray-700); margin-bottom: 0.75rem; }
.photos-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.photo-thumb { width: 72px; height: 72px; border-radius: var(--radius-sm); overflow: hidden; cursor: pointer; border: 2px solid var(--gray-200); transition: border-color 0.1s; }
.photo-thumb:hover { border-color: var(--primary); }
.photo-thumb img { width: 100%; height: 100%; object-fit: cover; }

.report-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; padding-top: 0.625rem; border-top: 1px solid var(--gray-100); }
.admin-hint { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--gray-400); font-style: italic; }
.btn-delete-report { color: var(--danger) !important; border-color: #fecaca !important; margin-left: auto; }
.btn-delete-report:hover { background: var(--danger-light) !important; }

.comment-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 1rem; box-shadow: var(--shadow); }
.comment-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem; }
.comment-author-row { display: flex; align-items: center; gap: 0.6rem; }
.comment-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
.comment-author { font-size: 0.875rem; font-weight: 600; }
.comment-date { font-size: 0.72rem; color: var(--gray-400); }
.btn-icon-del { background: none; border: none; cursor: pointer; color: var(--gray-300); padding: 0.2rem; border-radius: var(--radius-sm); transition: all 0.15s; display: flex; }
.btn-icon-del:hover { color: var(--danger); background: var(--danger-light); }
.comment-text { font-size: 0.875rem; color: var(--gray-700); line-height: 1.5; }

/* Type selector */
.type-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.type-option { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1rem; border: 1.5px solid var(--gray-200); border-radius: var(--radius); cursor: pointer; transition: all 0.15s; text-align: center; font-size: 0.875rem; font-weight: 500; color: var(--gray-600); }
.type-option:hover { border-color: var(--primary); color: var(--primary); }
.type-option.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }

/* User search */
.user-search-wrap { position: relative; }
.user-search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
.user-search-input { padding-left: 2.5rem; }
.user-dropdown-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow-md); z-index: 50; max-height: 220px; overflow-y: auto; }
.user-dropdown-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.875rem; font-size: 0.875rem; background: none; border: none; width: 100%; text-align: left; cursor: pointer; font-family: inherit; transition: background 0.1s; }
.user-dropdown-item:hover { background: var(--gray-50); }
.dd-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
.dd-more, .dd-empty { padding: 0.5rem 0.875rem; font-size: 0.775rem; color: var(--gray-400); text-align: center; border-top: 1px solid var(--gray-100); }

.user-chip { display: inline-flex; align-items: center; gap: 0.6rem; background: var(--primary-light); border: 1px solid #bfdbfe; padding: 0.45rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--primary); font-weight: 500; }
.chip-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
.chip-remove { background: none; border: none; cursor: pointer; color: var(--primary); display: flex; padding: 0; }
.chip-remove:hover { color: var(--danger); }

/* File upload */
.file-upload-area { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 1.25rem; border: 1.5px dashed var(--gray-300); border-radius: var(--radius); cursor: pointer; text-align: center; font-size: 0.8rem; color: var(--gray-500); transition: all 0.15s; }
.file-upload-area:hover { border-color: var(--primary); color: var(--primary); }
.files-list { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
.file-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--gray-100); color: var(--gray-600); padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }

.warn-context { display: flex; align-items: center; gap: 0.5rem; background: var(--warning-light); border: 1px solid #fde68a; padding: 0.65rem 0.875rem; border-radius: var(--radius-sm); font-size: 0.825rem; color: #92400e; margin-bottom: 1rem; }

.modal-qr { max-width: 340px; width: 100%; }
.qr-body { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding-top: 0.5rem; }
.qr-image { width: 280px; height: 280px; border-radius: var(--radius); border: 1px solid var(--gray-200); }
.qr-hint { font-size: 0.825rem; color: var(--gray-500); text-align: center; line-height: 1.5; }

.lightbox { position: relative; max-width: 92vw; max-height: 92vh; }
.lightbox img { max-width: 100%; max-height: 92vh; border-radius: var(--radius); display: block; }
.lightbox-close { position: absolute; top: -0.75rem; right: -0.75rem; background: white; border: 1px solid var(--gray-200); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .lab-header { flex-direction: column; }
  .lab-title-row h1 { font-size: 1.3rem; }
  .lab-actions { width: 100%; }
}
</style>
