<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mcpService, mcpSession, type McpUser } from '@/services/mcp.service'
import McpLogin from './McpLogin.vue'

/**
 * Paso de OAuth: Claude abre esta página al tocar "Conectar". La persona inicia sesión
 * (correo + contraseña + código por correo) y aprueba; volvemos a Claude con el código.
 */
const route = useRoute()
const params = Object.fromEntries(Object.entries(route.query).map(([k, v]) => [k, String(v ?? '')]))
const query = new URLSearchParams(params).toString()

const user = ref<McpUser | null>(null)
const clientName = ref('Claude')
const loading = ref(true)
const error = ref('')
const approving = ref(false)

onMounted(async () => {
  try {
    const info = await mcpService.oauthCheck(query)
    clientName.value = info.clientName || 'Claude'
    if (mcpSession.get()) user.value = await mcpService.me().catch(() => null)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

async function approve() {
  approving.value = true
  error.value = ''
  try {
    const { redirectTo } = await mcpService.oauthApprove(params)
    window.location.href = redirectTo
  } catch (e) {
    error.value = (e as Error).message
    approving.value = false
  }
}

function switchUser() {
  mcpSession.clear()
  user.value = null
}
</script>

<template>
  <div v-if="loading" class="auth auth--center"><i class="fa-solid fa-spinner fa-spin"></i></div>

  <div v-else-if="error && !user" class="auth auth--center">
    <div class="auth__card">
      <h1>No se pudo conectar</h1>
      <p>{{ error }}</p>
      <p class="auth__muted">Vuelve a Claude y toca <strong>Conectar</strong> otra vez.</p>
    </div>
  </div>

  <McpLogin v-else-if="!user" @logged="(u) => (user = u)" />

  <div v-else class="auth auth--center">
    <div class="auth__card">
      <span class="auth__logo"><i class="fa-solid fa-plug"></i></span>
      <h1>Conectar {{ clientName }}</h1>
      <p>
        <strong>{{ clientName }}</strong> podrá <strong>ver</strong> los pedidos, ventas, entregas y facturación de
        Nicole y Sucrée. <strong>Solo lectura</strong>: no puede crear ni cambiar nada.
      </p>
      <p class="auth__muted">Entrando como <strong>{{ user.email }}</strong>.</p>
      <p v-if="error" class="auth__error">{{ error }}</p>
      <button class="auth__btn" :disabled="approving" @click="approve">
        <i v-if="approving" class="fa-solid fa-spinner fa-spin"></i> Autorizar y volver a Claude
      </button>
      <button class="auth__link" @click="switchUser">No soy yo / usar otra cuenta</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.auth {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 1.5rem;
  background: linear-gradient(160deg, #1d0a26, #490f57 60%, #812a73);

  &--center { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.4rem; }

  &__card {
    width: 100%;
    max-width: 420px;
    background: #fff;
    color: #2d2433;
    border-radius: 20px;
    padding: 2rem;
    font-size: 1rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);

    h1 { margin: 0; font-size: 1.35rem; color: #490f57; }
    p { margin: 0; line-height: 1.55; }
  }

  &__logo {
    align-self: center;
    display: inline-flex;
    width: 52px;
    height: 52px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: #f3e8f5;
    color: #490f57;
  }

  &__muted { color: #6b6475; font-size: 0.9rem; }
  &__error { color: #b91c1c; font-size: 0.9rem; }

  &__btn {
    padding: 0.9rem;
    border: none;
    border-radius: 10px;
    background: #490f57;
    color: #fff;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;

    &:disabled { opacity: 0.6; cursor: wait; }
  }

  &__link { background: none; border: none; color: #812a73; font-weight: 600; cursor: pointer; }
}
</style>
