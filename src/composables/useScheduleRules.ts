import { computed, ref } from 'vue'
import axios from 'axios'
import { getECTTodayString } from '@/utils/dateUtils'

/**
 * Regla de fechas de entrega. Es la misma de la tienda web y del link del cliente:
 * se configura en el admin de la web (Ajustes → Días de anticipación y horarios).
 *
 * - Nada para el mismo día: la fecha más temprana es hoy + `minLeadDays`.
 * - Solo los horarios configurados (por defecto 11h00 a 18h00).
 *
 * Si la tienda no responde se usan los valores por defecto, para no bloquear la venta.
 */

const DEFAULT_MIN_LEAD_DAYS = 1
const DEFAULT_SLOTS = ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

interface TiendaSettings {
  minLeadDays?: number
  timeSlots?: string[]
  closedWeekdays?: number[]
}

// Singleton de módulo: la tienda se consulta una sola vez por sesión.
const _settings = ref<TiendaSettings | null>(null)
let _loading: Promise<void> | null = null

function settingsUrl(): string | null {
  const raw = (import.meta.env.VITE_TIENDA_API as string | undefined) || ''
  if (!raw) return null
  const trimmed = raw.replace(/\/+$/, '')
  const base = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
  return `${base}/settings/public`
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + days))
  return date.toISOString().slice(0, 10)
}

export function useScheduleRules() {
  const load = () => {
    if (_settings.value || _loading) return _loading ?? Promise.resolve()
    const url = settingsUrl()
    if (!url) {
      _settings.value = {}
      return Promise.resolve()
    }
    _loading = axios
      .get<TiendaSettings>(url, { timeout: 8000 })
      .then((res) => {
        _settings.value = res.data || {}
      })
      .catch((e) => {
        console.warn('No se pudo leer la regla de fechas de la tienda, uso la regla por defecto.', e)
        _settings.value = {}
      })
      .finally(() => {
        _loading = null
      })
    return _loading
  }

  const minLeadDays = computed(() => {
    const value = _settings.value?.minLeadDays
    return typeof value === 'number' && value >= 0 ? value : DEFAULT_MIN_LEAD_DAYS
  })

  const timeSlots = computed(() => {
    const slots = _settings.value?.timeSlots
    return slots && slots.length ? [...slots].sort() : DEFAULT_SLOTS
  })

  const closedWeekdays = computed(() => _settings.value?.closedWeekdays ?? [])

  /** Primer día que se puede elegir, YYYY-MM-DD en hora de Ecuador. */
  const minDate = computed(() => addDays(getECTTodayString(), minLeadDays.value))

  /** Texto para el asesor, igual de claro que el que ve el cliente. */
  const ruleText = computed(() => {
    const first = timeSlots.value[0]?.replace(':', 'h') ?? '11h00'
    const last = timeSlots.value[timeSlots.value.length - 1]?.replace(':', 'h') ?? '18h00'
    if (minLeadDays.value === 0) return `Entregas entre ${first} y ${last}.`
    const desde = minLeadDays.value === 1 ? 'desde mañana' : `con ${minLeadDays.value} días de anticipación`
    return `No hacemos entregas el mismo día: ${desde}, entre ${first} y ${last}.`
  })

  /** Mensaje de error si la fecha/hora elegida rompe la regla, o null. */
  const validate = (date?: string, time?: string): string | null => {
    if (!date) return null
    if (date < minDate.value) return ruleText.value
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    if (closedWeekdays.value.includes(weekday)) return 'Ese día no hacemos entregas. Elige otra fecha.'
    if (time && !timeSlots.value.includes(time)) return `Elige un horario entre ${timeSlots.value[0]} y ${timeSlots.value[timeSlots.value.length - 1]}.`
    return null
  }

  return { load, minLeadDays, timeSlots, minDate, ruleText, validate }
}
