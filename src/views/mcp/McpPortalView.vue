<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { mcpService, mcpSession, type McpUser } from '@/services/mcp.service'
import McpLogin from './McpLogin.vue'
import McpConnect from './McpConnect.vue'
import McpUsers from './McpUsers.vue'

/**
 * Portal del conector MCP de solo lectura (app.nicole.com.ec/mcp). Sesión propia, aparte
 * de la app interna: correo + contraseña + código por correo.
 */
const user = ref<McpUser | null>(null)
const checking = ref(true)
const tab = ref<'connect' | 'users'>('connect')
const menuOpen = ref(false)

onMounted(async () => {
  if (mcpSession.get()) {
    try {
      user.value = await mcpService.me()
    } catch {
      mcpSession.clear()
    }
  }
  checking.value = false
})

function logout() {
  mcpSession.clear()
  user.value = null
  tab.value = 'connect'
}

function go(t: 'connect' | 'users') {
  tab.value = t
  menuOpen.value = false
}
</script>

<template>
  <div v-if="checking" class="portal__loading"><i class="fa-solid fa-spinner fa-spin"></i></div>

  <McpLogin v-else-if="!user" @logged="(u) => (user = u)" />

  <div v-else class="portal">
    <button class="portal__burger" aria-label="Menú" @click="menuOpen = !menuOpen">
      <i class="fa-solid fa-bars"></i>
    </button>

    <aside class="portal__side" :class="{ open: menuOpen }">
      <div class="portal__brand">
        <i class="fa-solid fa-plug"></i>
        <div>
          <strong>Conector Claude</strong>
          <small>Nicole · Sucrée</small>
        </div>
      </div>
      <nav>
        <button :class="{ on: tab === 'connect' }" @click="go('connect')">
          <i class="fa-solid fa-link"></i> Conectar Claude
        </button>
        <button v-if="user.canManage" :class="{ on: tab === 'users' }" @click="go('users')">
          <i class="fa-solid fa-users"></i> Personas
        </button>
      </nav>
      <div class="portal__me">
        <span>{{ user.email }}</span>
        <button @click="logout"><i class="fa-solid fa-right-from-bracket"></i> Salir</button>
      </div>
    </aside>

    <main class="portal__main">
      <McpConnect v-if="tab === 'connect'" :user="user" @updated="(u) => (user = u)" />
      <McpUsers v-else :me="user" />
    </main>
  </div>
</template>

<style scoped lang="scss">
.portal {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  background: #fbf9fc;

  &__loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    color: #490f57;
  }

  &__burger {
    display: none;
    position: fixed;
    top: 0.8rem;
    left: 0.8rem;
    z-index: 30;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    border: none;
    background: #490f57;
    color: #fff;
  }

  &__side {
    width: 250px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.4rem 1rem;
    background: linear-gradient(180deg, #2b0a35, #490f57);
    color: #f5eef7;

    nav { display: flex; flex-direction: column; gap: 0.3rem; }

    nav button {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.75rem 0.9rem;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;

      &:hover { background: rgba(255, 255, 255, 0.08); }
      &.on { background: #fff; color: #490f57; }
    }
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0 0.4rem;

    > i { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255, 255, 255, 0.12); }
    div { display: flex; flex-direction: column; }
    small { opacity: 0.7; }
  }

  &__me {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 0.4rem;
    font-size: 0.82rem;
    word-break: break-all;

    button { align-self: flex-start; background: none; border: 1px solid rgba(255, 255, 255, 0.3); color: inherit; padding: 0.4rem 0.7rem; border-radius: 8px; cursor: pointer; }
  }

  &__main {
    flex: 1;
    min-width: 0;
    padding: 2rem;
    overflow-y: auto;
  }

  @media (max-width: 800px) {
    &__burger { display: inline-flex; align-items: center; justify-content: center; }
    &__side { position: fixed; inset: 0 auto 0 0; z-index: 25; transform: translateX(-100%); transition: transform 0.25s; }
    &__side.open { transform: none; }
    &__main { padding: 4rem 1rem 1.5rem; }
  }
}
</style>
