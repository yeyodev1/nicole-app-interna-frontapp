// @ts-ignore
import XLSX from 'xlsx-js-style'

/**
 * Formato común de los Excel que exporta la app (aprobado por Operaciones,
 * 11/11/2026, a partir de la Orden de Despacho): título morado, encabezados
 * oscuros, filas de categoría lila, totales oscuros y bordes grises finos.
 * Solo es apariencia: no cambia qué datos lleva cada archivo.
 */
export const XL = {
  PURPLE: '6D28D9',
  PURPLE_SOFT: 'F3E8FF',
  INK: '1E293B',
  TEXT: '1E293B',
  MUTED: '64748B',
  LINE: 'D9DEE7',
  TOTAL_SOFT: 'EEF2F7',
  WHITE: 'FFFFFF',
  AMBER: 'B45309',
  AMBER_SOFT: 'FFFBEB',
  RED: 'B91C1C',
} as const

const thin = { style: 'thin', color: { rgb: XL.LINE } }
export const xlBox = { top: thin, bottom: thin, left: thin, right: thin }

type Align = 'left' | 'center' | 'right'

export const xlStyle = {
  /** Barra de título (fila 1). */
  title: () => ({
    font: { bold: true, sz: 14, color: { rgb: XL.WHITE } },
    fill: { fgColor: { rgb: XL.PURPLE } },
    alignment: { vertical: 'center', indent: 1 },
  }),
  /** Línea de explicación bajo el título. */
  subtitle: () => ({
    font: { italic: true, sz: 10, color: { rgb: XL.MUTED } },
    alignment: { vertical: 'center', indent: 1 },
  }),
  /** Encabezado de columnas. */
  header: (h: Align = 'center') => ({
    font: { bold: true, sz: 10, color: { rgb: XL.WHITE } },
    fill: { fgColor: { rgb: XL.INK } },
    alignment: { horizontal: h, vertical: 'center', wrapText: true },
    border: xlBox,
  }),
  /** Fila de categoría o grupo. */
  category: (h: Align = 'left') => ({
    font: { bold: true, sz: 10, color: { rgb: XL.PURPLE } },
    fill: { fgColor: { rgb: XL.PURPLE_SOFT } },
    alignment: { horizontal: h, vertical: 'center', indent: h === 'left' ? 1 : 0 },
    border: xlBox,
  }),
  /** Celda normal del cuerpo. */
  cell: (h: Align = 'left', extra: { bold?: boolean; color?: string; fill?: string; italic?: boolean } = {}) => ({
    font: { sz: 10, bold: !!extra.bold, italic: !!extra.italic, color: { rgb: extra.color || XL.TEXT } },
    ...(extra.fill ? { fill: { fgColor: { rgb: extra.fill } } } : {}),
    alignment: { horizontal: h, vertical: 'center', indent: h === 'left' ? 1 : 0 },
    border: xlBox,
  }),
  /** Fila de totales. */
  total: (h: Align = 'left') => ({
    font: { bold: true, sz: 11, color: { rgb: XL.WHITE } },
    fill: { fgColor: { rgb: XL.INK } },
    alignment: { horizontal: h, vertical: 'center', indent: h === 'left' ? 1 : 0 },
    border: xlBox,
  }),
}

/**
 * Aplica el formato común a una tabla simple (encabezado en `headerRow`,
 * datos debajo). Conserva el formato de número (`z`) de cada celda.
 * `numericCols` se alinean a la derecha; `boldCols` van en negrita.
 */
export function styleSimpleTable(
  ws: any,
  opts: { headerRow?: number; numericCols?: number[]; boldCols?: number[]; totalRows?: number[] } = {}
) {
  if (!ws?.['!ref']) return
  const headerRow = opts.headerRow ?? 0
  const numeric = new Set(opts.numericCols || [])
  const bold = new Set(opts.boldCols || [])
  const totals = new Set(opts.totalRows || [])
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let r = headerRow; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      const h: Align = numeric.has(c) ? 'right' : 'left'
      ws[ref].s = r === headerRow
        ? xlStyle.header('center')
        : totals.has(r)
          ? xlStyle.total(h)
          : xlStyle.cell(h, { bold: bold.has(c) })
    }
  }
  const rows = ws['!rows'] || []
  rows[headerRow] = { hpt: 24 }
  ws['!rows'] = Array.from({ length: range.e.r + 1 }, (_, i) => rows[i] ?? {})
}
