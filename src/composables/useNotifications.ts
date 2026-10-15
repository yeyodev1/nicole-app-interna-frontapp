import { onMounted, onUnmounted, ref } from 'vue'
import NotificationService, { type AppNotification } from '@/services/notification.service'

/**
 * Avisos de la app compartidos por todas las campanas (sidebar y barra móvil):
 * una sola consulta cada minuto y al volver a la pestaña.
 */

const notifications = ref<AppNotification[]>([])
const unread = ref(0)
const isLoading = ref(false)
const failed = ref(false)

let inFlight: Promise<void> | null = null
let timer: ReturnType<typeof setInterval> | null = null
let subscribers = 0

const refresh = (): Promise<void> => {
  if (!localStorage.getItem('access_token')) return Promise.resolve()
  if (inFlight) return inFlight
  isLoading.value = true
  inFlight = NotificationService.list(30)
    .then((data) => {
      notifications.value = data.notifications || []
      unread.value = data.unread ?? notifications.value.filter(n => !n.readAt).length
      failed.value = false
    })
    .catch(() => {
      // Silencioso: la campana no debe romper la app si el endpoint falla.
      failed.value = true
    })
    .finally(() => {
      isLoading.value = false
      inFlight = null
    })
  return inFlight
}

const onFocus = () => refresh()
const onVisibility = () => {
  if (document.visibilityState === 'visible') refresh()
}

const markRead = async (n: AppNotification) => {
  if (n.readAt) return
  n.readAt = new Date().toISOString()
  unread.value = Math.max(0, unread.value - 1)
  try {
    await NotificationService.markRead(n._id)
  } catch {
    // Se corrige en la próxima consulta.
  }
}

const markAllRead = async () => {
  notifications.value.forEach(n => { if (!n.readAt) n.readAt = new Date().toISOString() })
  unread.value = 0
  try {
    await NotificationService.markAllRead()
  } catch {
    refresh()
  }
}

export function useNotifications() {
  onMounted(() => {
    subscribers++
    if (subscribers === 1) {
      refresh()
      timer = setInterval(refresh, 60_000)
      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onVisibility)
    }
  })

  onUnmounted(() => {
    subscribers--
    if (subscribers === 0) {
      if (timer) clearInterval(timer)
      timer = null
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })

  return { notifications, unread, isLoading, failed, refresh, markRead, markAllRead }
}
