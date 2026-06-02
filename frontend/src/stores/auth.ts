import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export interface AuthUser {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: 'user' | 'admin'
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const user = ref<AuthUser | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  if (token.value) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  function setAuth(newToken: string, newUser: AuthUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('auth_token', newToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    delete api.defaults.headers.common['Authorization']
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const { data } = await api.get<AuthUser>('/api/auth/me')
      user.value = data
    } catch {
      clearAuth()
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<{ user: AuthUser; token: string }>('/api/auth/login', {
      email,
      password,
    })
    setAuth(data.token, data.user)
  }

  async function register(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ) {
    const { data } = await api.post<{ user: AuthUser; token: string }>('/api/auth/register', {
      firstName,
      lastName,
      email,
      password,
      passwordConfirmation,
    })
    setAuth(data.token, data.user)
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } catch {}
    clearAuth()
  }

  return { token, user, isLoggedIn, isAdmin, setAuth, clearAuth, fetchMe, login, register, logout }
})
