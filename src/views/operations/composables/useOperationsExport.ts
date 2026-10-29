import { ref } from 'vue';
// @ts-ignore
import XLSX from 'xlsx-js-style';
import type { OpsBranch } from './useOperationsReport';

/**
 * Exporta a Excel el mismo reporte que llega por correo al Jefe de
 * Operaciones: por sucursal, la cuenta completa del día por producto
 * (inicial → recibido → vendido → bajas → debería quedar → quedó →
 * diferencia) más la hoja de bajas con motivos.
 */
export function useOperationsExport() {
  const isExporting = ref(false);

  const exportDay = (date: string, branches: OpsBranch[]) => {
    isExporting.value = true;
    try {
      const wb = XLSX.utils.book_new();

      const HEAD = ['Producto', 'Categoría (Contífico)', 'Stock inicial', 'Recibido', 'Sin OK', 'Venta isla', 'Venta combo', 'Venta Casa Mía', 'Venta Dela Cream', 'Vendido total', 'Bajas', 'Debería quedar', 'Quedó (isla)', 'Diferencia'];
      const headStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '7C3AED' } },
        alignment: { horizontal: 'center' },
      };

      for (const b of branches) {
        const rows: any[][] = [HEAD];
        for (const p of b.products) {
          rows.push([
            p.name,
            p.categoria || '',
            p.inicial ?? '—',
            p.recibido || 0,
            p.recibidoSinOk || 0,
            p.ventas?.isla ?? 0,
            p.ventas?.combo ?? 0,
            p.ventas?.casaMia ?? 0,
            p.ventas?.delaCrem ?? 0,
            p.vendido ?? '—',
            p.bajas || 0,
            p.deberiaQuedar ?? '—',
            p.quedo ?? '—',
            p.descuadre ?? '—',
          ]);
        }
        rows.push([]);
        rows.push(['TOTALES', '', '', '', b.sinOkTotal, '', '', '', '', b.totals.vendido, b.totals.bajas, '', '', b.totals.descuadre]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 11 }];
        for (let c = 0; c < HEAD.length; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell) cell.s = headStyle;
        }
        // Diferencias en rojo
        for (let r = 1; r <= b.products.length; r++) {
          const d = b.products[r - 1]?.descuadre;
          const cell = ws[XLSX.utils.encode_cell({ r, c: 9 })];
          if (cell && typeof d === 'number' && d !== 0) {
            cell.s = { font: { bold: true, color: { rgb: d < 0 ? 'DC2626' : 'D97706' } } };
          }
        }
        // Nombre de hoja máx 31 chars
        XLSX.utils.book_append_sheet(wb, ws, b.branch.slice(0, 31));
      }

      // Hoja de bajas con motivos
      const bajasRows: any[][] = [['Sucursal', 'Producto', 'Categoría (Contífico)', 'Cantidad', 'Motivo', 'Tipo']];
      for (const b of branches) {
        for (const l of b.losses) {
          bajasRows.push([b.branch, l.productName, (l as any).categoria || '', l.quantity, l.reason, l.category]);
        }
      }
      if (bajasRows.length > 1) {
        const wsB = XLSX.utils.aoa_to_sheet(bajasRows);
        wsB['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 22 }, { wch: 10 }, { wch: 36 }, { wch: 12 }];
        for (let c = 0; c < 6; c++) {
          const cell = wsB[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell) cell.s = { ...headStyle, fill: { fgColor: { rgb: 'D97706' } } };
        }
        XLSX.utils.book_append_sheet(wb, wsB, 'Bajas');
      }

      XLSX.writeFile(wb, `Reporte-Operaciones-${date}.xlsx`);
    } finally {
      isExporting.value = false;
    }
  };

  return { isExporting, exportDay };
}
