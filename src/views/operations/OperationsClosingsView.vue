<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOperationsReport, diferenciasSeparadas, facturadoDe, type OpsProduct } from './composables/useOperationsReport';
import { useOperationsExport } from './composables/useOperationsExport';
import OperationsShell from './components/OperationsShell.vue';
import { useAnomalyNotes } from './composables/useAnomalyNotes';
import ProductNoteEditor from '@/components/ui/ProductNoteEditor.vue';

const { date, dateTo, branches } = useOperationsReport();
const { isExporting, exportDay } = useOperationsExport();

const search = ref('');

// Orden 2: comentario por anomalía (Diferencia ≠ 0). Con Periodo solo se leen.
const { notes, isRange, notesOf, save } = useAnomalyNotes();
const esAnomalia = (p: OpsProduct) => (p.descuadre ?? 0) !== 0 && !p.motivosIncompleto?.length;
// Se puede comentar cualquier producto del día (Operaciones, 25/11/2026), haya o no diferencia.
// En Periodo solo se ven los comentarios guardados.
const showNote = (branch: string, p: OpsProduct) =>
  notesOf(branch, p).length > 0 || !isRange.value;
const noteText = (branch: string, p: OpsProduct) =>
  notesOf(branch, p).map(n => `${isRange.value ? n.date.split('-').reverse().join('/') + ': ' : ''}${n.comment} (${n.updatedBy})`).join('\n');
const saveNote = (branch: string, p: OpsProduct) => (comment: string) => save(branch, p, comment);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const filteredBranches = computed(() =>
  branches.value.map(b => ({
    ...b,
    diferencias: diferenciasSeparadas(b.products), // antes del filtro del buscador
    products: b.products.filter(p => !search.value
      || norm(p.name).includes(norm(search.value))
      || norm(p.categoria || '').includes(norm(search.value))),
  }))
);

const incompletos = (b: { products: Array<{ motivosIncompleto?: string[] }> }) =>
  b.products.filter(p => p.motivosIncompleto?.length).length;

// "—" si hay Pedido y CDP no registró despacho; con despacho sin OK manda el aviso.
const recibidoTexto = (p: OpsProduct) => {
  if (p.recibidoSinOk > 0) return p.recibido || '';
  if ((p.pedidoAnterior ?? 0) > 0 && p.recibidoOk + p.recibidoSinOk === 0) return '—';
  return p.recibido;
};

// Orden: Tortas en porciones, Individuales, demás categorías y sin categoría.
const CATEGORIAS_PRIMERO = ['cakes porcion', 'individual'];
const rangoCategoria = (categoria: string | null) => {
  const i = CATEGORIAS_PRIMERO.indexOf(norm(categoria || ''));
  if (i >= 0) return i;
  return categoria ? CATEGORIAS_PRIMERO.length : CATEGORIAS_PRIMERO.length + 1;
};
const ordenados = <T extends { categoria: string | null; codigo?: string | null }>(products: T[]) =>
  [...products].sort((a, b) => {
    const ra = rangoCategoria(a.categoria);
    const rb = rangoCategoria(b.categoria);
    if (ra !== rb) return ra - rb;
    return ra < CATEGORIAS_PRIMERO.length ? (a.codigo || '~').localeCompare(b.codigo || '~') : 0;
  });

const handleExport = () =>
  exportDay(date.value === dateTo.value ? date.value : `${date.value}_a_${dateTo.value}`, branches.value, notes.value);
</script>

