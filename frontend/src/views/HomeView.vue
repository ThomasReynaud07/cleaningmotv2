<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLabsStore } from '@/stores/labs'
import { useAuthStore } from '@/stores/auth'
import type { Lab } from '@/services/api'
import {
  Building2, CheckCircle2, AlertTriangle, XCircle, Search,
  Plus, MapPin, Layers, ChevronRight, LayoutGrid, Filter,
} from 'lucide-vue-next'

const router = useRouter()
const store = useLabsStore()
const auth = useAuthStore()

const showAddModal = ref(false)
const addForm = ref({ name: '', location: '', floor: '', building: '' as '' | 'A' | 'B' | 'C' })
const addLoading = ref(false)
const addError = ref('')
const searchQuery = ref('')
const filterStatus = ref<'all' | Lab['status']>('all')
const selectedBuilding = ref<'all' | 'A' | 'B' | 'C'>('all')

function labBuilding(lab: Lab): string | null {
  if (lab.building) return lab.building
  const loc = lab.location?.toLowerCase() ?? ''
  if (loc.includes('bâtiment a') || loc.includes('batiment a')) return 'A'
  if (loc.includes('bâtiment b') || loc.includes('batiment b')) return 'B'
  if (loc.includes('bâtiment c') || loc.includes('batiment c')) return 'C'
  return null
}

const buildingLabs = computed(() =>
  selectedBuilding.value === 'all'
    ? store.labs
    : store.labs.filter((l) => labBuilding(l) === selectedBuilding.value)
)

const filteredLabs = computed(() =>
  buildingLabs.value.filter((lab) => {
    const matchSearch = lab.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (lab.location?.toLowerCase().includes(searchQuery.value.toLowerCase()) ?? false)
    return matchSearch && (filterStatus.value === 'all' || lab.status === filterStatus.value)
  })
)

const stats = computed(() => ({
  total: store.labs.length,
  clean: store.labs.filter((l) => l.status === 'clean').length,
  dirty: store.labs.filter((l) => l.status === 'dirty').length,
  attention: store.labs.filter((l) => l.status === 'needs_attention').length,
}))

function buildingStats(b: 'A' | 'B' | 'C') {
  const labs = store.labs.filter((l) => labBuilding(l) === b)
  return {
    total: labs.length,
    clean: labs.filter((l) => l.status === 'clean').length,
    dirty: labs.filter((l) => l.status === 'dirty').length,
    attention: labs.filter((l) => l.status === 'needs_attention').length,
  }
}

function buildingStatusClass(s: ReturnType<typeof buildingStats>) {
  if (s.dirty > 0) return 'status-dirty'
  if (s.attention > 0) return 'status-attention'
  return 'status-clean'
}

onMounted(() => store.fetchLabs())

async function submitAddLab() {
  if (!addForm.value.name.trim()) return
  addLoading.value = true; addError.value = ''
  try {
    await store.createLab({
      name: addForm.value.name,
      building: addForm.value.building || undefined,
      location: addForm.value.location || undefined,
      floor: addForm.value.floor || undefined,
    })
    showAddModal.value = false
    addForm.value = { name: '', location: '', floor: '', building: '' }
  } catch (e: any) {
    addError.value = e.response?.data?.message || 'Erreur lors de la création'
  } finally { addLoading.value = false }
}

const statusConfig = {
  clean: { label: 'Propre', class: 'badge-clean', icon: CheckCircle2, color: 'var(--success)' },
  dirty: { label: 'Sale', class: 'badge-dirty', icon: XCircle, color: 'var(--danger)' },
  needs_attention: { label: 'À vérifier', class: 'badge-needs_attention', icon: AlertTriangle, color: 'var(--warning)' },
}
</script>

