<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { mcpService, type McpUser } from '@/services/mcp.service'

const props = defineProps<{ me: McpUser }>()

const users = ref<McpUser[]>([])
const loading = ref(true)
const error = ref('')
const form = reactive({ email: '', name: '', password: '', canManage: false })
const saving = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    users.value = await mcpService.users()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function add() {
  saving.value = true
  error.value = ''
  try {
    await mcpService.createUser({ ...form, email: form.email.trim() })
    Object.assign(form, { email: '', name: '', password: '', canManage: false })
    await load()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function patch(u: McpUser, body: Parameters<typeof mcpService.updateUser>[1]) {
  try {
    await mcpService.updateUser(u._id, body)
    await load()
  } catch (e) {
    alert((e as Error).message)
  }
}

async function resetPassword(u: McpUser) {
  const pwd = prompt(`Nueva contraseña para ${u.email} (mínimo 8 caracteres):`)
  if (pwd) await patch(u, { password: pwd })
}

async function remove(u: McpUser) {
  if (!confirm(`¿Quitar a ${u.email}? Pierde el acceso al instante, también en Claude.`)) return
  try {
    await mcpService.deleteUser(u._id)
    await load()
  } catch (e) {
    alert((e as Error).message)
  }
}

const when = (d: string | null) => (d ? new Date(d).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const isMe = (u: McpUser) => u._id === props.me._id
</script>

<template>
  <section class="users">
    <header>
      <h2>Personas con acceso</h2>
      <p>Quien esté aquí y activo puede entrar a este portal y conectar Claude con su propio link.</p>
    </header>

    <form class="users__add" @submit.prevent="add">
      <h3><i class="fa-solid fa-user-plus"></i> Agregar persona</h3>
      <div class="users__grid">
        <input v-model="form.email" type="email" required placeholder="correo@ejemplo.com" />
        <input v-model="form.name" type="text" placeholder="Nombre (opcional)" />
        <input v-model="form.password" type="text" required minlength="8" placeholder="Contraseña inicial (8+)" />
      </div>
      <label class="users__check">
        <input v-model="form.canManage" type="checkbox" /> Puede agregar y quitar personas
      </label>
      <button class="btn btn--primary" :disabled="saving">
        <i :class="saving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-plus'"></i> Agregar
      </button>
      <p class="users__help">Pásale su correo y contraseña; al entrar le llega un código a su correo.</p>
    </form>

    <p v-if="error" class="users__error"><i class="fa-solid fa-circle-exclamation"></i> {{ error }}</p>
    <p v-if="loading" class="users__muted"><i class="fa-solid fa-spinner fa-spin"></i> Cargando…</p>

    <ul v-else class="users__list">
      <li v-for="u in users" :key="u._id" :class="{ off: !u.active }">
        <div class="users__who">
          <strong>{{ u.name || u.email }}</strong>
          <span>{{ u.email }}</span>
          <small>Último ingreso: {{ when(u.lastLoginAt) }} · Último uso en Claude: {{ when(u.lastMcpAt) }}</small>
        </div>
        <div class="users__tags">
          <span class="tag" :class="u.active ? 'tag--ok' : 'tag--off'">{{ u.active ? 'Activo' : 'Desactivado' }}</span>
          <span v-if="u.canManage" class="tag tag--admin">Administra</span>
          <span v-if="isMe(u)" class="tag">Tú</span>
        </div>
        <div v-if="!isMe(u)" class="users__actions">
          <button @click="patch(u, { active: !u.active })">{{ u.active ? 'Desactivar' : 'Activar' }}</button>
          <button @click="patch(u, { canManage: !u.canManage })">{{ u.canManage ? 'Quitar admin' : 'Hacer admin' }}</button>
          <button @click="resetPassword(u)">Contraseña</button>
          <button @click="patch(u, { regenerateConnector: true })">Nuevo link</button>
          <button class="danger" @click="remove(u)"><i class="fa-solid fa-trash"></i> Quitar</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.users {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 900px;

  h2 { margin: 0 0 0.3rem; color: #490f57; }
  header p { margin: 0; color: #4b4453; }

  &__add {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.2rem;
    border-radius: 14px;
    border: 1px solid #eadcef;
    background: #faf5fb;

    h3 { margin: 0; font-size: 1rem; color: #2d2433; }
    input[type='email'], input[type='text'] { padding: 0.7rem 0.8rem; border: 1px solid #ddd3e3; border-radius: 10px; font-size: 0.95rem; }
    .btn { align-self: flex-start; }
  }

  &__grid { display: flex; flex-wrap: wrap; gap: 0.6rem; > * { flex: 1 1 200px; min-width: 0; } }
  &__check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.92rem; }
  &__help, &__muted { margin: 0; color: #6b6475; font-size: 0.85rem; }
  &__error { margin: 0; color: #b91c1c; font-weight: 500; }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      padding: 1rem;
      border: 1px solid #ece7ef;
      border-radius: 14px;
      background: #fff;

      &.off { opacity: 0.65; }
    }
  }

  &__who { flex: 1 1 260px; display: flex; flex-direction: column; gap: 0.15rem; min-width: 0;
    span { color: #4b4453; font-size: 0.9rem; }
    small { color: #8a8193; font-size: 0.78rem; }
  }

  &__tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;

    button {
      padding: 0.45rem 0.7rem;
      border-radius: 8px;
      border: 1px solid #ddd3e3;
      background: #fff;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;

      &.danger { color: #b91c1c; border-color: #fecaca; }
    }
  }
}

.tag {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #475569;

  &--ok { background: #dcfce7; color: #15803d; }
  &--off { background: #fee2e2; color: #b91c1c; }
  &--admin { background: #f3e8f5; color: #490f57; }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 1.1rem;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;

  &--primary { background: #490f57; color: #fff; }
}
</style>