<template>
  <OperationsShell
    title="Detalle del Día"
    subtitle="El mismo reporte que llega por correo: la cuenta completa de cada producto por sucursal. Expórtalo a Excel con un clic."
    icon="fa-table-list"
  >
    <div class="toolbar">
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" type="text" placeholder="Buscar producto o categoría..." />
        <button v-if="search" @click="search = ''"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <button class="btn-excel" :disabled="isExporting || branches.length === 0" @click="handleExport">
        <i class="fa-solid" :class="isExporting ? 'fa-spinner fa-spin' : 'fa-file-excel'"></i>
        Exportar Excel
      </button>
    </div>

    <section v-for="b in filteredBranches" :key="b.branch" class="closing-card">
      <header>
        <i class="fa-solid fa-store"></i>
        <h3>{{ b.branch }}</h3>
        <span v-if="b.sinOkTotal > 0" class="chip warn">⚠ {{ b.sinOkTotal }} sin OK</span>
        <span v-if="!b.hasClosing" class="chip muted">sin cierre</span>
        <span v-if="incompletos(b) > 0" class="chip warn">⚠ {{ incompletos(b) }} incompletos</span>
        <span class="totals">
          vendido <strong>{{ facturadoDe(b) }}</strong>
          <template v-if="b.hasClosing">
            · bajas <strong>{{ b.totals.bajas }}</strong> ·
            excedentes
            <strong class="diff-chip pos">{{ b.diferencias.excedentes > 0 ? `+${b.diferencias.excedentes}` : 0 }}</strong> ·
            faltantes
            <strong class="diff-chip" :class="b.diferencias.faltantes > 0 ? 'neg' : 'pos'">{{ b.diferencias.faltantes > 0 ? `−${b.diferencias.faltantes}` : 0 }}</strong>
          </template>
          <template v-else> · bajas y diferencias llegan con el cierre</template>
        </span>
      </header>

      <p class="f-legend">
        <span class="f-swatch"></span>
        Columnas resaltadas: entran en la cuenta de <strong>Debería quedar</strong> =
        Stock inicial + Recibido − Venta isla − Venta combo o fuera de isla − Bajas.
        Pedido es solo informativo.
      </p>
      <div class="table-wrap" tabindex="0" role="region" :aria-label="`Detalle de ${b.branch}`">
        <table>
          <thead>
            <tr>
              <th class="t-left">Producto</th>
              <th class="f-in" title="Suma en Debería quedar"><span class="f-sign plus">+</span>Stock inicial</th>
              <th title="Pedido en el cierre de la jornada anterior. Informativo: no entra en la cuenta">Pedido</th>
              <th class="f-in" title="Suma en Debería quedar"><span class="f-sign plus">+</span>Recibido</th>
              <th class="f-in" title="Contífico, caja de la isla. Resta en Debería quedar"><span class="f-sign minus">−</span>Venta isla</th>
              <th class="f-in" title="Lo escribe la isla en el cierre. Resta en Debería quedar"><span class="f-sign minus">−</span>Venta en combo o fuera de isla</th>
              <th class="f-in" title="Resta en Debería quedar"><span class="f-sign minus">−</span>Bajas</th>
              <th class="should" title="Stock inicial + Recibido − Venta isla − Venta combo o fuera de isla − Bajas"><span class="f-sign eq">=</span>Debería quedar</th>
              <th>Quedó (isla)</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in ordenados(b.products)" :key="p.name" :class="{ issue: (p.descuadre ?? 0) !== 0 && !p.motivosIncompleto?.length }">
              <td class="t-left pname">
                {{ p.name }}
                <span v-if="p.categoria" class="cat-chip">{{ p.categoria }}</span>
                <span v-if="p.codigo === null && p.vendido !== null" class="cat-chip nocode">Sin código Contífico</span>
              </td>
              <td class="f-in">{{ p.inicial ?? '—' }}</td>
              <td>{{ p.pedidoAnterior ?? '—' }}</td>
              <td class="f-in">
                {{ recibidoTexto(p) }}
                <span v-if="p.recibidoSinOk > 0" class="sin-ok">⚠ {{ p.recibidoSinOk }} sin OK</span>
              </td>
              <template v-if="p.vendido !== null && p.ventas">
                <td class="f-in">{{ b.salesAvailable ? p.ventas.isla : '—' }}</td>
                <td class="f-in">{{ b.hasClosing ? (p.ventas.fueraIsla ?? 0) : '—' }}</td>
              </template>
              <td v-else colspan="2" class="f-in">—</td>
              <td class="f-in" :class="{ 'has-bajas': p.bajas > 0 }">{{ b.hasClosing ? p.bajas : '—' }}</td>
              <td class="should">{{ p.deberiaQuedar ?? '—' }}</td>
              <td>{{ p.quedo ?? '—' }}</td>
              <td class="diff" :class="p.motivosIncompleto?.length ? 'pending' : (p.descuadre ?? 0) < 0 ? 'neg' : 'pos'">
                {{ p.motivosIncompleto?.length ? p.motivosIncompleto.join(' · ') : (p.descuadre === null ? '—' : (p.descuadre > 0 ? `+${p.descuadre}` : p.descuadre)) }}
                <ProductNoteEditor
                  v-if="showNote(b.branch, p)"
                  :comment="notesOf(b.branch, p)[0]?.comment || null"
                  :tooltip="noteText(b.branch, p)"
                  :product-name="p.name"
                  :placeholder="esAnomalia(p) ? '¿Por qué hay esta diferencia?' : 'Escribe un comentario sobre este producto'"
                  :readonly="isRange"
                  :save="saveNote(b.branch, p)"
                />
              </td>
            </tr>
            <tr v-if="b.products.length === 0">
              <td colspan="10" class="empty-row">{{ search ? `Nada con «${search}»` : 'Sin movimientos' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="b.notasCredito?.contifico.length || b.notasCredito?.cajera.length" class="credit-notes">
        <strong>Notas de crédito (no se restan de lo vendido)</strong>
        <p v-for="n in b.notasCredito?.contifico" :key="`c-${n.numero}`">Contífico · {{ n.fecha }} · {{ n.numero }} · ${{ n.total.toFixed(2) }}<template v-if="n.cliente"> · {{ n.cliente }}</template></p>
        <p v-for="n in b.notasCredito?.cajera" :key="`m-${n.fecha}-${n.factura}`">Cajera · {{ n.fecha }} · Factura {{ n.factura }} · ${{ n.monto.toFixed(2) }} · {{ n.motivo }}</p>
      </div>
    </section>
  </OperationsShell>
</template>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 1rem;
  flex: 1;
  max-width: 420px;

  &:focus-within { border-color: #7c3aed; }
  > i { color: #94a3b8; font-size: 0.9rem; }
  input { flex: 1; border: none; outline: none; padding: 0.75rem 0; font-size: 0.95rem; background: transparent; }
  button { background: #f1f5f9; border: none; color: #64748b; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; }
}

.btn-excel {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #16a34a;
  color: white;
  border: none;
  padding: 0.7rem 1.3rem;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
  transition: all 0.15s;

  &:hover:not(:disabled) { background: #15803d; transform: translateY(-1px); }
  &:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
}

.closing-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;

  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1.2rem;
    background: #fcfcfd;
    border-bottom: 1px solid #f1f5f9;
    flex-wrap: wrap;

    i { color: #2563eb; }
    h3 { margin: 0; font-size: 1.05rem; color: #0f172a; }

    .chip {
      font-size: 0.7rem; font-weight: 800; padding: 2px 9px; border-radius: 10px;
      &.warn { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      &.muted { background: #f1f5f9; color: #64748b; }
    }

    .totals {
      margin-left: auto;
      font-size: 0.8rem;
      color: #64748b;
      strong { color: #0f172a; }
      strong.bad { color: #dc2626; }
    }
  }
}

.table-wrap { overflow-x: auto; }
th { min-width: 72px; }
.f-legend {
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
  margin: 0; padding: 0.5rem 1rem; font-size: 0.78rem; color: #64748b;
  strong { color: #475569; }
}
.f-swatch { width: 14px; height: 14px; border-radius: 3px; background: #f5f3ff; border: 1px solid #ddd6fe; flex-shrink: 0; }
.credit-notes { padding: 0.75rem 1rem; font-size: 0.82rem; color: #334155; p { margin: 0.25rem 0 0; } }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;

  th {
    padding: 0.6rem 0.7rem; background: #f8fafc; color: #64748b;
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.4px; text-align: center;
  }

  td { padding: 0.55rem 0.7rem; border-bottom: 1px solid #f8fafc; color: #334155; text-align: center; }
  tr:last-child td { border-bottom: none; }
  tr.issue { background: #fff9f9; }

  .t-left { text-align: left; }
  .pname { font-weight: 600; color: #1e293b; }
  .has-bajas { color: #b45309; font-weight: 700; }
  .should { font-weight: 700; color: #475569; background: #f8fafc; }
  // Columnas que entran en la fórmula de Debería quedar
  .f-in { background: #f5f3ff; }
  th.f-in { color: #5b21b6; }
  .f-sign {
    display: inline-block; margin-right: 0.2rem; font-weight: 800;
    &.plus { color: #15803d; }
    &.minus { color: #b91c1c; }
    &.eq { color: #475569; }
  }

  .cat-chip {
    display: inline-block; margin-left: 0.35rem;
    background: #f5f3ff; border: 1px solid #ddd6fe; color: #6d28d9;
    font-size: 0.6rem; font-weight: 800; text-transform: uppercase;
    padding: 1px 6px; border-radius: 8px; vertical-align: middle;
  }

  .cat-chip.nocode { background: #fff7ed; border-color: #fed7aa; color: #c2410c; }

  .sin-ok { display: block; font-size: 0.6rem; font-weight: 800; color: #d97706; white-space: nowrap; }

  // Negativo = rojo · Positivo (y cero) = verde
  .diff {
    font-weight: 800;
    font-size: 1rem;
    white-space: nowrap;
    &.neg { color: #dc2626; }
    &.pos { color: #15803d; }
    // Falta un dato: se explica qué falta, sin color de bien/mal
    &.pending {
      white-space: normal;
      min-width: 170px;
      font-size: 0.74rem;
      font-weight: 600;
      line-height: 1.35;
      color: #92400e;
      text-align: left;
    }
  }

  // La columna del producto queda fija al desplazar la tabla a lo ancho
  .pname {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    background: white;
    min-width: 170px;
  }
  tr.issue .pname { background: #fff9f9; }

  .empty-row { padding: 1.4rem; color: #94a3b8; }

}

.diff-chip {
  display: inline-block;
  padding: 1px 9px;
  border-radius: 20px;
  font-weight: 800;

  &.neg { background: #fee2e2; color: #b91c1c; }
  &.pos { background: #dcfce7; color: #15803d; }
}
</style>