<template>
  <div>
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><LayoutGrid :size="18" /></div>
        <div class="stat-body">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">Total laboratoires</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-green"><CheckCircle2 :size="18" /></div>
        <div class="stat-body">
          <div class="stat-number" style="color:var(--success)">{{ stats.clean }}</div>
          <div class="stat-label">Propres</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-red"><XCircle :size="18" /></div>
        <div class="stat-body">
          <div class="stat-number" style="color:var(--danger)">{{ stats.dirty }}</div>
          <div class="stat-label">Sales</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-yellow"><AlertTriangle :size="18" /></div>
        <div class="stat-body">
          <div class="stat-number" style="color:var(--warning)">{{ stats.attention }}</div>
          <div class="stat-label">À vérifier</div>
        </div>
      </div>
    </div>

    <!-- Building selector -->
    <div class="section-label">
      <Building2 :size="15" />
      Sélectionner un bâtiment
    </div>
    <div class="building-grid">
      <button class="building-card" :class="{ active: selectedBuilding === 'all' }" @click="selectedBuilding = 'all'">
        <div class="building-card-top">
          <div class="building-icon"><LayoutGrid :size="20" /></div>
          <span class="building-count">{{ store.labs.length }}</span>
        </div>
        <div class="building-name">Tous les bâtiments</div>
        <div class="building-status-text">Vue globale</div>
      </button>

      <button
        v-for="b in ['A', 'B', 'C'] as const"
        :key="b"
        class="building-card"
        :class="[{ active: selectedBuilding === b }, buildingStatusClass(buildingStats(b))]"
        @click="selectedBuilding = b"
      >
        <div class="building-card-top">
          <div class="building-icon"><Building2 :size="20" /></div>
          <span class="building-count">{{ buildingStats(b).total }}</span>
        </div>
        <div class="building-name">Bâtiment {{ b }}</div>
        <div class="building-status-text">
          <span v-if="buildingStats(b).dirty > 0" class="bst-dirty">
            <XCircle :size="12" /> {{ buildingStats(b).dirty }} sale{{ buildingStats(b).dirty > 1 ? 's' : '' }}
          </span>
          <span v-else-if="buildingStats(b).attention > 0" class="bst-attention">
            <AlertTriangle :size="12" /> {{ buildingStats(b).attention }} à vérifier
          </span>
          <span v-else class="bst-clean">
            <CheckCircle2 :size="12" /> Tout propre
          </span>
        </div>
      </button>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="search-box">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="form-control search-input"
          :placeholder="selectedBuilding === 'all' ? 'Rechercher un laboratoire...' : `Rechercher dans le bâtiment ${selectedBuilding}...`"
        />
      </div>
      <div class="toolbar-right">
        <div class="filter-select-wrap">
          <Filter :size="14" class="filter-icon" />
          <select v-model="filterStatus" class="form-control filter-select">
            <option value="all">Tous les statuts</option>
            <option value="clean">Propre</option>
            <option value="dirty">Sale</option>
            <option value="needs_attention">À vérifier</option>
          </select>
        </div>
        <button v-if="auth.isAdmin" class="btn btn-primary" @click="showAddModal = true">
          <Plus :size="16" /> Ajouter un labo
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="loading-center">
      <span class="spinner spinner-dark"></span>
      Chargement des laboratoires...
    </div>
    <div v-else-if="store.error" class="alert alert-error">{{ store.error }}</div>

    <!-- Grid -->
    <div v-else class="labs-grid">
      <div
        v-for="lab in filteredLabs"
        :key="lab.id"
        class="lab-card"
        :class="`lab-card--${lab.status}`"
        @click="router.push(`/labs/${lab.id}`)"
      >
        <div class="lab-card-top">
          <div class="lab-status-dot" :class="`dot-${lab.status}`"></div>
          <div class="lab-badges">
            <span v-if="labBuilding(lab)" class="lab-building-badge">{{ labBuilding(lab) }}</span>
            <span :class="`badge badge-${lab.status}`">
              <component :is="statusConfig[lab.status].icon" :size="11" />
              {{ statusConfig[lab.status].label }}
            </span>
          </div>
        </div>
        <h3 class="lab-name">{{ lab.name }}</h3>
        <div class="lab-meta">
          <span v-if="lab.location" class="lab-meta-item">
            <MapPin :size="12" /> {{ lab.location }}
          </span>
          <span v-if="lab.floor" class="lab-meta-item">
            <Layers :size="12" /> {{ lab.floor }}
          </span>
        </div>
        <div class="lab-card-footer">
          Voir les détails <ChevronRight :size="14" />
        </div>
      </div>

      <div v-if="filteredLabs.length === 0" class="empty-state" style="grid-column:1/-1">
        <Search :size="40" />
        <p>Aucun laboratoire trouvé</p>
        <p v-if="searchQuery || filterStatus !== 'all'" style="font-size:0.8rem;margin-top:0.25rem">
          Modifiez vos filtres
        </p>
      </div>
    </div>

    <!-- Add lab modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Ajouter un laboratoire</h3>
          <button class="modal-close" @click="showAddModal = false"><Plus :size="14" style="transform:rotate(45deg)" /></button>
        </div>
        <form @submit.prevent="submitAddLab">
          <div class="modal-body">
            <div v-if="addError" class="alert alert-error">{{ addError }}</div>
            <div class="form-group">
              <label class="form-label">Nom du laboratoire *</label>
              <input v-model="addForm.name" class="form-control" placeholder="ex: Labo 301" required />
            </div>
            <div class="form-group">
              <label class="form-label">Bâtiment</label>
              <select v-model="addForm.building" class="form-control">
                <option value="">— Sélectionner —</option>
                <option value="A">Bâtiment A</option>
                <option value="B">Bâtiment B</option>
                <option value="C">Bâtiment C</option>
              </select>
            </div>
            <div class="two-inputs">
              <div class="form-group">
                <label class="form-label">Localisation</label>
                <input v-model="addForm.location" class="form-control" placeholder="ex: Bâtiment A" />
              </div>
              <div class="form-group">
                <label class="form-label">Étage</label>
                <input v-model="addForm.floor" class="form-control" placeholder="ex: 2ème étage" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showAddModal = false">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="addLoading">
              <span v-if="addLoading" class="spinner"></span>
              <Plus v-else :size="15" />
              Créer le laboratoire
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 1.75rem; }
.stat-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 1.1rem 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow); }
.stat-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon-blue { background: var(--primary-light); color: var(--primary); }
.stat-icon-green { background: var(--success-light); color: var(--success); }
.stat-icon-red { background: var(--danger-light); color: var(--danger); }
.stat-icon-yellow { background: var(--warning-light); color: var(--warning); }
.stat-number { font-size: 1.75rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.75rem; color: var(--gray-500); margin-top: 0.2rem; }

