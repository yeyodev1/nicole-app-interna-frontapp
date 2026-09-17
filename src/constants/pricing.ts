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
