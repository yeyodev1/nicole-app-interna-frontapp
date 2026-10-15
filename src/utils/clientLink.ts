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

const isShippingLine = (name?: string) => /delivery|env[ií]o/i.test(String(name || ''))

/**
 * Mensaje para pegar en WhatsApp. Mismo texto que arma el backend al crear la
 * venta (`clientWhatsappMessage`), para reenviarlo desde el detalle del pedido.
 */
export function clientLinkMessage(order: any): string {
  const link = order?.clientLink || {}
  const name = String(link.buyer?.name || order?.customerName || '').trim().split(/\s+/)[0] || ''
  const items = (order?.products || [])
    .filter((p: any) => !isShippingLine(p.name))
    .map((p: any) => `• ${p.quantity} x ${p.name}`)
    .join('\n')
  const what = link.plannedType === 'delivery' ? 'la dirección de entrega (con el pin en el mapa)' : 'la tienda donde lo retiras'
  return [
    `¡Hola ${name}! Gracias por tu compra en Nicole Pastry Arts 💜`,
    '',
    `Recibimos tu pago de $${Number(order?.totalValue || 0).toFixed(2)}:`,
    items,
    '',
    `Ahora completa en este link ${what}, la fecha y hora, y tus datos si necesitas factura:`,
    clientLinkUrl(order),
    '',
    'Entregamos desde el día siguiente, de 11h00 a 19h00. El link vence en 7 días.'
  ].join('\n')
}

/**
 * Copia al portapapeles. Si el navegador no deja (http, permisos), usa un
 * textarea oculto. Devuelve false solo si ninguna de las dos funciona.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(area)
    return ok
  }
}
