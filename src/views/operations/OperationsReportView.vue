<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { posRestockService } from '@/services/pos-restock.service';
import { getECTTodayString } from '@/utils/dateUtils';
import { useToast } from '@/composables/useToast';
import OperationsKpiRow from './components/OperationsKpiRow.vue';
import OperationsBranchCard from './components/OperationsBranchCard.vue';

const { error: showError } = useToast();

const isLoading = ref(false);
const report = ref<any | null>(null);
const date = ref(getECTTodayString());

const shiftDate = (base: string, days: number) => {
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(y!, m! - 1, d! + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const yesterday = computed(() => shiftDate(getECTTodayString(), -1));

const niceDate = computed(() => {
  const [y, m, d] = date.value.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
});

const fetchReport = async () => {
  isLoading.value = true;
  report.value = null;
  try {
    report.value = await posRestockService.getOperationsReport(date.value);
  } catch (err) {
    console.error(err);
    showError('No se pudo cargar el reporte. Inténtalo de nuevo.');
  } finally {
    isLoading.value = false;
  }
};

const setDate = (value: string) => {
  if (!value) return;
  date.value = value;
  fetchReport();
};

const globalTotals = computed(() => {
  const t = { vendido: 0, ventaCierre: 0, bajas: 0, descuadre: 0 };
  for (const b of report.value?.branches || []) {
    t.vendido += b.totals.vendido;
    t.ventaCierre += b.totals.ventaCierre;
    t.bajas += b.totals.bajas;
    t.descuadre += b.totals.descuadre;
  }
  return t;
});

onMounted(fetchReport);
</script>

<template>
  <div class="ops-page">
    <div class="container">
      <header class="ops-header">
        <div>
          <h1><i class="fa-solid fa-chart-line"></i> Reporte de Operaciones</h1>
          <p>Contífico y los datos internos, cruzados: qué se vendió, qué se dio de baja y qué no cuadra.</p>
        </div>
        <div class="date-controls">
          <button :class="{ active: date === getECTTodayString() }" @click="setDate(getECTTodayString())">Hoy</button>
          <button :class="{ active: date === yesterday }" @click="setDate(yesterday)">Ayer</button>
          <input type="date" :value="date" :max="getECTTodayString()" @change="setDate(($event.target as HTMLInputElement).value)" />
        </div>
      </header>

      <p class="nice-date"><i class="fa-regular fa-calendar"></i> {{ niceDate }}</p>

      <div v-if="isLoading" class="loading">
        <span class="spinner"></span>
        Cruzando los datos del día con Contífico... (puede tardar unos segundos)
      </div>

      <template v-else-if="report">
        <OperationsKpiRow
          :vendido="globalTotals.vendido"
          :venta-cierre="globalTotals.ventaCierre"
          :bajas="globalTotals.bajas"
          :descuadre="globalTotals.descuadre"
        />

        <div v-if="report.missingClosings?.length" class="missing-note">
          <i class="fa-solid fa-circle-exclamation"></i>
          Falta el cierre de: <strong>{{ report.missingClosings.map((m: any) => m.branch).join(', ') }}</strong> — sin cierre no se puede calcular el descuadre.
        </div>

        <div class="branches">
          <OperationsBranchCard
            v-for="b in report.branches"
            :key="b.branch"
            :branch="b.branch"
            :sales-available="b.salesAvailable"
            :has-closing="b.hasClosing"
            :totals="b.totals"
            :products="b.products"
            :losses="b.losses"
          />
        </div>

        <div v-if="report.branches.length === 0" class="empty">
          <i class="fa-solid fa-folder-open"></i>
          <p>No hay datos para este día.</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ops-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 1.5rem 1rem 4rem;
  font-family: 'Inter', -apple-system, sans-serif;
}

.container { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.25rem; }

.ops-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;

  h1 {
    margin: 0 0 0.3rem;
    font-size: 1.5rem;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    i { color: #7c3aed; }
  }

  p { margin: 0; color: #64748b; font-size: 0.9rem; max-width: 520px; }
}

.date-controls {
  display: flex;
  gap: 0.4rem;
  align-items: center;

  button {
    padding: 0.55rem 1.1rem;
    border-radius: 10px;
    border: 1.5px solid #e2e8f0;
    background: white;
    color: #475569;
    font-weight: 800;
    font-size: 0.85rem;
    cursor: pointer;
    &.active { background: #0f172a; border-color: #0f172a; color: white; }
  }

  input {
    padding: 0.5rem 0.7rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.85rem;
    color: #0f172a;
    background: white;
    &:focus { outline: none; border-color: #7c3aed; }
  }
}

.nice-date {
  margin: -0.5rem 0 0;
  color: #7c3aed;
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: capitalize;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  padding: 4rem 1rem;
  color: #64748b;
  font-weight: 600;

  .spinner {
    width: 26px; height: 26px; border: 3px solid #e2e8f0;
    border-top-color: #7c3aed; border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }

.missing-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #f59e0b;
  color: #92400e;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-size: 0.86rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.branches { display: flex; flex-direction: column; gap: 1.25rem; }

.empty {
  text-align: center;
  padding: 4rem 1rem;
  color: #94a3b8;
  i { font-size: 3rem; opacity: 0.4; margin-bottom: 0.75rem; }
  p { font-weight: 600; }
}
</style>
