import { ref } from 'vue'
// @ts-ignore
import XLSX from 'xlsx-js-style'
import { formatECT } from '@/utils/dateUtils'
import type { DailyFormData } from '@/services/pos-restock.service'

export function useOrderExport() {
  const isExporting = ref(false)

  // --- Helpers ---
  const saveExcelFile = (workbook: XLSX.WorkBook, filename: string) => {
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  }

  // Categoría tal cual Contífico cuando el mapa está disponible
  const normName = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  // --- Production Export (Pivot format: Category × Destination/Round) ---
  const exportProductionOrder = async (
    orders: any[],
    responsibleName: string,
    categoryByName?: Record<string, string>
  ) => {
    isExporting.value = true
    try {
      // ── Colors ─────────────────────────────────────────────────────
      const C_TITLE_BG   = 'BF8B00'  // dark amber — title row
      const C_HEADER_BG  = 'FFC107'  // amber — column header row
      const C_CAT_BG     = 'FFF3E0'  // light amber — category rows
      const C_TOTAL_BG   = 'E65100'  // deep orange — totals row
      const C_EVEN       = 'FFFFFF'
      const C_ODD        = 'FAFAFA'
      const C_BORDER     = 'DDDDDD'
      const C_CAT_BORDER = 'FFA726'

      // ── 1. Category mapping ─────────────────────────────────────────
      const mapCategory = (productName: string, rawCategory?: string): string => {
        if (rawCategory) {
          const c = rawCategory.toUpperCase()
          if (c.includes('ENTERO') || c.includes('TORTA'))   return 'TORTAS'
          if (c.includes('PORCION') || c.includes('PORCIÓN')) return 'TORTAS PORCIÓN'
          if (c.includes('INDIVIDUAL') || c.includes('JOYITA')) return 'JOYITAS'
          if (c.includes('PANADER') || c.includes('BOLLERÍA') || c.includes('BOLLERIA')) return 'BOLLERÍA'
          if (c.includes('GALLETA') || c.includes('COOKIE') || c.includes('GALLAT')) return 'GALLETERÍA'
          if (c.includes('SIROPE') || c.includes('SYRUP'))   return 'SIROPES'
          if (c.includes('VEGETAL') || c.includes('FRUTA'))  return 'VEGETALES'
          if (c.includes('HELAD') || c.includes('GIANDUJA')) return 'HELADERÍA'
        }
        const n = productName.toUpperCase()
        if (n.includes('TORTA') || n.includes('CAKE'))                         return 'TORTAS'
        if (n.includes('PORCION') || n.includes('PORCIÓN'))                    return 'TORTAS PORCIÓN'
        if (n.includes('JOYITA') || n.includes('MINI CAKE'))                   return 'JOYITAS'
        if (n.includes('BRIOCHE') || n.includes('CROISSANT') || n.includes('ROLL') || n.includes('PAN SUIZO') || n.includes('PLUM')) return 'BOLLERÍA'
        if (n.includes('COOKIE') || n.includes('GALLETA') || n.includes('BIZCOCHO') || n.includes('BROWNIE')) return 'GALLETERÍA'
        if (n.includes('SIROPE') || n.includes('POLVO CHAI') || n.includes('MATCHA')) return 'SIROPES'
        if (n.includes('FRUTILLA') || n.includes('ARANDANO') || n.includes('FRAMBUESA') || n.includes('VEGETAL')) return 'VEGETALES'
        if (n.includes('HELADO') || n.includes('GIANDUJA') || n.includes('CRUMBLE') || n.includes('SALSA') || n.includes('MARSHMALLOW')) return 'HELADERÍA'
        if (n.includes('MASA') || n.includes('ROAST') || n.includes('CAPRESSE') || n.includes('MEDITERRANEO')) return 'CASA MIA'
        return 'OTROS'
      }

      // ── 2. Determine destination key per order ──────────────────────
      const getDestInfo = (order: any): { dest: string; round: string; sortKey: number } => {
        let dest = 'Otros'; let sortKey = 99
        if (order.deliveryType === 'delivery') {
          dest = 'Delivery'; sortKey = 10
        } else if (order.branch) {
          const b = (order.branch as string).toLowerCase()
          if (b.includes('marino'))                              { dest = 'Retiro - San Marino';  sortKey = 1 }
          else if (b.includes('mall') || b.includes('sol'))     { dest = 'Retiro - Mall del Sol'; sortKey = 2 }
          else if (b.includes('centro') || b.includes('producci') || b.includes('cdp')) { dest = 'CDP'; sortKey = 5 }
          else                                                   { dest = `Retiro - ${order.branch}`;  sortKey = 8 }
        }
        const isRestock = order.salesChannel === 'Restock' || order.salesChannel === 'Restock-Bodega'
        const round = isRestock && order.comments ? String(order.comments) : ''
        return { dest, round, sortKey }
      }

      // ── 3. Build pivot ──────────────────────────────────────────────
      // pivot[productName] = { category, destQty: { columnKey → qty } }
      const pivot: Record<string, { category: string; destQty: Record<string, number> }> = {}
      // destColumns: ordered list of { key, dest, round, sortKey }
      const destColMap = new Map<string, { dest: string; round: string; sortKey: number }>()

      orders.forEach(order => {
        const { dest, round, sortKey } = getDestInfo(order)
        const colKey = round ? `${dest}||${round}` : dest
        if (!destColMap.has(colKey)) destColMap.set(colKey, { dest, round, sortKey })

        ;(order.products || []).forEach((p: any) => {
          const name = (p.name || '').trim()
          if (!name) return
          const qty = Number(p.quantity) || 0
          if (qty <= 0) return
          if (!pivot[name]) pivot[name] = { category: categoryByName?.[normName(name)] || mapCategory(name, p.category), destQty: {} }
          pivot[name].destQty[colKey] = (pivot[name].destQty[colKey] || 0) + qty
        })
      })

      // Sort destination columns
      const sortedCols = Array.from(destColMap.entries())
        .sort(([, a], [, b]) => a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.round.localeCompare(b.round))
        .map(([key, info]) => ({ key, ...info }))

      // ── 4. Group & sort products by category ────────────────────────
      const CATEGORY_ORDER = ['TORTAS', 'TORTAS PORCIÓN', 'JOYITAS', 'BOLLERÍA', 'GALLETERÍA', 'SIROPES', 'VEGETALES', 'HELADERÍA', 'CASA MIA', 'OTROS']
      const grouped: Record<string, string[]> = {}
      Object.entries(pivot).forEach(([name, { category }]) => {
        if (!grouped[category]) grouped[category] = []
        grouped[category].push(name)
      })
      Object.values(grouped).forEach(list => list.sort())
      const sortedCategories = Object.keys(grouped).sort((a, b) => {
        // "OTROS" siempre al final; el resto por orden conocido o alfabético
        if (a === 'OTROS') return 1
        if (b === 'OTROS') return -1
        const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1; if (ib !== -1) return 1
        return a.localeCompare(b)
      })

      // ── 5. Build sheet data ─────────────────────────────────────────
      const wsData: any[][] = []
      const wsStyle: Record<string, any> = {}
      const wsMerges: any[] = []

      const S = (row: number, col: number, style: any) => {
        wsStyle[XLSX.utils.encode_cell({ r: row, c: col })] = style
      }
      const today = formatECT(new Date().toISOString(), false)
      const totalCols = 2 + sortedCols.length + 1  // category + product + dest cols + TOTAL
      const lastCol = totalCols - 1

      const border = (color = C_BORDER, weight = 'thin') => ({
        top: { style: weight, color: { rgb: color } },
        bottom: { style: weight, color: { rgb: color } },
        left: { style: weight, color: { rgb: color } },
        right: { style: weight, color: { rgb: color } }
      })

      // Row 0: Title
      wsData.push([`ORDEN DE PRODUCCIÓN — ${today}`, ...Array(totalCols - 1).fill('')])
      wsMerges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } })
      for (let c = 0; c < totalCols; c++) {
        S(0, c, { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: C_TITLE_BG } }, alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' } })
      }

      // Row 1: Responsible
      wsData.push([`RESPONSABLE: ${responsibleName.toUpperCase()}`, ...Array(totalCols - 1).fill('')])
      wsMerges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } })
      for (let c = 0; c < totalCols; c++) {
        S(1, c, { font: { sz: 10, italic: true, color: { rgb: '5D4037' } }, fill: { fgColor: { rgb: 'FFF8E1' } } })
      }

      // Row 2: Column headers
      wsData.push([
        'CATEGORÍA', 'PRODUCTO',
        ...sortedCols.map(col => col.round ? `${col.dest.toUpperCase()}\n${col.round.toUpperCase()}` : col.dest.toUpperCase()),
        'TOTAL'
      ])
      for (let c = 0; c < totalCols; c++) {
        S(2, c, { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: C_HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border('000000', c === 0 || c === 1 ? 'medium' : 'thin') })
      }

      let currentRow = 3

      // Category + product rows
      sortedCategories.forEach(cat => {
        const products = grouped[cat] || []
        if (products.length === 0) return

        // Category header — spans all columns
        wsData.push([cat, ...Array(totalCols - 1).fill('')])
        wsMerges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: totalCols - 1 } })
        for (let c = 0; c < totalCols; c++) {
          S(currentRow, c, { font: { bold: true, sz: 11, color: { rgb: '4E342E' } }, fill: { fgColor: { rgb: C_CAT_BG } }, alignment: { horizontal: 'left', vertical: 'center' }, border: border(C_CAT_BORDER) })
        }
        currentRow++

        products.forEach((productName, pIdx) => {
          const destQty = pivot[productName]?.destQty
          if (!destQty) return
          let rowTotal = 0
          const qtyValues = sortedCols.map(col => {
            const q = destQty[col.key] || 0
            rowTotal += q
            return q > 0 ? q : ''
          })
          wsData.push(['', productName, ...qtyValues, rowTotal > 0 ? rowTotal : ''])

          const rowBg = pIdx % 2 === 0 ? C_EVEN : C_ODD
          for (let c = 0; c < totalCols; c++) {
            const isLast = c === lastCol
            S(currentRow, c, {
              font: isLast ? { bold: true } : {},
              fill: { fgColor: { rgb: isLast ? 'FFF8E1' : rowBg } },
              alignment: { horizontal: c <= 1 ? 'left' : 'center', vertical: 'center' },
              border: border(C_BORDER)
            })
          }
          currentRow++
        })
      })

      // Totals row
      const totalsRow: any[] = ['', 'TOTAL GENERAL']
      let grandTotal = 0
      sortedCols.forEach(col => {
        let colTotal = 0
        Object.values(pivot).forEach(({ destQty }) => { colTotal += destQty[col.key] || 0 })
        grandTotal += colTotal
        totalsRow.push(colTotal > 0 ? colTotal : '')
      })
      totalsRow.push(grandTotal > 0 ? grandTotal : '')
      wsData.push(totalsRow)
      for (let c = 0; c < totalCols; c++) {
        S(currentRow, c, { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: C_TOTAL_BG } }, alignment: { horizontal: c <= 1 ? 'left' : 'center', vertical: 'center' }, border: border('000000', 'medium') })
      }

      // ── 6. Build workbook ───────────────────────────────────────────
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!merges'] = wsMerges
      ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 40 }]
      ws['!cols'] = [{ wch: 16 }, { wch: 38 }, ...sortedCols.map(() => ({ wch: 16 })), { wch: 12 }]

      Object.keys(wsStyle).forEach(ref => { if (ws[ref]) ws[ref].s = wsStyle[ref] })

      XLSX.utils.book_append_sheet(wb, ws, 'Orden de Producción')
      saveExcelFile(wb, `Orden_Produccion_${today}`)

    } catch (error) {
      console.error('Export error:', error)
      throw error
    } finally {
      isExporting.value = false
    }
  }

  // --- Dispatch Export ---
  // Formato aprobado por Operaciones (11/11/2026): una sola hoja con el total a
  // producir por producto y a dónde va cada unidad. Bloques separados por una
  // columna en blanco: cada punto de venta (Pedidos clientes · 1.er · 2.º
  // despacho) y "Clientes desde planta" (Delivery · Retiro en planta). Debajo,
  // el detalle de cada pedido de cliente para armarlo con su nombre.
  const exportDispatchOrder = async (
    orders: any[],
    branchName: string,
    categoryByName?: Record<string, string>
  ) => {
    isExporting.value = true
    try {
      // ── Colores ──
      const PURPLE = '6D28D9', PURPLE_SOFT = 'F3E8FF', INK = '1E293B', MUTED = '64748B', LINE = 'D9DEE7'
      const TOTAL_SOFT = 'EEF2F7'
      const BRANCH_COLORS: Array<{ bg: string; fg: string; soft: string }> = [
        { bg: '1D4ED8', fg: 'FFFFFF', soft: 'DBEAFE' }, // San Marino: azul
        { bg: 'FACC15', fg: '422006', soft: 'FEF9C3' }, // Mall del Sol: amarillo
        { bg: 'BE185D', fg: 'FFFFFF', soft: 'FCE7F3' }, // sucursales nuevas
        { bg: '0F766E', fg: 'FFFFFF', soft: 'CCFBF1' },
        { bg: 'C2410C', fg: 'FFFFFF', soft: 'FFEDD5' },
      ]
      const PLANT_COLOR = { bg: '15803D', fg: 'FFFFFF', soft: 'DCFCE7' }

      const thin = { style: 'thin', color: { rgb: LINE } }
      const box = { top: thin, bottom: thin, left: thin, right: thin }

      // ── 1. Destino de cada pedido ──
      type Kind = 'CLI' | 'R1' | 'R2' | 'DELIVERY' | 'PLANTA'
      const isPlant = (b: string) => /centro|producci|cdp/i.test(b)
      const isRestock = (o: any) => o.salesChannel === 'Restock' || o.salesChannel === 'Restock-Bodega'
      const destOf = (o: any): { branch: string | null; kind: Kind } => {
        if (o.deliveryType === 'delivery') return { branch: null, kind: 'DELIVERY' }
        const b = String(o.branch || '').trim()
        if (!b || isPlant(b)) return { branch: null, kind: 'PLANTA' }
        if (isRestock(o)) return { branch: b, kind: /segunda/i.test(String(o.comments || '')) ? 'R2' : 'R1' }
        return { branch: b, kind: 'CLI' }
      }

      // Sucursales presentes: San Marino y Mall del Sol primero, luego el resto
      const branchRank = (b: string) => (/marino/i.test(b) ? 0 : /mall|sol/i.test(b) ? 1 : 2)
      const branches = Array.from(new Set(orders.map(o => destOf(o).branch).filter((b): b is string => !!b)))
        .sort((a, b) => branchRank(a) - branchRank(b) || a.localeCompare(b))

      // ── 2. Columnas ──
      // 0 Producto · 1 Total · [espacio] · bloque por sucursal · [espacio] · planta
      type Col = { key: string; label: string; color: { bg: string; fg: string; soft: string } }
      const blocks: Array<{ title: string; color: Col['color']; cols: Col[] }> = branches.map((b, i) => {
        const color = BRANCH_COLORS[Math.min(i, BRANCH_COLORS.length - 1)] ?? PLANT_COLOR
        return {
          title: b.toUpperCase(),
          color,
          cols: [
            { key: `${b}|CLI`, label: 'Pedidos\nclientes', color },
            { key: `${b}|R1`, label: '1.er\ndespacho', color },
            { key: `${b}|R2`, label: '2.º\ndespacho', color },
          ],
        }
      })
      blocks.push({
        title: 'CLIENTES DESDE PLANTA',
        color: PLANT_COLOR,
        cols: [
          { key: '|DELIVERY', label: 'Delivery', color: PLANT_COLOR },
          { key: '|PLANTA', label: 'Retiro en\nplanta', color: PLANT_COLOR },
        ],
      })
      const colIndex = new Map<string, number>()
      const spacers = new Set<number>()
      const blockStart: number[] = []
      let next = 2
      blocks.forEach(bl => {
        spacers.add(next)
        next++
        blockStart.push(next)
        bl.cols.forEach(c => colIndex.set(c.key, next++))
      })
      const totalCols = next
      const lastCol = totalCols - 1
      const colOf = (k: string) => colIndex.get(k) ?? -1
      const colorAt = new Map<number, Col['color']>()
      blocks.forEach(bl => bl.cols.forEach(c => colorAt.set(colOf(c.key), c.color)))

      // ── 3. Pivote producto × destino ──
      const catLabel = (name: string, raw?: string) => {
        const fromMap = categoryByName?.[normName(name)]
        const c = (fromMap || raw || '').replace(/\.+$/, '').trim()
        return c ? c.toUpperCase() : 'OTROS'
      }
      const pivot = new Map<string, { name: string; category: string; qty: Record<string, number> }>()
      orders.forEach(o => {
        const { branch, kind } = destOf(o)
        const key = `${branch || ''}|${kind}`
        ;(o.products || []).forEach((p: any) => {
          const name = String(p.name || '').trim()
          const qty = Number(p.quantity) || 0
          if (!name || qty <= 0 || normName(name) === 'delivery') return
          const k = normName(name)
          const row = pivot.get(k) || { name, category: catLabel(name, p.category), qty: {} }
          row.qty[key] = (row.qty[key] || 0) + qty
          pivot.set(k, row)
        })
      })

      const CAT_ORDER = ['TORTAS', 'CAKES ENTEROS', 'TORTAS ENTERAS', 'CAKES PORCION', 'TORTAS PORCIÓN', 'INDIVIDUAL', 'JOYITAS', 'PANADERIA', 'PANADERÍA', 'BOLLERÍA', 'TOSTADAS', 'GALLETERÍA', 'HELADERIA', 'HELADERÍA', 'VEGETALES', 'SIROPES']
      const catRank = (c: string) => {
        if (c === 'OTROS') return 999
        const i = CAT_ORDER.indexOf(c)
        return i === -1 ? 500 : i
      }
      const categories = Array.from(new Set(Array.from(pivot.values()).map(p => p.category)))
        .sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b))

      // ── 4. Hoja ──
      const wsData: any[][] = []
      const styles: Record<string, any> = {}
      const merges: any[] = []
      const rowHeights: Array<{ hpt: number } | undefined> = []
      const S = (r: number, c: number, s: any) => { styles[XLSX.utils.encode_cell({ r, c })] = s }
      const blankRow = () => Array(totalCols).fill('')
      const merge = (r0: number, c0: number, r1: number, c1: number) => {
        if (r0 !== r1 || c0 !== c1) merges.push({ s: { r: r0, c: c0 }, e: { r: r1, c: c1 } })
      }

      const dates = Array.from(new Set(orders.map(o => (o.deliveryDate ? formatECT(o.deliveryDate, false) : '')).filter(Boolean)))
      const dateLabel = dates.length === 1 ? dates[0] : dates.length ? `${dates[0]} – ${dates[dates.length - 1]}` : formatECT(new Date().toISOString(), false)

      // Título
      let r = 0
      wsData.push([`ORDEN DE PRODUCCIÓN Y DESPACHO · ${dateLabel}`, ...Array(totalCols - 1).fill('')])
      merge(r, 0, r, lastCol)
      for (let c = 0; c < totalCols; c++) S(r, c, { font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: PURPLE } }, alignment: { vertical: 'center', indent: 1 } })
      rowHeights[r] = { hpt: 30 }
      r++
      const scope = branchName && !/todas|general/i.test(branchName) ? ` Filtrado: ${branchName}.` : ''
      wsData.push([`Total a producir = pedidos de clientes + 1.er y 2.º despacho de cada punto de venta + clientes desde planta.${scope}`, ...Array(totalCols - 1).fill('')])
      merge(r, 0, r, lastCol)
      S(r, 0, { font: { italic: true, sz: 10, color: { rgb: MUTED } } })
      r++
      wsData.push(blankRow())
      r++

      // Encabezado (2 filas)
      const h1 = r, h2 = r + 1
      const head = (row: number, c: number, bg: string, fg: string, sz: number) =>
        S(row, c, { font: { bold: true, sz, color: { rgb: fg } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center', wrapText: true, indent: c === 0 ? 1 : 0 }, border: box })
      const top = blankRow(), sub = blankRow()
      top[0] = 'PRODUCTO'
      top[1] = 'TOTAL A\nPRODUCIR'
      merge(h1, 0, h2, 0)
      merge(h1, 1, h2, 1)
      ;[0, 1].forEach(c => { head(h1, c, INK, 'FFFFFF', c === 1 ? 11 : 10); head(h2, c, INK, 'FFFFFF', 10) })
      blocks.forEach((bl, i) => {
        const c0 = blockStart[i] ?? 0
        top[c0] = bl.title
        merge(h1, c0, h1, c0 + bl.cols.length - 1)
        bl.cols.forEach((col, j) => {
          sub[c0 + j] = col.label
          head(h1, c0 + j, bl.color.bg, bl.color.fg, 10)
          head(h2, c0 + j, bl.color.bg, bl.color.fg, 9)
        })
      })
      wsData.push(top, sub)
      rowHeights[h1] = { hpt: 22 }
      rowHeights[h2] = { hpt: 30 }
      r += 2

      const writeQtyRow = (first: string, total: number | string, qty: Record<string, number>, kind: 'cat' | 'item' | 'total') => {
        const row = blankRow()
        row[0] = first
        row[1] = total
        colIndex.forEach((c, key) => { row[c] = qty[key] || '' })
        wsData.push(row)
        for (let c = 0; c < totalCols; c++) {
          if (spacers.has(c)) continue
          const align = { horizontal: c === 0 ? 'left' : 'center', vertical: 'center', indent: c === 0 ? 1 : 0 }
          if (kind === 'cat') {
            S(r, c, { font: { bold: true, sz: 10, color: { rgb: PURPLE } }, fill: { fgColor: { rgb: PURPLE_SOFT } }, alignment: align, border: box })
          } else if (kind === 'total') {
            S(r, c, { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: INK } }, alignment: align, border: box })
          } else if (c === 1) {
            S(r, c, { font: { bold: true, sz: 12, color: { rgb: INK } }, fill: { fgColor: { rgb: TOTAL_SOFT } }, alignment: align, border: box })
          } else if (c >= 2) {
            const has = !!row[c]
            S(r, c, { font: { bold: has, sz: 11, color: { rgb: INK } }, ...(has ? { fill: { fgColor: { rgb: colorAt.get(c)?.soft || 'FFFFFF' } } } : {}), alignment: align, border: box })
          } else {
            const alert = typeof total === 'number' && total >= 500
            S(r, c, { font: { sz: 11, bold: alert, color: { rgb: alert ? 'B45309' : INK } }, alignment: align, border: box })
          }
        }
        rowHeights[r] = { hpt: kind === 'total' ? 22 : 19 }
        r++
      }

      const grand: Record<string, number> = {}
      categories.forEach(cat => {
        const items = Array.from(pivot.values()).filter(p => p.category === cat).sort((a, b) => a.name.localeCompare(b.name))
        const subQty: Record<string, number> = {}
        items.forEach(p => Object.entries(p.qty).forEach(([k, q]) => { subQty[k] = (subQty[k] || 0) + q }))
        const subTotal = Object.values(subQty).reduce((s, q) => s + q, 0)
        writeQtyRow(`${cat}  ·  ${items.length} productos`, subTotal, subQty, 'cat')
        items.forEach(p => {
          const total = Object.values(p.qty).reduce((s, q) => s + q, 0)
          Object.entries(p.qty).forEach(([k, q]) => { grand[k] = (grand[k] || 0) + q })
          writeQtyRow(total >= 500 ? `${p.name}   ⚠ revisar cantidad` : p.name, total, p.qty, 'item')
        })
      })
      writeQtyRow('TOTAL GENERAL', Object.values(grand).reduce((s, q) => s + q, 0), grand, 'total')

      // ── 5. Detalle de pedidos de clientes ──
      const clientOrders = orders
        .filter(o => !isRestock(o))
        .sort((a, b) => String(a.deliveryTime || '99:99').localeCompare(String(b.deliveryTime || '99:99')) || String(a.customerName || '').localeCompare(String(b.customerName || '')))
      if (clientOrders.length) {
        wsData.push(blankRow())
        r++
        // Reparto de columnas: Cliente · Hora · Va a · Productos · Nota
        const rest = lastCol - 2
        const third = Math.max(1, Math.floor(rest / 3))
        const spans: Array<[number, number]> = [[0, 0], [1, 1], [2, 2 + third - 1], [2 + third, 2 + 2 * third - 1], [2 + 2 * third, lastCol]]

        wsData.push([`PEDIDOS DE CLIENTES · ${clientOrders.length} pedidos (armar por separado, con su nombre)`, ...Array(totalCols - 1).fill('')])
        merge(r, 0, r, lastCol)
        for (let c = 0; c < totalCols; c++) S(r, c, { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: PURPLE } }, alignment: { vertical: 'center', indent: 1 } })
        rowHeights[r] = { hpt: 24 }
        r++

        const writeSpans = (values: string[], style: (i: number) => any, height: number) => {
          const row = blankRow()
          spans.forEach(([c0, c1], i) => {
            row[c0] = values[i] ?? ''
            merge(r, c0, r, c1)
            for (let c = c0; c <= c1; c++) S(r, c, style(i))
          })
          wsData.push(row)
          rowHeights[r] = { hpt: height }
          r++
        }
        writeSpans(['CLIENTE', 'HORA', 'VA A', 'PRODUCTOS', 'NOTA / ✓'], () => ({ font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: INK } }, alignment: { horizontal: 'center', vertical: 'center' }, border: box }), 20)

        clientOrders.forEach(o => {
          const { branch, kind } = destOf(o)
          const color = branch ? colorAt.get(colOf(`${branch}|CLI`)) : PLANT_COLOR
          const va = kind === 'DELIVERY'
            ? `Delivery · ${o.deliveryAddress || 'Domicilio'}`
            : kind === 'PLANTA' ? 'Retiro en planta' : `${branch} (retiro)`
          const productos = (o.products || [])
            .filter((p: any) => normName(String(p.name || '')) !== 'delivery')
            .map((p: any) => `${p.quantity} ${p.name}${p.customerNote ? ` (${p.customerNote})` : ''}`)
            .join(' + ')
          // Nota corta: el comentario del pedido sin los datos de la tienda online
          const rawNote = String(o.comments || '').split('\n').map(s => s.trim()).filter(s => s && !/^(compra|email|c[ée]dula|pago):/i.test(s))[0] || ''
          const note = rawNote.length > 90 ? `${rawNote.slice(0, 87)}…` : rawNote
          const long = va.length > 35 || productos.length > 45 || note.length > 30
          writeSpans(
            [String(o.customerName || '').trim(), o.deliveryTime || '—', va, productos, note ? `☐ ${note}` : '☐'],
            i => ({
              font: { sz: 10, bold: i === 0 || i === 3, color: { rgb: i === 4 && note ? 'B45309' : INK } },
              ...(i === 2 ? { fill: { fgColor: { rgb: color?.soft || 'FFFFFF' } } } : {}),
              alignment: { horizontal: i === 1 ? 'center' : 'left', vertical: 'center', wrapText: true, indent: i === 1 ? 0 : 1 },
              border: box,
            }),
            long ? 32 : 20
          )
        })
      }

      // ── 6. Libro ──
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!merges'] = merges
      ws['!rows'] = rowHeights
      ws['!cols'] = Array.from({ length: totalCols }, (_, c) => ({ wch: c === 0 ? 38 : c === 1 ? 12 : spacers.has(c) ? 2.5 : 11 }))
      Object.keys(styles).forEach(ref => {
        if (!ws[ref]) ws[ref] = { t: 's', v: '' }
        ws[ref].s = styles[ref]
      })
      XLSX.utils.book_append_sheet(wb, ws, 'Despacho')
      saveExcelFile(wb, `Orden_Despacho_${formatECT(new Date().toISOString(), false)}`)
    } catch (error) {
      console.error('Export dispatch error:', error)
      throw error
    } finally {
      isExporting.value = false
    }
  }

  // --- Restock Production Order Export ---
  const exportRestockProductionOrder = async (formData: DailyFormData, branch: string) => {
    isExporting.value = true
    try {
      const wsData: any[][] = []
      const wsStyle: Record<string, any> = {}

      const setStyle = (row: number, col: number, style: any) => {
        wsStyle[XLSX.utils.encode_cell({ r: row, c: col })] = style
      }

      const PURPLE = '812A73'
      const PURPLE_LIGHT = 'F5EBF3'
      const GRAY_HEADER = '2C3E50'
      const CAT_PROD = 'E8F5E9'  // green tint for Producción
      const CAT_BOD  = 'E3F2FD'  // blue tint for Bodega

      // ── Row 0: Title ──────────────────────────────────────
      wsData.push([`ORDEN DE PRODUCCIÓN — ${branch.toUpperCase()}`, '', '', '', '', ''])
      for (let c = 0; c <= 5; c++) {
        setStyle(0, c, {
          font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: PURPLE } },
          alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' }
        })
      }

      // ── Row 1: Meta info ──────────────────────────────────
      const lastEntryDate = formData.items.find(i => i.lastEntry)?.lastEntry?.date ?? formData.formDate
      const isTodayEntry  = lastEntryDate === formData.formDate
      wsData.push([
        `Cierre del: ${lastEntryDate}${isTodayEntry ? ' (hoy)' : ' ⚠ cierre anterior'}`,
        '',
        `Para mañana: ${formData.targetDate}`,
        '', '', ''
      ])
      for (let c = 0; c <= 5; c++) {
        setStyle(1, c, {
          font: { italic: true, sz: 10, color: { rgb: '64748B' } },
          fill: { fgColor: { rgb: PURPLE_LIGHT } }
        })
      }

      // ── Row 2: Empty spacer ───────────────────────────────
      wsData.push(['', '', '', '', '', ''])

      // ── Row 3: Column headers ─────────────────────────────
      const headers = ['PRODUCTO', 'UNIDAD', 'CANT. PEDIDA', 'STOCK HOY', 'OBJ. MAÑANA', '✓ ENTREGADO']
      wsData.push(headers)
      for (let c = 0; c < headers.length; c++) {
        setStyle(3, c, {
          font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: GRAY_HEADER } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: '000000' } } }
        })
      }

      // ── Items grouped by category ─────────────────────────
      const itemsWithPedido = formData.items.filter(i => (i.lastEntry?.pedidoFinal ?? i.lastEntry?.pedidoSugerido ?? 0) > 0)
      const produccion = itemsWithPedido.filter(i => (i.category ?? 'Producción') === 'Producción')
      const bodega     = itemsWithPedido.filter(i => i.category === 'Bodega')

      let currentRow = 4

      const addCategoryBlock = (label: string, items: typeof itemsWithPedido, bgColor: string) => {
        if (items.length === 0) return

        // Category header
        wsData.push([label.toUpperCase(), '', '', '', '', ''])
        for (let c = 0; c <= 5; c++) {
          setStyle(currentRow, c, {
            font: { bold: true, sz: 11 },
            fill: { fgColor: { rgb: bgColor === CAT_PROD ? 'A5D6A7' : '90CAF9' } },
            alignment: { horizontal: 'left' }
          })
        }
        currentRow++

        items.forEach(item => {
          const pedido    = item.lastEntry?.pedidoFinal ?? item.lastEntry?.pedidoSugerido ?? 0
          const stockHoy  = item.lastEntry?.stockFinal  ?? '—'
          const objMañana = item.stockObjectiveTomorrow  ?? '—'

          wsData.push([item.productName, item.unit, pedido, stockHoy, objMañana, ''])

          for (let c = 0; c <= 5; c++) {
            setStyle(currentRow, c, {
              fill: { fgColor: { rgb: bgColor === CAT_PROD ? CAT_PROD.replace('#','') : CAT_BOD.replace('#','') } },
              border: {
                top:    { style: 'thin', color: { rgb: 'DDDDDD' } },
                bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
                left:   { style: 'thin', color: { rgb: 'DDDDDD' } },
                right:  { style: 'thin', color: { rgb: 'DDDDDD' } }
              },
              alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
              ...(c === 2 ? { font: { bold: true, sz: 12 } } : {})
            })
          }
          currentRow++
        })

        // Spacer
        wsData.push(['', '', '', '', '', ''])
        currentRow++
      }

      addCategoryBlock('Producción', produccion, CAT_PROD)
      addCategoryBlock('Bodega',     bodega,     CAT_BOD)

      if (itemsWithPedido.length === 0) {
        wsData.push(['Sin pedidos para mañana', '', '', '', '', ''])
        setStyle(currentRow, 0, { font: { italic: true, color: { rgb: '94A3B8' } } })
      }

      // ── Build workbook ────────────────────────────────────
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      ws['!cols'] = [{ wch: 42 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]
      ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }]

      Object.keys(wsStyle).forEach(ref => {
        if (ws[ref]) ws[ref].s = wsStyle[ref]
      })

      XLSX.utils.book_append_sheet(wb, ws, 'Orden de Producción')
      saveExcelFile(wb, `Orden_Produccion_${branch.replace(/\s+/g, '_')}_${formData.targetDate}`)

    } catch (error) {
      console.error('Export restock production error:', error)
      throw error
    } finally {
      isExporting.value = false
    }
  }

  return {
    isExporting,
    exportProductionOrder,
    exportDispatchOrder,
    exportRestockProductionOrder
  }
}
