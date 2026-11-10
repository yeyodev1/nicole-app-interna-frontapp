<script setup lang="ts">
import { computed } from 'vue';
import { useOperationsReport } from '../composables/useOperationsReport';
import { useAnomalyNotes, normKey } from '../composables/useAnomalyNotes';

// Orden 3: comentarios de anomalías (Orden 2) debajo de las tarjetas de sucursal. Solo lectura.
const { branches, date } = useOperationsReport();
const { notes, isRange, notesOf } = useAnomalyNotes();

interface Line { date: string; diff: number | null; comment: string | null; by: string }
interface ProductGroup { key: string; name: string; lines: Line[] }
interface BranchGroup { key: string; branch: string; products: ProductGroup[] }

const fecha = (s: string) => s.split('-').reverse().join('/');
const diffText = (d: number | null) => (d === null ? '—' : d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0');

const groups = computed<BranchGroup[]>(() => {
  const out = new Map<string, { branch: string; products: Map<string, ProductGroup> }>();
  const official = new Map(branches.value.map(b => [normKey(b.branch), b.branch]));
  const branchOf = (key: string, fallback: string) => {
    if (!out.has(key)) out.set(key, { branch: official.get(key) || fallback, products: new Map() });
    return out.get(key)!;
  };
  // Diferencia del día según el reporte (un solo día); en Periodo, la guardada al comentar
  const currentDiff = (branch: string, n: { productName: string; codigo?: string | null; descuadre: number }) => {
    if (isRange.value) return n.descuadre;
    const b = branches.value.find(x => normKey(x.branch) === normKey(branch));
    const p = b?.products.find(x => (n.codigo && x.codigo === n.codigo) || normKey(x.name) === normKey(n.productName));
    return p ? p.descuadre : n.descuadre;
  };

  for (const n of notes.value) {
    const g = branchOf(n.branchKey, n.branch);
    const pk = n.codigo || n.productKey;
    if (!g.products.has(pk)) g.products.set(pk, { key: pk, name: n.productName, lines: [] });
    g.products.get(pk)!.lines.push({ date: n.date, diff: currentDiff(n.branch, n), comment: n.comment, by: n.updatedBy });
  }

  // Un solo día: también las anomalías sin comentario, para ver qué falta justificar
  if (!isRange.value) {
    for (const b of branches.value) {
      for (const p of b.products) {
        if ((p.descuadre ?? 0) === 0 || p.motivosIncompleto?.length || notesOf(b.branch, p).length) continue;
        const g = branchOf(normKey(b.branch), b.branch);
        const pk = p.codigo || normKey(p.name);
        if (!g.products.has(pk)) g.products.set(pk, { key: pk, name: p.name, lines: [] });
        g.products.get(pk)!.lines.push({ date: date.value, diff: p.descuadre, comment: null, by: '' });
      }
    }
  }

  const order = branches.value.map(b => normKey(b.branch));
  return Array.from(out.entries())
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([key, g]) => ({
      key,
      branch: g.branch,
      products: Array.from(g.products.values())
        .map(p => ({ ...p, lines: [...p.lines].sort((a, b) => a.date.localeCompare(b.date)) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }));
});
</script>

<template>
  <section class="notes-summary" aria-labelledby="notes-summary-title">
    <h2 id="notes-summary-title"><i class="fa-solid fa-comment-dots"></i> Comentarios de anomalías</h2>
    <p v-if="groups.length === 0" class="empty">No hay comentarios de anomalías en este periodo</p>
    <div v-for="g in groups" :key="g.key" class="branch">
      <h3><i class="fa-solid fa-store"></i> {{ g.branch }}</h3>
      <div v-for="p in g.products" :key="p.key" class="product">
        <strong class="pname">{{ p.name }}</strong>
        <ul>
          <li v-for="(l, i) in p.lines" :key="i">
            <span class="date">{{ fecha(l.date) }}</span>
            <span class="diff" :class="(l.diff ?? 0) < 0 ? 'neg' : 'pos'">{{ diffText(l.diff) }}</span>
            <span v-if="l.comment" class="comment">{{ l.comment }}</span>
            <span v-else class="comment missing">Sin comentario</span>
            <span v-if="l.by" class="by">{{ l.by }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.notes-summary {
  background: white;
  border: 1px solid #e9eef5;
  border-radius: 18px;
  padding: 1.1rem 1.25rem 1.2rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);

  h2 { margin: 0 0 0.8rem; font-size: 1rem; font-weight: 800; color: #0f172a; i { color: #7c3aed; margin-right: 0.3rem; } }
  .empty { margin: 0; color: #8a97a8; font-size: 0.88rem; }
}

.branch + .branch { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #f1f5f9; }
.branch h3 { margin: 0 0 0.6rem; font-size: 0.92rem; font-weight: 800; color: #1e293b; i { color: #2563eb; margin-right: 0.3rem; } }

.product { margin: 0 0 0.7rem 0.4rem; }
.pname { font-size: 0.86rem; color: #334155; }

ul { list-style: none; margin: 0.3rem 0 0; padding: 0 0 0 0.6rem; border-left: 2px solid #ede9fe; }
li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem 0.7rem; padding: 0.25rem 0; font-size: 0.84rem; color: #334155; }
.date { font-weight: 700; color: #64748b; font-variant-numeric: tabular-nums; }
.diff { font-weight: 800; font-variant-numeric: tabular-nums; &.neg { color: #dc2626; } &.pos { color: #15803d; } }
.comment { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
.comment.missing { color: #b45309; font-style: italic; }
.by { font-size: 0.75rem; color: #94a3b8; }
</style>
