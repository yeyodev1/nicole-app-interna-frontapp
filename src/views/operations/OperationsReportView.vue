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
          <div :class="b.totals.descuadre < 0 ? 'neg' : 'pos'">
            <span class="n">{{ b.totals.descuadre > 0 ? `+${b.totals.descuadre}` : b.totals.descuadre }}</span><span class="l">diferencia</span>
          </div>
        </div>
      </div>
    </div>
  </OperationsShell>
</template>

<style lang="scss" scoped>
.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.ql {
  flex: 1 1 240px;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: white;
  border: 1px solid #e9eef5;
  border-radius: 16px;
  padding: 1.05rem 1.15rem;
  text-decoration: none;
  color: #0f172a;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;

  > i:first-child {
    width: 44px; height: 44px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center; font-size: 1.05rem;
    flex-shrink: 0;
  }

  div { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  strong { font-size: 0.97rem; font-weight: 800; }
  span { font-size: 0.78rem; color: #8a97a8; }
  .arrow { color: #cbd5e1; font-size: 0.8rem; transition: transform 0.18s; }

  &:hover {
    border-color: #ddd6fe;
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.09);
    .arrow { transform: translateX(3px); color: #7c3aed; }
  }

  &.sales > i:first-child { background: #eff6ff; color: #2563eb; }
  &.losses > i:first-child { background: #fffbeb; color: #d97706; }
  &.disc > i:first-child { background: #f0fdf4; color: #16a34a; }

  &.disc.alert {
    border-color: #fbd5d5;
    background: linear-gradient(180deg, #fffafa, white 60%);
    > i:first-child { background: #fee2e2; color: #dc2626; }
    span { color: #b91c1c; font-weight: 700; }
  }
}

.branch-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.branch-mini {
  flex: 1 1 320px;
  background: white;
  border: 1px solid #e9eef5;
  border-radius: 18px;
  padding: 1.1rem 1.25rem 1.2rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: transform 0.18s, box-shadow 0.18s;

  &:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08); }
}

.mini-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.95rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #f1f5f9;

  > i {
    width: 34px; height: 34px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; font-size: 0.85rem;
    background: #eff6ff; color: #2563eb; flex-shrink: 0;
  }

  h3 { margin: 0; font-size: 1rem; font-weight: 800; color: #0f172a; flex: 1; min-width: 0; }

  .chip {
    font-size: 0.68rem; font-weight: 800; padding: 3px 10px; border-radius: 20px;
    white-space: nowrap;
    &.ok { background: #dcfce7; color: #15803d; }
    &.bad { background: #fee2e2; color: #b91c1c; }
    &.warn { background: #fef3c7; color: #92400e; }
  }
}

.mini-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  > div {
    flex: 1 1 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: 12px;
    padding: 0.6rem 0.25rem;

    .n { font-size: 1.2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .l { font-size: 0.64rem; font-weight: 800; color: #9aa6b6; text-transform: uppercase; letter-spacing: 0.03em; }

    // Negativo = rojo · Positivo o cero = verde
    &.neg {
      background: #fef2f2;
      border-color: #fbd5d5;
      .n { color: #dc2626; }
      .l { color: #b91c1c; }
    }

    &.pos {
      background: #f0fdf4;
      border-color: #bbf7d0;
      .n { color: #15803d; }
      .l { color: #15803d; }
    }
  }
}
</style>
