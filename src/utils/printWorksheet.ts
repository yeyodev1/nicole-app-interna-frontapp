// @ts-ignore
import XLSX from 'xlsx-js-style'

/**
 * "PDF para imprimir": imprime la MISMA hoja que se exporta a Excel (mismos colores, bloques y
 * celdas combinadas), ajustada al ancho de la hoja y en una sola página. Elige vertical u
 * horizontal según lo que deje la letra más grande. Usa la impresión del navegador (iframe
 * oculto): desde ahí se imprime o se "Guarda como PDF".
 */

const MM = 96 / 25.4 // px por milímetro
const MARGIN_MM = 8
const PAGE = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } }

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const hex = (rgb?: string) => (rgb && /^[0-9a-f]{6,8}$/i.test(rgb) ? `#${rgb.slice(-6)}` : '')

function cellCss(s: any): string {
  if (!s) return ''
  const css: string[] = []
  const f = s.font || {}
  if (f.bold) css.push('font-weight:700')
  if (f.italic) css.push('font-style:italic')
  if (f.sz) css.push(`font-size:${Number(f.sz)}pt`)
  if (hex(f.color?.rgb)) css.push(`color:${hex(f.color.rgb)}`)
  const bg = hex(s.fill?.fgColor?.rgb)
  if (bg) css.push(`background:${bg}`)
  const a = s.alignment || {}
  if (a.horizontal) css.push(`text-align:${a.horizontal}`)
  if (a.vertical === 'top') css.push('vertical-align:top')
  css.push(a.wrapText ? 'white-space:pre-line' : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis')
  if (a.indent) css.push(`padding-left:${4 + Number(a.indent) * 7}px`)
  const b = s.border
  if (b) {
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      if (b[side]) css.push(`border-${side}:1px solid ${hex(b[side].color?.rgb) || '#D9DEE7'}`)
    }
  }
  return css.join(';')
}

/** Convierte la hoja (xlsx-js-style) en una tabla HTML con sus estilos. Exportado para probarlo. */
export function worksheetToHtml(ws: any): { html: string; width: number } {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const cols: any[] = ws['!cols'] || []
  const rows: any[] = ws['!rows'] || []
  const widths = Array.from({ length: range.e.c + 1 }, (_, c) => Math.round((cols[c]?.wch ?? 10) * 7 + 6))

  const span = new Map<string, { rs: number; cs: number }>()
  const covered = new Set<string>()
  for (const m of ws['!merges'] || []) {
    span.set(`${m.s.r}:${m.s.c}`, { rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 })
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) covered.add(`${r}:${c}`)
  }

  let body = ''
  for (let r = range.s.r; r <= range.e.r; r++) {
    const h = rows[r]?.hpt ? `height:${rows[r].hpt}pt` : 'height:15pt'
    let tr = ''
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (covered.has(`${r}:${c}`)) continue
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      const sp = span.get(`${r}:${c}`)
      const attrs = sp ? `${sp.rs > 1 ? ` rowspan="${sp.rs}"` : ''}${sp.cs > 1 ? ` colspan="${sp.cs}"` : ''}` : ''
      const v = cell?.v ?? ''
      tr += `<td${attrs} style="${cellCss(cell?.s)}">${esc(v)}</td>`
    }
    body += `<tr style="${h}">${tr}</tr>`
  }
  const width = widths.reduce((s, w) => s + w, 0)
  const colgroup = `<colgroup>${widths.map(w => `<col style="width:${w}px">`).join('')}</colgroup>`
  return { html: `<table id="sheet" style="width:${width}px">${colgroup}<tbody>${body}</tbody></table>`, width }
}

export function printWorksheet(ws: any, title: string): void {
  const { html } = worksheetToHtml(ws)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  // Fuera de pantalla pero con tamaño, para poder medir la tabla antes de imprimir.
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1400px;height:1000px;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  const doc = iframe.contentDocument || win?.document
  if (!doc || !win) {
    iframe.remove()
    throw new Error('El navegador no permitió abrir la impresión.')
  }
  doc.open()
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style id="page"></style>
<style>
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Calibri, Carlito, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; font-size: 11pt; }
table { border-collapse: collapse; table-layout: fixed; }
td { padding: 1px 4px; vertical-align: middle; overflow: hidden; line-height: 1.15; }
</style></head><body>${html}</body></html>`)
  doc.close()

  // Una sola hoja, ajustada al ancho: se mide la tabla y se escala para que entre completa,
  // en la orientación que deje la letra más grande.
  const table = doc.getElementById('sheet') as HTMLElement | null
  const W = table?.offsetWidth || 1
  const H = table?.offsetHeight || 1
  const fit = (o: 'portrait' | 'landscape') => {
    const pw = (PAGE[o].w - 2 * MARGIN_MM) * MM
    const ph = (PAGE[o].h - 2 * MARGIN_MM) * MM
    return Math.min(pw / W, ph / H) * 0.98
  }
  const orientation = fit('portrait') >= fit('landscape') ? 'portrait' : 'landscape'
  const scale = fit(orientation)
  const pageCss = doc.getElementById('page')
  if (pageCss) pageCss.textContent = `@page { size: A4 ${orientation}; margin: ${MARGIN_MM}mm; }`
  if (table) (table.style as any).zoom = String(scale)

  let removed = false
  const cleanup = () => {
    if (removed) return
    removed = true
    setTimeout(() => iframe.remove(), 500)
  }
  win.addEventListener('afterprint', cleanup)
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(cleanup, 60000)
  }, 250)
}
