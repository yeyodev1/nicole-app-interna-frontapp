/** Reglas y textos del seguimiento de reservas sin pago. El backend las vuelve a validar. */

export type ReservaState = 'pending' | 'contacted' | 'managed' | 'discarded' | 'voided'
export type ReservaFilter = 'pending' | 'contacted' | 'managed' | 'discarded' | 'all'
export type ReservaCounts = Record<ReservaFilter, number>

export const RESERVA_FILTERS: Array<{ key: ReservaFilter; label: string }> = [
  { key: 'pending', label: 'Por contactar' },
  { key: 'contacted', label: 'Contactadas' },
  { key: 'managed', label: 'Gestionadas' },
  { key: 'discarded', label: 'Descartadas' },
  { key: 'all', label: 'Todas' }
]

export const EMPTY_MESSAGES: Record<ReservaFilter, string> = {
  pending: 'No hay reservas esperando un primer contacto.',
  contacted: 'Aquí aparecen las reservas ya contactadas que todavía no pagan.',
  managed: 'Aquí aparecen las reservas pagadas.',
  discarded: 'Aquí aparecen las reservas de clientes que no compraron.',
  all: 'Todavía no hay reservas.'
}

export const STATE_META: Record<ReservaState, { label: string; tone: string; icon: string }> = {
  pending: { label: 'Por contactar', tone: 'warn', icon: 'fa-phone' },
  contacted: { label: 'Contactada', tone: 'info', icon: 'fa-comments' },
  managed: { label: 'Gestionada', tone: 'ok', icon: 'fa-check' },
  discarded: { label: 'Descartada', tone: 'muted', icon: 'fa-box-archive' },
  voided: { label: 'Anulada', tone: 'muted', icon: 'fa-ban' }
}

export const DISCARD_REASONS = [
  { value: 'no_response', label: 'No respondió' },
  { value: 'not_interested', label: 'No le interesó' },
  { value: 'duplicate', label: 'Duplicada' },
  { value: 'other', label: 'Otro' }
]

export const discardReasonLabel = (value?: string) =>
  DISCARD_REASONS.find(reason => reason.value === value)?.label

export const hasPayment = (order: any): boolean =>
  (order.payments || []).length > 0 ||
  order.webOrder?.paymentStatus === 'PAID' ||
  order.settledInIsland === true

export function reservaState(order: any): ReservaState {
  if (order.webOrder?.discard?.at) return 'discarded'
  if (order.status !== 'PENDIENTE_GESTION') return 'managed'
  if (order.voidedAt || order.productionStage === 'VOID') return 'voided'
  return (order.webOrder?.contactLog || []).length > 0 || hasPayment(order) ? 'contacted' : 'pending'
}

export function canDiscard(order: any): boolean {
  const state = reservaState(order)
  return (
    (state === 'pending' || state === 'contacted') &&
    !hasPayment(order) &&
    !order.webOrder?.paymentProofUrl &&
    ['PENDING', 'DELAYED'].includes(order.productionStage)
  )
}

const TIME_ZONE = 'America/Guayaquil'
const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })

/** "14:32" si fue hoy; si no, "2 nov, 14:32". */
export function formatContactTime(value: string): string {
  const date = new Date(value)
  const time = date.toLocaleTimeString('es-EC', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })
  if (dayKey(date) === dayKey(new Date())) return time
  const day = date.toLocaleDateString('es-EC', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' }).replace('.', '')
  return `${day}, ${time}`
}

export function daysWaiting(value: string): number {
  return Math.max(0, Math.round((Date.parse(dayKey(new Date())) - Date.parse(dayKey(new Date(value)))) / 86400000))
}

export function waitingLabel(value: string): string {
  const days = daysWaiting(value)
  if (days === 0) return 'Reservó hoy'
  return days === 1 ? 'Reservó ayer' : `Reservó hace ${days} días`
}

/** "0991234567" → "593991234567" para wa.me. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('593')) return digits
  return digits.startsWith('0') ? `593${digits.slice(1)}` : digits
}