/* Section label */
.section-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem; }

/* Buildings */
.building-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 1.75rem; }
.building-card {
  background: white; border: 1.5px solid var(--gray-200);
  border-radius: var(--radius); padding: 1.1rem 1.25rem;
  cursor: pointer; text-align: left;
  transition: all 0.15s; box-shadow: var(--shadow);
  font-family: inherit;
}
.building-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.building-card.active { border-color: var(--primary); background: var(--primary-light); }
.building-card.status-dirty { border-left: 3px solid var(--danger); }
.building-card.status-attention { border-left: 3px solid var(--warning); }
.building-card.status-clean { border-left: 3px solid var(--success); }
.building-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
.building-icon { color: var(--gray-400); }
.building-card.active .building-icon { color: var(--primary); }
.building-count { font-size: 1.5rem; font-weight: 700; color: var(--gray-800); }
.building-name { font-size: 0.9rem; font-weight: 600; color: var(--gray-800); margin-bottom: 0.25rem; }
.building-status-text { font-size: 0.75rem; display: flex; align-items: center; gap: 0.3rem; }
.bst-clean { color: var(--success); display: flex; align-items: center; gap: 0.3rem; }
.bst-dirty { color: var(--danger); display: flex; align-items: center; gap: 0.3rem; }
.bst-attention { color: var(--warning); display: flex; align-items: center; gap: 0.3rem; }

/* Toolbar */
.toolbar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.search-box { position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
.search-input { padding-left: 2.5rem; }
.toolbar-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
.filter-select-wrap { position: relative; display: flex; align-items: center; }
.filter-icon { position: absolute; left: 0.6rem; color: var(--gray-400); pointer-events: none; z-index: 1; }
.filter-select { padding-left: 2rem; min-width: 160px; cursor: pointer; }

/* Labs grid */
.labs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 1rem; }
.lab-card {
  background: white; border: 1px solid var(--gray-200);
  border-radius: var(--radius); padding: 1.25rem;
  cursor: pointer; transition: all 0.15s;
  border-top: 3px solid transparent;
  box-shadow: var(--shadow);
}
.lab-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--gray-300); }
.lab-card--clean { border-top-color: var(--success); }
.lab-card--dirty { border-top-color: var(--danger); }
.lab-card--needs_attention { border-top-color: var(--warning); }

.lab-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.875rem; }
.lab-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-clean { background: var(--success); box-shadow: 0 0 0 3px #dcfce7; }
.dot-dirty { background: var(--danger); box-shadow: 0 0 0 3px #fee2e2; }
.dot-needs_attention { background: var(--warning); box-shadow: 0 0 0 3px #fef9c3; }
.lab-badges { display: flex; align-items: center; gap: 0.4rem; }
.lab-building-badge { background: var(--primary-light); color: var(--primary); padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }

.lab-name { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.6rem; color: var(--gray-900); }
.lab-meta { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 1rem; }
.lab-meta-item { font-size: 0.775rem; color: var(--gray-500); display: flex; align-items: center; gap: 0.35rem; }
.lab-card-footer { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--primary); font-weight: 500; border-top: 1px solid var(--gray-100); padding-top: 0.75rem; }

.two-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

@media (max-width: 1024px) { .building-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2,1fr); }
  .building-grid { grid-template-columns: repeat(2,1fr); }
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-right { flex-wrap: wrap; }
  .search-box { min-width: unset; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: repeat(2,1fr); }
  .building-grid { grid-template-columns: 1fr 1fr; }
  .two-inputs { grid-template-columns: 1fr; }
}
</style>
