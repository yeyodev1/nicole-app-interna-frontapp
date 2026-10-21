<script setup lang="ts">
import { useOperationsReport } from './composables/useOperationsReport';
import OperationsShell from './components/OperationsShell.vue';
import OperationsKpiRow from './components/OperationsKpiRow.vue';

const { branches, globalTotals, allLosses, discrepancies } = useOperationsReport();

const branchIssues = (b: any) => b.products.filter((p: any) => (p.descuadre ?? 0) !== 0).length;
</script>

<template>
  <OperationsShell
    title="Resumen del Día"
    subtitle="Todo de un vistazo: qué se vendió, qué se dio de baja y qué no cuadra. Entra a cada sección desde el menú o desde aquí."
    icon="fa-gauge-high"
  >
    <OperationsKpiRow
      :vendido="globalTotals.vendido"
      :venta-cierre="globalTotals.ventaCierre"
      :bajas="globalTotals.bajas"
      :descuadre="globalTotals.descuadre"
    />

    <div class="quick-links">
      <router-link to="/operations/sales" class="ql sales">
        <i class="fa-solid fa-cash-register"></i>
        <div><strong>Ventas</strong><span>{{ globalTotals.vendido }} unids facturadas</span></div>
        <i class="fa-solid fa-chevron-right arrow"></i>
      </router-link>
      <router-link to="/operations/losses" class="ql losses">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><strong>Bajas</strong><span>{{ allLosses.length }} registro(s) · {{ globalTotals.bajas }} unids</span></div>
        <i class="fa-solid fa-chevron-right arrow"></i>
      </router-link>
      <router-link to="/operations/discrepancies" class="ql disc" :class="{ alert: discrepancies.length > 0 }">
        <i class="fa-solid fa-scale-unbalanced"></i>
        <div><strong>Descuadres</strong><span>{{ discrepancies.length === 0 ? 'todo cuadra ✓' : `${discrepancies.length} producto(s) no cuadran` }}</span></div>
        <i class="fa-solid fa-chevron-right arrow"></i>
      </router-link>
    </div>

    <div class="branch-grid">
      <div v-for="b in branches" :key="b.branch" class="branch-mini">
        <div class="mini-head">
          <i class="fa-solid fa-store"></i>
          <h3>{{ b.branch }}</h3>
          <span v-if="branchIssues(b) > 0" class="chip bad">{{ branchIssues(b) }} no cuadran</span>
          <span v-else-if="b.hasClosing" class="chip ok">✓ cuadra</span>
          <span v-else class="chip warn">sin cierre</span>
          <span v-if="b.sinOkTotal > 0" class="chip warn" :title="`${b.sinOkTotal} unids despachadas sin el OK de Recepción Masiva`">⚠ {{ b.sinOkTotal }} sin OK</span>
        </div>
        <div class="mini-stats">
          <div><span class="n">{{ b.totals.vendido }}</span><span class="l">vendido</span></div>
          <div><span class="n">{{ b.totals.ventaCierre }}</span><span class="l">cierre</span></div>
          <div><span class="n">{{ b.totals.bajas }}</span><span class="l">bajas</span></div>
          <div :class="{ bad: b.totals.descuadre !== 0 }">
            <span class="n">{{ b.totals.descuadre > 0 ? `+${b.totals.descuadre}` : b.totals.descuadre }}</span><span class="l">descuadre</span>
          </div>
        </div>
      </div>
    </div>
  </OperationsShell>
</template>

<style lang="scss" scoped>
.quick-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.ql {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  padding: 1rem 1.1rem;
  text-decoration: none;
  color: #0f172a;
  transition: all 0.15s;

  > i:first-child {
    width: 42px; height: 42px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
  }

  div { flex: 1; display: flex; flex-direction: column; }
  strong { font-size: 0.98rem; }
  span { font-size: 0.78rem; color: #64748b; }
  .arrow { color: #cbd5e1; font-size: 0.8rem; }

  &:hover { border-color: #94a3b8; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06); }

  &.sales > i:first-child { background: #eff6ff; color: #2563eb; }
  &.losses > i:first-child { background: #fffbeb; color: #d97706; }
  &.disc > i:first-child { background: #f0fdf4; color: #16a34a; }

  &.disc.alert {
    border-color: #fecaca;
    background: #fff7f7;
    > i:first-child { background: #fee2e2; color: #dc2626; }
    span { color: #b91c1c; font-weight: 700; }
  }
}

.branch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.branch-mini {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1rem 1.2rem;
}

.mini-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.8rem;

  i { color: #2563eb; }
  h3 { margin: 0; font-size: 1rem; color: #0f172a; flex: 1; }

  .chip {
    font-size: 0.7rem; font-weight: 800; padding: 2px 9px; border-radius: 10px;
    &.ok { background: #dcfce7; color: #15803d; }
    &.bad { background: #fee2e2; color: #b91c1c; }
    &.warn { background: #fef3c7; color: #92400e; }
  }
}

.mini-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;

  > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #f8fafc;
    border-radius: 10px;
    padding: 0.5rem 0.25rem;

    .n { font-size: 1.15rem; font-weight: 800; color: #0f172a; }
    .l { font-size: 0.66rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

    &.bad { background: #fef2f2; .n { color: #dc2626; } }
  }
}
</style>
