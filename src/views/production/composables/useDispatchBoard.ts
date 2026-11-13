import { computed, type Ref } from 'vue'

/**
 * Despacho por local (Resumen de Producción).
 *
 * - Reposición (`salesChannel` = "Restock") de San Marino y Mall del Sol: se despacha
 *   aquí, por producto.
 * - Pedidos de clientes: solo se muestran; se despachan uno por uno en Órdenes.
 * - "Total a producir" es siempre lo PEDIDO; lo enviado de más o de menos se marca aparte.
 */

export interface LocalDef { key: string; label: string; icon: string; canSend: boolean }

export const LOCALS: LocalDef[] = [
  { key: 'San Marino', label: 'San Marino', icon: 'fa-store', canSend: true },
  { key: 'Mall del Sol', label: 'Mall del Sol', icon: 'fa-shopping-bag', canSend: true },
  { key: 'Delivery', label: 'Delivery', icon: 'fa-motorcycle', canSend: false },
  { key: 'Centro Prod.', label: 'Centro de producción', icon: 'fa-industry', canSend: false },
]

export type Reception = 'none' | 'wait' | 'ok' | 'diff'

/** Cifras de un producto en un local. */
export interface Cell {
  ordered: number        // pedido total (reposición + clientes)
  sent: number           // enviado total
  restockOrdered: number
  restockSent: number
  clientOrdered: number
  clientSent: number
  reception: Reception   // recepción de lo enviado de reposición (solo locales con POS)
  receptionDiff: number  // recibido − enviado (negativo = llegó menos)
}

export interface BoardProduct { name: string; cells: Record<string, Cell> }
export interface BoardCategory { name: string; products: BoardProduct[] }

const emptyCell = (): Cell => ({
  ordered: 0, sent: 0, restockOrdered: 0, restockSent: 0, clientOrdered: 0, clientSent: 0, reception: 'none', receptionDiff: 0,
})

export const isRestock = (o: any) => o?.salesChannel === 'Restock'

export function useDispatchBoard(
  orders: Ref<any[]>,
  destOf: (o: any) => string,
  categoryOf: (name: string, raw?: string) => string,
  categoryOrder: string[],
) {
  const data = computed(() => {
    const byProduct = new Map<string, { cat: string; cells: Record<string, Cell>; rcv: Record<string, { pending: boolean; any: boolean; diff: number }> }>()
    const extraLocals = new Set<string>()

    for (const order of orders.value) {
      const dest = destOf(order)
      if (!LOCALS.some(l => l.key === dest)) extraLocals.add(dest)
      const restock = isRestock(order)

      const sentById = new Map<string, number>()
      for (const d of order.dispatches || []) {
        for (const it of d.items || []) sentById.set(String(it.productId), (sentById.get(String(it.productId)) || 0) + (Number(it.quantitySent) || 0))
      }

      for (const p of order.products || []) {
        let row = byProduct.get(p.name)
        if (!row) {
          row = { cat: categoryOf(p.name, p.category), cells: {}, rcv: {} }
          byProduct.set(p.name, row)
        }
        const cell = (row.cells[dest] ||= emptyCell())
        const qty = Number(p.quantity) || 0
        const sent = sentById.get(String(p._id)) || 0
        cell.ordered += qty
        cell.sent += sent
        if (restock) {
          cell.restockOrdered += qty
          cell.restockSent += sent
          // Recepción en el local de lo enviado de reposición de este producto
          const r = (row.rcv[dest] ||= { pending: false, any: false, diff: 0 })
          for (const d of order.dispatches || []) {
            for (const it of d.items || []) {
              if (String(it.productId) !== String(p._id)) continue
              r.any = true
              if (!d.receptionStatus || d.receptionStatus === 'PENDING') r.pending = true
              else r.diff += (Number(it.quantityReceived ?? it.quantitySent) || 0) - (Number(it.quantitySent) || 0)
            }
          }
        } else {
          cell.clientOrdered += qty
          cell.clientSent += sent
        }
      }
    }

    for (const row of byProduct.values()) {
      for (const [dest, r] of Object.entries(row.rcv)) {
        const cell = row.cells[dest]!
        if (!r.any) continue
        cell.reception = r.pending ? 'wait' : r.diff !== 0 ? 'diff' : 'ok'
        cell.receptionDiff = r.diff
      }
    }

    const cats = new Map<string, BoardProduct[]>()
    for (const [name, row] of byProduct) {
      if (!cats.has(row.cat)) cats.set(row.cat, [])
      cats.get(row.cat)!.push({ name, cells: row.cells })
    }
    const categories: BoardCategory[] = Array.from(cats.entries())
      .sort(([a], [b]) => {
        const ia = categoryOrder.indexOf(a), ib = categoryOrder.indexOf(b)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return a.localeCompare(b)
      })
      .map(([name, products]) => ({ name, products: products.sort((a, b) => a.name.localeCompare(b.name)) }))

    const locals: LocalDef[] = [
      ...LOCALS,
      ...Array.from(extraLocals).map(key => ({ key, label: key, icon: 'fa-map-marker-alt', canSend: false })),
    ]
    return { categories, locals }
  })

  const cellOf = (p: BoardProduct, local: string): Cell => p.cells[local] || emptyCell()
  const pendingOf = (p: BoardProduct, local: string) => Math.max(0, cellOf(p, local).ordered - cellOf(p, local).sent)
  const restockPendingOf = (p: BoardProduct, local: string) => {
    const c = cellOf(p, local)
    return Math.max(0, c.restockOrdered - c.restockSent)
  }
  const orderedAll = (p: BoardProduct) => Object.values(p.cells).reduce((s, c) => s + c.ordered, 0)
  const sentAll = (p: BoardProduct) => Object.values(p.cells).reduce((s, c) => s + c.sent, 0)
  const pendingAll = (p: BoardProduct) => data.value.locals.reduce((s, l) => s + pendingOf(p, l.key), 0)
  const localPending = (local: string) =>
    data.value.categories.reduce((s, c) => s + c.products.reduce((t, p) => t + pendingOf(p, local), 0), 0)
  const totalPending = computed(() => data.value.locals.reduce((s, l) => s + localPending(l.key), 0))

  return {
    categories: computed(() => data.value.categories),
    locals: computed(() => data.value.locals),
    cellOf, pendingOf, restockPendingOf, orderedAll, sentAll, pendingAll, localPending, totalPending,
  }
}
