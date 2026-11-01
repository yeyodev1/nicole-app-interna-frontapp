<script setup lang="ts">
import { ref } from 'vue'
import { mcpService, mcpSession, type McpUser } from '@/services/mcp.service'

const emit = defineEmits<{ (e: 'logged', user: McpUser): void }>()

const step = ref<'password' | 'code'>('password')
const email = ref('')
const password = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')

async function sendPassword() {
  error.value = ''
  loading.value = true
  try {
    await mcpService.login(email.value.trim(), password.value)
    step.value = 'code'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function sendCode() {
  error.value = ''
  loading.value = true
  try {
    const { token, user } = await mcpService.verify(email.value.trim(), code.value.trim())
    mcpSession.set(token)
    emit('logged', user)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <div class="login__brand">
        <span class="login__logo"><i class="fa-solid fa-plug"></i></span>
        <h1>Conector de Claude</h1>
        <p>Nicole Pastry Arts · Sucrée</p>
      </div>

      <form v-if="step === 'password'" class="login__form" @submit.prevent="sendPassword">
        <label>
          <span>Correo</span>
          <input v-model="email" type="email" autocomplete="username" required placeholder="tu@correo.com" />
        </label>
        <label>
          <span>Contraseña</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" class="login__error"><i class="fa-solid fa-circle-exclamation"></i> {{ error }}</p>
        <button class="login__btn" :disabled="loading">
          <i v-if="loading" class="fa-solid fa-spinner fa-spin"></i> Continuar
        </button>
      </form>

      <form v-else class="login__form" @submit.prevent="sendCode">
        <p class="login__hint">
          Te enviamos un código de 6 dígitos a <strong>{{ email }}</strong>. Revisa también spam.
        </p>
        <label>
          <span>Código</span>
          <input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required class="login__code" placeholder="000000" />
        </label>
        <p v-if="error" class="login__error"><i class="fa-solid fa-circle-exclamation"></i> {{ error }}</p>
        <button class="login__btn" :disabled="loading">
          <i v-if="loading" class="fa-solid fa-spinner fa-spin"></i> Entrar
        </button>
        <button type="button" class="login__link" @click="(step = 'password'), (code = ''), (error = '')">
          Usar otro correo o reenviar código
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: linear-gradient(160deg, #1d0a26, #490f57 60%, #812a73);

  &__card {
    width: 100%;
    max-width: 400px;
    background: #fff;
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
  }

  &__brand {
    text-align: center;
    margin-bottom: 1.5rem;

    h1 { margin: 0.6rem 0 0.2rem; font-size: 1.4rem; color: #490f57; }
    p { margin: 0; color: #6b6475; font-size: 0.9rem; }
  }

  &__logo {
    display: inline-flex;
    width: 52px;
    height: 52px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: #f3e8f5;
    color: #490f57;
    font-size: 1.3rem;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    label { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 600; font-size: 0.9rem; color: #2d2433; }
    input { padding: 0.8rem 0.9rem; border: 1px solid #ddd3e3; border-radius: 10px; font-size: 1rem; }
    input:focus { outline: 2px solid #812a73; border-color: transparent; }
  }

  &__code { letter-spacing: 0.5em; text-align: center; font-size: 1.4rem !important; font-weight: 700; }
  &__hint { margin: 0; color: #4b4453; font-size: 0.92rem; line-height: 1.5; }
  &__error { margin: 0; color: #b91c1c; font-size: 0.88rem; font-weight: 500; }

  &__btn {
    padding: 0.85rem;
    border: none;
    border-radius: 10px;
    background: #490f57;
    color: #fff;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;

    &:disabled { opacity: 0.6; cursor: wait; }
  }

  &__link {
    background: none;
    border: none;
    color: #812a73;
    font-weight: 600;
    cursor: pointer;
  }
}
</style>
