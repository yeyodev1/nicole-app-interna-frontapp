/**
 * Estado visible del link de gestión de entrega de un pedido (contrato v8).
 * El backend guarda PENDING / COMPLETED; "vencido" sale de `expiresAt`.
 */
export type ClientLinkState = 'PENDING' | 'COMPLETED' | 'EXPIRED'

export function clientLinkState(order: any): ClientLinkState | null {
  const link = order?.clientLink
  if (!link?.token) return null
  if (link.status === 'COMPLETED') return 'COMPLETED'
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return 'EXPIRED'
  return 'PENDING'
}

/** Pedido cobrado que todavía espera que el cliente llene el link (sin fecha de entrega). */
export function isAwaitingClient(order: any): boolean {
  const state = clientLinkState(order)
  return state === 'PENDING' || state === 'EXPIRED'
}

export const CLIENT_LINK_LABELS: Record<ClientLinkState, string> = {
  PENDING: 'Pendiente del cliente',
  COMPLETED: 'Completado por el cliente',
  EXPIRED: 'Link vencido'
}

/** Texto para la fecha de entrega cuando todavía no la eligió el cliente. */
export const DATE_PENDING_LABEL = 'Por definir · cliente'

/** URL pública del link. El backend la devuelve al crear; aquí se arma para el detalle. */
export function clientLinkUrl(order: any): string {
  const token = order?.clientLink?.token
  if (!token) return ''
  if (order?.clientLinkUrl) return order.clientLinkUrl
  const base = ((import.meta.env.VITE_TIENDA_URL as string | undefined) || 'https://nicole.com.ec').replace(/\/+$/, '')
  return `${base}/pedido/${token}`
}
