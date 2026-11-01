/**
 * Productos cuyo precio tecleado por el vendedor YA incluye IVA.
 *
 * Para el resto del catálogo el precio es la base y el 15% se suma encima. Para
 * estos el valor tecleado es lo que paga el cliente: el total del pedido no le
 * agrega nada. El backend factura la base hacia atrás (precio / 1.15) para que la
 * factura de Contífico cierre en ese mismo valor.
 *
 * Debe coincidir con `src/config/precio-final.config.ts` del backend.
 */

/** IDs de Contífico con precio IVA incluido. */
export const PRECIO_IVA_INCLUIDO_IDS = new Set([
  'O8bYJlo4iLmlyd7j', // Sucree · TORT-001 Torta Personalizada
])

/**
 * `true` si el precio del ítem ya trae el IVA dentro.
 * Cubre los IDs configurados y, por compatibilidad, cualquier ítem llamado "delivery".
 */
export function isPrecioIvaIncluido(item: { contifico_id?: string; id?: string; name?: string; nombre?: string }): boolean {
  const id = item.contifico_id || item.id
  if (id && PRECIO_IVA_INCLUIDO_IDS.has(id)) return true
  return String(item.name ?? item.nombre ?? '').toLowerCase().includes('delivery')
}

/**
 * Descuento (%) de una línea. Decisión de Nicole (30/10/2026): los descuentos se
 * calculan solo sobre los productos; el delivery se cobra completo siempre. La
 * cortesía (de la línea o del pedido entero) sigue regalando todo, envío incluido.
 * Debe coincidir con `lineDiscountPercent` de `src/config/precio-final.config.ts` del backend.
 */
export function lineDiscountPercent(
  item: { name?: string; isCourtesy?: boolean },
  opts: { globalDiscountPercentage?: number; isGlobalCourtesy?: boolean },
): number {
  if (item.isCourtesy || opts.isGlobalCourtesy) return 100
  const global = Number(opts.globalDiscountPercentage) || 0
  const name = String(item.name ?? '').toLowerCase()
  const isShipping = name.includes('delivery') || name.includes('envío') || name.includes('envio')
  if (global > 0 && !isShipping) return Math.min(global, 100)
  return 0
}
