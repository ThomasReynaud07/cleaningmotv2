<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Mail, Lock, Sparkles, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const form = ref({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.value.email, form.value.password)
    router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.message || e.response?.data?.errors?.[0]?.message || 'Email ou mot de passe incorrect'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-icon-wrap">
          <Sparkles :size="20" />
        </div>
        <span class="brand-name">ETML Cleaning</span>
      </div>

      <div class="auth-header">
        <h1>Connexion</h1>
        <p>Accédez à votre espace ETML</p>
      </div>

      <form @submit.prevent="submit">
        <div v-if="error" class="alert alert-error">
          <AlertCircle :size="16" style="flex-shrink:0;margin-top:1px" />
          {{ error }}
        </div>

        <div class="form-group">
          <label class="form-label">Adresse email</label>
          <div class="input-with-icon">
            <Mail :size="16" class="input-icon" />
            <input
              v-model="form.email"
              type="email"
              class="form-control form-control-icon"
              placeholder="prenom.nom@etml.ch"
              autocomplete="email"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <div class="input-with-icon">
            <Lock :size="16" class="input-icon" />
            <input
              v-model="form.password"
              type="password"
              class="form-control form-control-icon"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full btn-lg" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Se connecter</span>
        </button>
      </form>

      <p class="auth-footer">
        Pas encore de compte ?
        <RouterLink to="/register">S'inscrire</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - var(--nav-height));
  display: flex; align-items: center; justify-content: center;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--gray-50) 100%);
}
.auth-card {
  width: 100%; max-width: 420px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  box-shadow: var(--shadow-lg);
}
.auth-brand {
  display: flex; align-items: center; gap: 0.5rem;
  justify-content: center;
  margin-bottom: 2rem;
  font-size: 1rem; font-weight: 700; color: var(--gray-900);
}
.brand-icon-wrap {
  width: 34px; height: 34px;
  background: var(--primary); border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; color: white;
}
.auth-header { text-align: center; margin-bottom: 1.75rem; }
.auth-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.35rem; }
.auth-header p { color: var(--gray-500); font-size: 0.875rem; }

.input-with-icon { position: relative; }
.input-icon {
  position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
  color: var(--gray-400); pointer-events: none;
}
.form-control-icon { padding-left: 2.5rem; }

.btn-full { width: 100%; justify-content: center; margin-top: 0.5rem; }

.auth-footer {
  margin-top: 1.5rem; text-align: center;
  font-size: 0.875rem; color: var(--gray-500);
}
.auth-footer a { color: var(--primary); font-weight: 600; margin-left: 0.25rem; }
.auth-footer a:hover { text-decoration: underline; }
</style>
