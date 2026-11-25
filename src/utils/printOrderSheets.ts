/**
 * PDF para imprimir de una: Orden de Entrega / Orden de Producción en A4 vertical,
 * una hoja por sucursal/destino (productos por categoría, cantidad, casilla para marcar y firmas).
 * Usa la impresión del navegador (iframe oculto): desde ahí se imprime o se "Guarda como PDF".
 */

export interface PrintSheetsOptions {
  mode: 'dispatch' | 'production'
  orders: any[]
  /** Destino de cada pedido (mismos nombres que el modal: San Marino, Mall del Sol, Delivery…). */
  destOf: (order: any) => string
  /** Orden de las hojas; los destinos que no estén aquí van al final. */
  destinationOrder: string[]
  /** Categoría de Contífico por nombre normalizado de producto. */
  categoryByName?: Record<string, string>
  /** 'all' o AAAA-MM-DD */
  date: string
  responsibleName?: string
}

const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const CAT_ORDER = ['TORTAS', 'CAKES ENTEROS', 'TORTAS ENTERAS', 'CAKES PORCION', 'TORTAS PORCIÓN', 'INDIVIDUAL', 'JOYITAS', 'PANADERIA', 'PANADERÍA', 'BOLLERÍA', 'TOSTADAS', 'GALLETERÍA', 'HELADERIA', 'HELADERÍA', 'VEGETALES', 'SIROPES']
const catRank = (c: string) => (c === 'OTROS' ? 999 : CAT_ORDER.indexOf(c) === -1 ? 500 : CAT_ORDER.indexOf(c))

interface Sheet {
  dest: string
  categories: Array<{ name: string; items: Array<{ name: string; qty: number }> }>
  total: number
}

/** Arma una hoja por destino con los productos sumados. Exportado para poder probarlo. */
export function buildSheets(opts: Pick<PrintSheetsOptions, 'orders' | 'destOf' | 'destinationOrder' | 'categoryByName'>): Sheet[] {
  const catLabel = (name: string, raw?: string) => {
    const c = (opts.categoryByName?.[normName(name)] || raw || '').replace(/\.+$/, '').trim()
    return c ? c.toUpperCase() : 'OTROS'
  }
  const byDest = new Map<string, Map<string, { name: string; category: string; qty: number }>>()
  for (const o of opts.orders) {
    const dest = opts.destOf(o)
    for (const p of o.products || []) {
      const name = String(p?.name || '').trim()
      const qty = Number(p?.quantity) || 0
      if (!name || qty <= 0 || normName(name) === 'delivery') continue
      if (!byDest.has(dest)) byDest.set(dest, new Map())
      const rows = byDest.get(dest)!
      const k = normName(name)
      const row = rows.get(k) || { name, category: catLabel(name, p.category), qty: 0 }
      row.qty += qty
      rows.set(k, row)
    }
  }
  const rank = (d: string) => {
    const i = opts.destinationOrder.indexOf(d)
    return i === -1 ? 999 : i
  }
  return Array.from(byDest.keys())
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(dest => {
      const rows = Array.from(byDest.get(dest)!.values())
      const cats = Array.from(new Set(rows.map(r => r.category))).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b))
      return {
        dest,
        categories: cats.map(c => ({
          name: c,
          items: rows.filter(r => r.category === c).sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ name: r.name, qty: r.qty })),
        })),
        total: rows.reduce((s, r) => s + r.qty, 0),
      }
    })
}

function buildHtml(opts: PrintSheetsOptions, sheets: Sheet[]): string {
  const title = opts.mode === 'production' ? 'Orden de Producción' : 'Orden de Entrega'
  const check = opts.mode === 'production' ? 'Hecho ✓' : 'Recibido ✓'
  const dateLabel =
    opts.date === 'all'
      ? 'Todas las fechas'
      : new Date(`${opts.date}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const printed = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const signLeft = opts.mode === 'production' ? 'Responsable' : 'Despacha'
  const signRight = opts.mode === 'production' ? 'Revisa' : 'Recibe'

  const pages = sheets
    .map((s, ix) => {
      const body = s.categories
        .map(
          c =>
            `<tr class="cat"><td colspan="3">${esc(c.name)}</td></tr>` +
            c.items.map(i => `<tr><td>${esc(i.name)}</td><td class="q">${i.qty}</td><td class="ck"></td></tr>`).join(''),
        )
        .join('')
      return `<section class="page">
  <header>
    <div><h1>${title}</h1><div class="dest">${esc(s.dest)}</div></div>
    <div class="meta">Entrega: <b>${esc(dateLabel)}</b><br>Impreso: ${esc(printed)}${opts.mode === 'production' && opts.responsibleName ? `<br>Responsable: ${esc(opts.responsibleName)}` : ''}</div>
  </header>
  <table>
    <thead><tr><th>Producto</th><th class="c">Cantidad</th><th class="c">${check}</th></tr></thead>
    <tbody>${body}<tr class="tot"><td>Total</td><td class="q">${s.total}</td><td></td></tr></tbody>
  </table>
  <div class="sign"><div>${signLeft}</div><div>${signRight}</div></div>
  <div class="foot">Hoja ${ix + 1} de ${sheets.length}</div>
</section>`
    })
    .join('')

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11pt; background: #fff; }
.page { display: flex; flex-direction: column; min-height: 270mm; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
h1 { margin: 0; font-size: 15pt; }
.dest { font-size: 22pt; font-weight: 800; margin-top: 2px; }
.meta { text-align: right; color: #334155; font-size: 10pt; line-height: 1.5; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; break-inside: avoid; }
th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; border: 1px solid #94a3b8; }
th.c { text-align: center; }
td { padding: 6px 8px; border: 1px solid #94a3b8; }
td.q { text-align: center; font-weight: 800; font-size: 12pt; width: 80px; }
td.ck { width: 90px; }
tr.cat td { background: #f8fafc; font-weight: 800; font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; }
tr.tot td { font-weight: 800; background: #f1f5f9; }
.sign { margin-top: auto; display: flex; gap: 40px; padding-top: 48px; }
.sign div { flex: 1; border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; color: #334155; font-size: 10pt; }
.foot { text-align: center; color: #64748b; font-size: 8.5pt; margin-top: 10px; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${pages}</body></html>`
}

/** Abre la ventana de impresión con una hoja por destino. Devuelve cuántas hojas salieron. */
export function printOrderSheets(opts: PrintSheetsOptions): number {
  const sheets = buildSheets(opts)
  if (!sheets.length) return 0

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc || !iframe.contentWindow) {
    iframe.remove()
    throw new Error('El navegador no permitió abrir la impresión.')
  }
  doc.open()
  doc.write(buildHtml(opts, sheets))
  doc.close()

  const win = iframe.contentWindow
  let removed = false
  const cleanup = () => {
    if (removed) return
    removed = true
    setTimeout(() => iframe.remove(), 500)
  }
  win.addEventListener('afterprint', cleanup)
  // Se espera un momento a que el documento termine de pintarse antes de imprimir.
  setTimeout(() => {
    win.focus()
    win.print()
    // Por si el navegador no avisa "afterprint": se limpia igual después de un rato.
    setTimeout(cleanup, 60000)
  }, 250)
  return sheets.length
}
