import { ref } from 'vue';
// @ts-ignore
import XLSX from 'xlsx-js-style';
import { diferenciasSeparadas, type OpsBranch } from './useOperationsReport';
import type { AnomalyNote } from '@/services/pos-restock.service';
import { XL, styleSimpleTable } from '@/utils/excelTheme';

/**
 * Exporta a Excel el mismo reporte que llega por correo al Jefe de
 * Operaciones: por sucursal, la cuenta completa del día por producto
 * (inicial → recibido → vendido → bajas → debería quedar → quedó →
 * diferencia) más la hoja de bajas con motivos.
 */
export function useOperationsExport() {
  const isExporting = ref(false);

  const exportDay = (date: string, branches: OpsBranch[], notes: AnomalyNote[] = []) => {
    isExporting.value = true;
    try {
      const wb = XLSX.utils.book_new();

      const HEAD = ['Producto', 'Categoría (Contífico)', 'Stock inicial', 'Recibido', 'Sin OK', 'Venta isla', 'Venta en combo o fuera de isla', 'Vendido total', 'Bajas', 'Debería quedar', 'Quedó (isla)', 'Diferencia', 'Pedido (cierre anterior)', 'Información incompleta'];

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
            p.ventas?.fueraIsla ?? 0,
            p.vendido ?? '—',
            p.bajas || 0,
            p.deberiaQuedar ?? '—',
            p.quedo ?? '—',
            p.descuadre ?? '—',
            p.pedidoAnterior ?? '—',
            (p.motivosIncompleto || []).join(' · '),
          ]);
        }
        rows.push([]);
        rows.push(['TOTALES', '', '', '', b.sinOkTotal, '', '', b.totals.vendido, b.totals.bajas]);
        const totalesDif = diferenciasSeparadas(b.products);
        rows.push(['TOTAL EXCEDENTES', totalesDif.excedentes]);
        rows.push(['TOTAL FALTANTES', totalesDif.faltantes ? -totalesDif.faltantes : 0]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 28 }, { wch: 11 }];
        // Formato común: encabezado oscuro, bordes y filas de totales
        const lastProduct = b.products.length;
        styleSimpleTable(ws, {
          numericCols: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          boldCols: [11],
          totalRows: [lastProduct + 2, lastProduct + 3, lastProduct + 4],
        });
        // La fila vacía antes de los totales queda sin bordes
        for (let c = 0; c < HEAD.length; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: lastProduct + 1, c })];
          if (cell) cell.s = {};
        }
        // Diferencias en rojo (faltante) o ámbar (sobrante)
        for (let r = 1; r <= b.products.length; r++) {
          const d = b.products[r - 1]?.descuadre;
          const cell = ws[XLSX.utils.encode_cell({ r, c: 11 })]; // columna Diferencia
          if (cell && typeof d === 'number' && d !== 0) {
            cell.s = { ...cell.s, font: { sz: 10, bold: true, color: { rgb: d < 0 ? XL.RED : XL.AMBER } } };
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
        styleSimpleTable(wsB, { numericCols: [3] });
        XLSX.utils.book_append_sheet(wb, wsB, 'Bajas');
      }

      // Orden 2: hoja nueva al final, una fila por comentario
      if (notes.length) {
        const fecha = (s: string) => s.split('-').reverse().join('/');
        const nRows: any[][] = [['Fecha', 'Sucursal', 'Producto', 'Diferencia al comentar', 'Comentario', 'Registrado por', 'Última edición']];
        for (const n of [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch) || a.productName.localeCompare(b.productName))) {
          nRows.push([fecha(n.date), n.branch, n.productName, n.descuadre, n.comment, n.createdBy, `${n.updatedBy} · ${new Date(n.updatedAt).toLocaleString('es-EC')}`]);
        }
        const wsN = XLSX.utils.aoa_to_sheet(nRows);
        wsN['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 34 }, { wch: 12 }, { wch: 60 }, { wch: 18 }, { wch: 30 }];
        styleSimpleTable(wsN, { numericCols: [3] });
        XLSX.utils.book_append_sheet(wb, wsN, 'Comentarios de anomalías');
      }

      XLSX.writeFile(wb, `Reporte-Operaciones-${date}.xlsx`);
    } finally {
      isExporting.value = false;
    }
  };

  return { isExporting, exportDay };
}
