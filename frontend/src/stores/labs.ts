import { defineStore } from 'pinia'
import { ref } from 'vue'
import { labsApi, type Lab } from '@/services/api'

export const useLabsStore = defineStore('labs', () => {
  const labs = ref<Lab[]>([])
  const currentLab = ref<Lab | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchLabs() {
    loading.value = true
    error.value = null
    try {
      const { data } = await labsApi.getAll()
      labs.value = data
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Erreur lors du chargement des labos'
    } finally {
      loading.value = false
    }
  }

  async function fetchLab(id: number) {
    loading.value = true
    error.value = null
    try {
      const { data } = await labsApi.getOne(id)
      currentLab.value = data
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Labo introuvable'
    } finally {
      loading.value = false
    }
  }

  async function createLab(payload: { name: string; building?: string; location?: string; floor?: string }) {
    const { data } = await labsApi.create(payload)
    labs.value.push(data)
    return data
  }

  async function updateLabStatus(id: number, status: Lab['status']) {
    const { data } = await labsApi.update(id, { status })
    const idx = labs.value.findIndex((l) => l.id === id)
    if (idx !== -1) labs.value[idx] = data
    if (currentLab.value?.id === id) currentLab.value = data
    return data
  }

  async function deleteLab(id: number) {
    await labsApi.delete(id)
    labs.value = labs.value.filter((l) => l.id !== id)
  }

  return { labs, currentLab, loading, error, fetchLabs, fetchLab, createLab, updateLabStatus, deleteLab }
})
