<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Mail, Lock, User, Sparkles, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const form = ref({ firstName: '', lastName: '', email: '', password: '', passwordConfirmation: '' })
const loading = ref(false)
const error = ref('')

async function submit() {
  if (form.value.password !== form.value.passwordConfirmation) {
    error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await auth.register(form.value.firstName, form.value.lastName, form.value.email, form.value.password, form.value.passwordConfirmation)
    router.push('/')
  } catch (e: any) {
    const errs = e.response?.data?.errors
    error.value = errs?.[0]?.message || e.response?.data?.message || "Erreur lors de l'inscription"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-icon-wrap"><Sparkles :size="20" /></div>
        <span class="brand-name">ETML Cleaning</span>
      </div>

      <div class="auth-header">
        <h1>Créer un compte</h1>
        <p>Rejoignez l'espace ETML Cleaning</p>
      </div>

      <form @submit.prevent="submit">
        <div v-if="error" class="alert alert-error">
          <AlertCircle :size="16" style="flex-shrink:0;margin-top:1px" />
          {{ error }}
        </div>

        <div class="name-row">
          <div class="form-group">
            <label class="form-label">Prénom *</label>
            <div class="input-with-icon">
              <User :size="16" class="input-icon" />
              <input v-model="form.firstName" class="form-control form-control-icon" placeholder="Thomas" autocomplete="given-name" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input v-model="form.lastName" class="form-control" placeholder="Reynaud" autocomplete="family-name" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Adresse email *</label>
          <div class="input-with-icon">
            <Mail :size="16" class="input-icon" />
            <input v-model="form.email" type="email" class="form-control form-control-icon" placeholder="prenom.nom@etml.ch" autocomplete="email" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            Mot de passe * <span class="hint">8 caractères minimum</span>
          </label>
          <div class="input-with-icon">
            <Lock :size="16" class="input-icon" />
            <input v-model="form.password" type="password" class="form-control form-control-icon" placeholder="••••••••" autocomplete="new-password" required minlength="8" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Confirmer le mot de passe *</label>
          <div class="input-with-icon">
            <Lock :size="16" class="input-icon" />
            <input v-model="form.passwordConfirmation" type="password" class="form-control form-control-icon" placeholder="••••••••" autocomplete="new-password" required />
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full btn-lg" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Créer mon compte</span>
        </button>
      </form>

      <p class="auth-footer">
        Déjà un compte ?
        <RouterLink to="/login">Se connecter</RouterLink>
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
  width: 100%; max-width: 460px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  box-shadow: var(--shadow-lg);
}
.auth-brand { display: flex; align-items: center; gap: 0.5rem; justify-content: center; margin-bottom: 2rem; font-size: 1rem; font-weight: 700; }
.brand-icon-wrap { width: 34px; height: 34px; background: var(--primary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: white; }
.auth-header { text-align: center; margin-bottom: 1.75rem; }
.auth-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.35rem; }
.auth-header p { color: var(--gray-500); font-size: 0.875rem; }
.name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.hint { font-size: 0.72rem; font-weight: 400; color: var(--gray-400); margin-left: 0.25rem; }
.input-with-icon { position: relative; }
.input-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
.form-control-icon { padding-left: 2.5rem; }
.btn-full { width: 100%; justify-content: center; margin-top: 0.5rem; }
.auth-footer { margin-top: 1.5rem; text-align: center; font-size: 0.875rem; color: var(--gray-500); }
.auth-footer a { color: var(--primary); font-weight: 600; margin-left: 0.25rem; }
.auth-footer a:hover { text-decoration: underline; }
@media (max-width: 480px) { .name-row { grid-template-columns: 1fr; } }
</style>
