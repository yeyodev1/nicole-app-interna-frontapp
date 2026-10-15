import { onMounted, onUnmounted, ref } from 'vue'
import NotificationService, { type AppNotification } from '@/services/notification.service'
import { playOrderAlert, unlockAlertSound } from '@/utils/alertSound'

/**
 * Avisos de la app compartidos por todas las campanas (sidebar y barra móvil):
 * una sola consulta cada 20 s y al volver a la pestaña. Cuando llega un aviso
 * nuevo de pedido suena una alarma fuerte (se puede silenciar desde la campana)
 * y, si el navegador lo permite, sale una notificación del sistema.
 */

const POLL_MS = 20_000
const SOUND_KEY = 'nicole_alert_sound'
// Tipos que significan "llegó un pedido" (los recordatorios no suenan).
const ALERT_TYPES = new Set(['WEB_ORDER_NEW', 'CLIENT_LINK_COMPLETED'])

const readSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}
const soundOn = ref(readSound())
const seenIds = new Set<string>()
let firstLoad = true

const setSound = (on: boolean) => {
  soundOn.value = on
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Sin almacenamiento: queda solo en esta sesión.
  }
  if (on) {
    unlockAlertSound()
    playOrderAlert()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }
}

const announce = (fresh: AppNotification[]) => {
  if (!fresh.length) return
  if (soundOn.value) playOrderAlert()
  if ('Notification' in window && Notification.permission === 'granted') {
    const first = fresh[0]!
    try {
      new Notification(first.title, { body: first.message, tag: first._id })
    } catch {
      // Algunos navegadores solo permiten notificaciones desde un service worker.
    }
  }
}

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
      // Solo suena lo que llegó después de abrir la app, no lo que ya estaba.
      const fresh = notifications.value.filter(n => !seenIds.has(n._id) && !n.readAt && ALERT_TYPES.has(n.type))
      notifications.value.forEach(n => seenIds.add(n._id))
      if (!firstLoad) announce(fresh)
      firstLoad = false
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
      timer = setInterval(refresh, POLL_MS)
      window.addEventListener('pointerdown', unlockAlertSound, { once: true })
      window.addEventListener('keydown', unlockAlertSound, { once: true })
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

  return { notifications, unread, isLoading, failed, refresh, markRead, markAllRead, soundOn, setSound }
}
