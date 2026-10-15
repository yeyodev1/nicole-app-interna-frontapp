<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AppNotification } from '@/services/notification.service'
import { useNotifications } from '@/composables/useNotifications'

/**
 * Campana de avisos de la app (link del cliente completado, cliente que no llenó,
 * factura que necesita datos…). Se actualiza cada minuto y al volver a la pestaña.
 */
const props = withDefaults(defineProps<{ placement?: 'sidebar' | 'topbar' }>(), { placement: 'sidebar' })

const router = useRouter()
const isOpen = ref(false)
const { notifications, unread, isLoading, failed, refresh, markRead, markAllRead, soundOn, setSound } = useNotifications()

const toggle = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) refresh()
}

const open = async (n: AppNotification) => {
  await markRead(n)
  isOpen.value = false
  if (n.orderId) router.push({ name: 'order-detail', params: { id: n.orderId } })
}

const markAll = () => markAllRead()

const badge = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))

const iconFor = (type: string) => {
  if (type === 'WEB_ORDER_NEW') return 'fa-bag-shopping'
  if (type.includes('COMPLETED')) return 'fa-circle-check'
  if (type.includes('INVOICE')) return 'fa-file-invoice-dollar'
  if (type.includes('REMINDER') || type.includes('PENDING')) return 'fa-clock'
  return 'fa-bell'
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}
</script>

<template>
  <div class="notif" :class="`notif--${props.placement}`">
    <button
      type="button"
      class="bell"
      :aria-label="unread ? `Avisos: ${unread} sin leer` : 'Avisos'"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <i class="fa-solid fa-bell"></i>
      <span v-if="unread > 0" class="badge">{{ badge }}</span>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="notif-backdrop" @click="isOpen = false"></div>
      <div v-if="isOpen" class="notif-panel" :class="`notif-panel--${props.placement}`" role="dialog" aria-label="Avisos">
        <div class="panel-head">
          <strong>Avisos</strong>
          <button v-if="unread > 0" type="button" class="btn-all" @click="markAll">Marcar todo como leído</button>
        </div>
        <button
          type="button"
          class="sound-row"
          :class="{ on: soundOn }"
          :aria-pressed="soundOn"
          @click="setSound(!soundOn)"
        >
          <i class="fa-solid" :class="soundOn ? 'fa-volume-high' : 'fa-volume-xmark'"></i>
          <span>{{ soundOn ? 'Sonido de pedidos activado' : 'Sonido de pedidos apagado' }}</span>
          <span class="switch" aria-hidden="true"><span></span></span>
        </button>

        <div v-if="isLoading && !notifications.length" class="empty">Cargando…</div>
        <div v-else-if="failed && !notifications.length" class="empty">No se pudieron cargar los avisos.</div>
        <div v-else-if="!notifications.length" class="empty">
          <i class="fa-regular fa-bell-slash"></i>
          No tienes avisos.
        </div>

        <ul v-else class="list">
          <li v-for="n in notifications" :key="n._id" :class="{ unread: !n.readAt }">
            <button type="button" class="item" @click="open(n)">
              <i class="fa-solid item-icon" :class="iconFor(n.type)"></i>
              <span class="item-body">
                <span class="item-title">{{ n.title }}</span>
                <span class="item-msg">{{ n.message }}</span>
                <span class="item-time">{{ timeAgo(n.createdAt) }}</span>
              </span>
            </button>
            <button v-if="!n.readAt" type="button" class="btn-read" title="Marcar como leído" @click.stop="markRead(n)">
              <i class="fa-solid fa-check"></i>
            </button>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.notif {
  position: relative;
  display: inline-flex;
}

.bell {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: #f8fafc;
  color: #475569;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    color: $NICOLE-PURPLE;
  }
}

.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  line-height: 1;
}

.notif-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
}

.notif-panel {
  position: fixed;
  z-index: 901;
  width: 360px;
  max-width: calc(100vw - 16px);
  max-height: min(70vh, 560px);
  overflow-y: auto;
  background: white;
  border: 1px solid $border-light;
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);

  &--sidebar {
    top: 14px;
    left: 230px;
  }

  &--topbar {
    top: 58px;
    right: 8px;
  }
}

.sound-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border: none;
  border-bottom: 1px solid $border-light;
  background: #faf7fb;
  color: #64748b;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;

  span:nth-child(2) {
    flex: 1;
  }

  &.on {
    color: $NICOLE-PURPLE;
  }

  .switch {
    width: 34px;
    height: 20px;
    border-radius: 999px;
    background: #cbd5e1;
    position: relative;
    transition: background 0.15s ease;

    span {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      transition: transform 0.15s ease;
    }
  }

  &.on .switch {
    background: $NICOLE-PURPLE;

    span {
      transform: translateX(14px);
    }
  }
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid $border-light;
  position: sticky;
  top: 0;
  background: white;
}

.btn-all {
  border: none;
  background: none;
  color: $NICOLE-PURPLE;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
}

.empty {
  padding: 2rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: flex-start;
    border-bottom: 1px solid #f1f5f9;

    &.unread {
      background: rgba($NICOLE-PURPLE, 0.05);
    }
  }
}

.item {
  flex: 1;
  display: flex;
  gap: 0.7rem;
  padding: 0.8rem 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.item-icon {
  color: $NICOLE-PURPLE;
  margin-top: 3px;
}

.item-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.item-title {
  font-weight: 700;
  font-size: 0.88rem;
  color: #1e293b;
}

.item-msg {
  font-size: 0.82rem;
  color: #475569;
  line-height: 1.35;
}

.item-time {
  font-size: 0.72rem;
  color: #94a3b8;
}

.btn-read {
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.9rem 0.8rem;

  &:hover {
    color: #16a34a;
  }
}
</style>
