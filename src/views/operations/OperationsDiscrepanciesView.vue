<script setup lang="ts">
import { computed } from 'vue';
import { useOperationsReport } from './composables/useOperationsReport';
import OperationsShell from './components/OperationsShell.vue';

const { discrepancies, branches } = useOperationsReport();

// Venta de cierre negativa = recepciones sin confirmar en el POS
const hasNegativeCierre = computed(() =>
  branches.value.some(b => b.products.some(p => (p.ventaCierre ?? 0) < 0))
);
</script>

<template>
  <OperationsShell
    title="Descuadres"
    subtitle="Lo que salió de vitrina según el cierre vs lo facturado en Contífico. Aquí solo aparece lo que NO cuadra."
    icon="fa-scale-unbalanced"
  >
    <div v-if="discrepancies.length === 0" class="all-good">
      <i class="fa-solid fa-circle-check"></i>
      <h3>¡Todo cuadra! 🎉</h3>
      <p>La venta de los cierres coincide con lo facturado en Contífico.</p>
    </div>

    <template v-else>
      <div class="legend">
        <span class="pill plus">+ positivo</span> salió más de vitrina que lo facturado (posible venta sin factura o conteo)
        <span class="pill minus">− negativo</span> se facturó más que lo que salió según el cierre
      </div>

      <div v-if="hasNegativeCierre" class="hint-note">
        <i class="fa-solid fa-circle-info"></i>
        Hay cierres con venta en negativo: casi siempre la sucursal recibió producto
        <strong>sin confirmar la recepción</strong> en el POS. Pide revisar Recepción Masiva.
      </div>

      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th class="t-left">Producto</th>
              <th class="t-left">Sucursal</th>
              <th>Vendido (Contífico)</th>
              <th>Venta según cierre</th>
              <th>Descuadre</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, i) in discrepancies" :key="i">
              <td class="t-left pname">{{ d.name }}</td>
              <td class="t-left branch"><i class="fa-solid fa-store"></i> {{ d.branch }}</td>
              <td>{{ d.vendido ?? '—' }}</td>
              <td :class="{ neg: (d.ventaCierre ?? 0) < 0 }">{{ d.ventaCierre ?? '—' }}</td>
              <td class="desc">{{ (d.descuadre ?? 0) > 0 ? `+${d.descuadre}` : d.descuadre }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </OperationsShell>
</template>

<style lang="scss" scoped>
.all-good {
  text-align: center;
  background: white;
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  padding: 3rem 1rem;

  i { font-size: 3rem; color: #16a34a; margin-bottom: 0.75rem; }
  h3 { margin: 0 0 0.3rem; color: #15803d; }
  p { margin: 0; color: #64748b; font-size: 0.9rem; }
}

.legend {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  .pill {
    font-weight: 800;
    font-size: 0.72rem;
    padding: 2px 9px;
    border-radius: 10px;

    &.plus { background: #fee2e2; color: #b91c1c; }
    &.minus { background: #ffedd5; color: #9a3412; }
  }
}

.hint-note {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  color: #1e40af;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-size: 0.84rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.table-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;

  th {
    padding: 0.7rem 0.9rem;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    text-align: center;
  }

  td {
    padding: 0.65rem 0.9rem;
    border-bottom: 1px solid #f8fafc;
    color: #334155;
    text-align: center;
  }

  tr:last-child td { border-bottom: none; }
  tr { background: #fff7f7; }

  .t-left { text-align: left; }
  .pname { font-weight: 700; color: #1e293b; }

  .branch {
    color: #64748b;
    font-size: 0.82rem;
    i { color: #2563eb; margin-right: 0.3rem; }
  }

  .neg { color: #b45309; font-weight: 700; }
  .desc { font-weight: 800; color: #dc2626; font-size: 1rem; }
}
</style>
