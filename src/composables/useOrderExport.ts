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
  const exportDispatchOrder = async (orders: any[], branchName: string) => {
    isExporting.value = true
    try {
      const wsData: any[][] = []
      const wsStyle: Record<string, any> = {}

      // Helper to set style
      const setStyle = (row: number, col: number, style: any) => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        wsStyle[cellRef] = style
      }

      // 1. Branch Header Row (Row 0)
      wsData.push([`REPORTE DE ENTREGAS - ${branchName.toUpperCase()}`])

      // Style for Branch Header
      setStyle(0, 0, {
        font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "6A1B9A" } }, // Purple
        alignment: { horizontal: 'left', vertical: 'center' }
      })

      // 2. Column Headers (Row 1)
      const headers = ['FECHA DE ENTREGA', 'CLIENTE', 'PEDIDO', 'HORA DE ENTREGA', 'DIRECCION DE ENTREGA', 'ESTADO DE PAGO', 'COMENTARIOS']
      wsData.push(headers)

      // Header Style
      for (let c = 0; c < headers.length; c++) {
        setStyle(1, c, {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2C3E50" } }, // Dark Blue Header
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: "000000" } },
            bottom: { style: 'thin', color: { rgb: "000000" } },
            left: { style: 'thin', color: { rgb: "000000" } },
            right: { style: 'thin', color: { rgb: "000000" } }
          }
        })
      }

      // Sort orders: Time ASC, then Address/Branch Alphabetical ASC
      const sortedOrders = [...orders].sort((a, b) => {
        const timeA = a.deliveryTime || '99:99'
        const timeB = b.deliveryTime || '99:99'
        if (timeA !== timeB) return timeA.localeCompare(timeB)

        const addrA = (a.deliveryType === 'delivery' ? (a.deliveryAddress || '') : (a.branch || '')).toLowerCase()
        const addrB = (b.deliveryType === 'delivery' ? (b.deliveryAddress || '') : (b.branch || '')).toLowerCase()
        return addrA.localeCompare(addrB)
      })

      sortedOrders.forEach((order, index) => {
        const dateStr = order.deliveryDate ? formatECT(order.deliveryDate, false) : ''
        const products = order.products || []
        // Formatting products as a vertical list with bullet points
        const itemsStr = products.map((p: any) => `• ${p.quantity} ${p.name}`).join('\n')

        let address = ''
        if (order.deliveryType === 'delivery') {
          address = order.deliveryAddress || 'Domicilio'
        } else {
          address = order.branch || 'Retiro en Local'
        }

        // Payment Status Logic
        const total = order.totalValue || 0
        const payments = order.payments || []
        const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.monto) || 0), 0)
        const remaining = Math.max(0, total - totalPaid)

        let paymentStatusStr = ''

        if (order.isGlobalCourtesy) {
          paymentStatusStr = 'CORTESÍA'
        } else if (order.settledInIsland) {
          paymentStatusStr = 'PAGADO (ISLA)'
        } else if (remaining < 0.01) {
          paymentStatusStr = 'PAGADO'
        } else {
          paymentStatusStr = `PENDIENTE ($${remaining.toFixed(2)})`
        }

        let paymentMethodStr = order.paymentMethod
        if (!paymentMethodStr || paymentMethodStr === 'Por confirmar' || paymentMethodStr === 'Por Cobrar') {
          if (payments && payments.length > 0) {
            const methods = [...new Set(payments.map((p: any) => {
              const m = p.forma_cobro
              if (m === 'TRA') return 'Transferencia'
              if (m === 'EFE') return 'Efectivo'
              if (m === 'TC') return 'Tarjeta Crédito'
              if (m === 'TD') return 'Tarjeta Débito'
              return m
            }))]
            if (methods.length > 0) {
              paymentMethodStr = methods.join(', ')
            } else {
              paymentMethodStr = 'Por Confirmar'
            }
          } else {
            paymentMethodStr = 'Por Confirmar'
          }
        }

        const paymentColumn = `${paymentStatusStr} - ${paymentMethodStr}`

        const rowIdx = index + 2
        wsData.push([
          dateStr,
          order.customerName,
          itemsStr,
          order.deliveryTime || '',
          address,
          paymentColumn,
          order.comments || ''
        ])

        // Determine Row Style based on Destination
        let rowColor = 'FFFFFF' // Default white
        const addrLower = address.toLowerCase()
        if (addrLower.includes('mall del sol')) {
          rowColor = 'FFF9C4' // Light Yellow
        } else if (addrLower.includes('san marino')) {
          rowColor = 'E1F5FE' // Light Blue
        }

        // Apply style to all cells in the row
        for (let c = 0; c < headers.length; c++) {
          setStyle(rowIdx, c, {
            fill: { fgColor: { rgb: rowColor } },
            border: {
              top: { style: 'thin', color: { rgb: "CCCCCC" } },
              bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
              left: { style: 'thin', color: { rgb: "CCCCCC" } },
              right: { style: 'thin', color: { rgb: "CCCCCC" } }
            },
            alignment: {
              vertical: 'top',
              wrapText: true
            }
          })
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Column Widths
      ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 40 }]

      // Apply styles from wsStyle to ws
      Object.keys(wsStyle).forEach(cellRef => {
        if (ws[cellRef]) {
          ws[cellRef].s = wsStyle[cellRef]
        }
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
      const headers = ['PRODUCTO', 'UNIDAD', 'CANT. PEDIDA', 'OBJ. MAÑANA', '✓ ENTREGADO']
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
          const objMañana = item.stockObjectiveTomorrow  ?? '—'

          wsData.push([item.productName, item.unit, pedido, objMañana, ''])

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

      ws['!cols'] = [{ wch: 42 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
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
