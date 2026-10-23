<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthService from '@/services/auth.service'

const emit = defineEmits<{ (e: 'forgot', email: string): void }>()

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)
const showPassword = ref(false)

const HOME_BY_ROLE: Record<string, string> = {
  production: '/production/summary',
  KITCHEN_DISPLAY: '/production/kitchen',
  RetailManager: '/pos/shipments',
  OPERATIONS_MANAGER: '/operations/report',
  SUPPLY_CHAIN_MANAGER: '/supply-chain/summary',
  WAREHOUSE_RECEIVER: '/supply-chain/receptions',
  superadmin: '/admin/dashboard',
}

const handleLogin = async () => {
  error.value = ''
  isLoading.value = true
  try {
    const response = await AuthService.login({
      email: email.value.toLowerCase().trim(),
      password: password.value,
    })
    if (!response?.token) return

    localStorage.setItem('access_token', response.token)
    if (!response.user) {
      router.push('/')
      return
    }
    localStorage.setItem('user_info', JSON.stringify(response.user))
    router.push(HOME_BY_ROLE[response.user.role] || '/')
  } catch (err: any) {
    error.value = (err.status === 401 || err.message === 'USER_NOT_FOUND' || err.message === 'PASSWORD_INCORRECT')
      ? 'Correo o contraseña incorrectos. Vuelve a intentarlo.'
      : 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.'
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleLogin" class="login-form">
    <label class="field">
      <span class="field-label">Correo electrónico</span>
      <span class="input-wrap">
        <i class="fa-regular fa-envelope"></i>
        <input
          type="email"
          v-model="email"
          placeholder="tu@nicole.com.ec"
          autocomplete="email"
          required
          :disabled="isLoading"
        />
      </span>
    </label>

    <label class="field">
      <span class="field-label">Contraseña</span>
      <span class="input-wrap">
        <i class="fa-solid fa-lock"></i>
        <input
          :type="showPassword ? 'text' : 'password'"
          v-model="password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
          :disabled="isLoading"
        />
        <button
          type="button"
          class="eye-btn"
          :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showPassword = !showPassword"
        >
          <i :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
        </button>
      </span>
    </label>

    <Transition name="shake-fade">
      <div v-if="error" class="error-message">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>{{ error }}</span>
      </div>
    </Transition>

    <button type="submit" class="btn-primary" :disabled="isLoading">
      <span v-if="!isLoading">Iniciar sesión</span>
      <span v-else class="loader"></span>
    </button>

    <button type="button" class="link-btn" @click="emit('forgot', email)">
      ¿Olvidaste tu contraseña?
    </button>
  </form>
</template>

<style lang="scss" scoped>
@include login-form-fields;

.eye-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border: none;
  background: none;
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover { background: #f1f5f9; color: #475569; }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: rgba($error, 0.07);
  border: 1px solid rgba($error, 0.25);
  border-left: 4px solid $error;
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: $error;

  i { flex-shrink: 0; }
}

.shake-fade-enter-active { animation: shake 0.4s ease; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
}
</style>
