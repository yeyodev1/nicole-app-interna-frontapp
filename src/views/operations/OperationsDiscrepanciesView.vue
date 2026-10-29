<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOperationsReport } from './composables/useOperationsReport';
import OperationsShell from './components/OperationsShell.vue';

const { discrepancies, branches } = useOperationsReport();

const search = ref('');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const filtered = computed(() =>
  discrepancies.value.filter(d => !search.value
    || norm(d.name).includes(norm(search.value))
    || norm(d.branch).includes(norm(search.value))
    || norm((d as any).categoria || '').includes(norm(search.value)))
);

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
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" type="text" placeholder="Buscar producto, sucursal o categoría..." />
        <button v-if="search" @click="search = ''"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="legend">
        La cuenta del día por producto: <strong>empezó + llegó − vendido (isla, combos, Casa Mía, Dela Cream) − bajas = debería quedar</strong>, y se compara con lo que la sucursal contó al cierre.
        <span class="pill minus">− falta</span> quedó menos de lo que debería (producto perdido o vendido sin factura)
        <span class="pill plus">+ sobra</span> quedó más de lo que debería (recepción sin registrar o error de conteo)
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
              <th title="Con cuánto empezó el día (cierre anterior)">Stock inicial</th>
              <th title="Despachado por producción + OK de Recepción Masiva">Recibido</th>
              <th title="Isla + combos + Casa Mía + Dela Cream">Vendido</th>
              <th>Bajas</th>
              <th title="inicial + recibido − vendido − bajas">Debería quedar</th>
              <th title="Stock en isla: lo que contó la sucursal al cierre">Quedó (isla)</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, i) in filtered" :key="i">
              <td class="t-left pname">
                {{ d.name }}
                <span v-if="d.categoria" class="cat-chip">{{ d.categoria }}</span>
              </td>
              <td class="t-left branch"><i class="fa-solid fa-store"></i> {{ d.branch }}</td>
              <td>{{ d.inicial ?? '—' }}</td>
              <td>
                {{ d.recibido || '' }}
                <span v-if="d.recibidoSinOk > 0" class="sin-ok" :title="`${d.recibidoSinOk} unids despachadas por producción sin el OK de Recepción Masiva`">
                  ⚠ {{ d.recibidoSinOk }} sin OK
                </span>
              </td>
              <td :title="d.ventas ? `Isla ${d.ventas.isla} · Combo ${d.ventas.combo} · Casa Mía ${d.ventas.casaMia} · Dela Cream ${d.ventas.delaCrem}` : ''">{{ d.vendido ?? '—' }}</td>
              <td>{{ d.bajas || '' }}</td>
              <td class="should">{{ d.deberiaQuedar ?? '—' }}</td>
              <td>{{ d.quedo ?? '—' }}</td>
              <td class="desc" :class="(d.descuadre ?? 0) < 0 ? 'neg' : 'pos'">
                <span class="desc-num">{{ (d.descuadre ?? 0) > 0 ? `+${d.descuadre}` : d.descuadre }}</span>
                <span class="desc-word">{{ (d.descuadre ?? 0) < 0 ? 'falta' : 'sobra' }}</span>
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="9" class="empty-row">Sin resultados para «{{ search }}»</td>
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

.search-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 1rem;
  max-width: 420px;

  &:focus-within { border-color: #7c3aed; }
  > i { color: #94a3b8; font-size: 0.9rem; }
  input { flex: 1; border: none; outline: none; padding: 0.75rem 0; font-size: 0.95rem; background: transparent; }
  button { background: #f1f5f9; border: none; color: #64748b; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; }
}

.cat-chip {
  display: inline-block;
  margin-left: 0.35rem;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  color: #6d28d9;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: 8px;
  vertical-align: middle;
}

.empty-row { padding: 1.5rem; color: #94a3b8; background: white !important; }

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

  .should { font-weight: 700; color: #475569; background: #f8fafc; }

  .sin-ok {
    display: block;
    font-size: 0.62rem;
    font-weight: 800;
    color: #d97706;
    white-space: nowrap;
  }

  // Negativo = rojo · Positivo (y cero) = verde
  .desc {
    font-weight: 800;
    font-size: 1rem;
    white-space: nowrap;

    .desc-num {
      display: inline-block;
      padding: 1px 10px;
      border-radius: 20px;
      font-size: 1.02rem;
    }

    &.neg { color: #b91c1c; .desc-num { background: #fee2e2; } }
    &.pos { color: #15803d; .desc-num { background: #dcfce7; } }

    .desc-word {
      display: block;
      font-size: 0.62rem;
      font-weight: 800;
      text-transform: uppercase;
      opacity: 0.8;
    }
  }
}
</style>
