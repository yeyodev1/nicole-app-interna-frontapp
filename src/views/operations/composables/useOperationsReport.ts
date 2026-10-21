import { ref, computed } from 'vue';
import { posRestockService } from '@/services/pos-restock.service';
import { getECTTodayString } from '@/utils/dateUtils';

export interface OpsProduct {
  name: string;
  vendido: number | null;
  ventaCierre: number | null;
  bajas: number;
  recibido: number;
  stockFinal: number | null;
  pedidoFinal: number;
  descuadre: number | null;
}

export interface OpsBranch {
  branch: string;
  salesAvailable: boolean;
  hasClosing: boolean;
  totals: { vendido: number; ventaCierre: number; bajas: number; recibido: number; descuadre: number };
  products: OpsProduct[];
  losses: Array<{ productName: string; quantity: number; reason: string; category: string }>;
}

// ── Estado compartido entre las vistas de Operaciones (singleton) ──────────
// Una sola carga por fecha: cambiar de sección en el sidebar es instantáneo.
const date = ref(getECTTodayString());
const report = ref<any | null>(null);
const isLoading = ref(false);
const elapsed = ref(0);
const cache = new Map<string, any>();
let timer: ReturnType<typeof setInterval> | null = null;

const fetchReport = async (force = false) => {
  const key = date.value;
  if (!force && cache.has(key)) {
    report.value = cache.get(key);
    return;
  }
  isLoading.value = true;
  report.value = null;
  elapsed.value = 0;
  if (timer) clearInterval(timer);
  timer = setInterval(() => { elapsed.value++; }, 1000);
  try {
    const data = await posRestockService.getOperationsReport(key);
    cache.set(key, data);
    // Si mientras cargaba cambiaron de fecha, no pisar
    if (date.value === key) report.value = data;
  } catch (err) {
    console.error('Error cargando reporte de operaciones:', err);
    if (date.value === key) report.value = { date: key, branches: [], missingClosings: [], error: true };
  } finally {
    if (timer) { clearInterval(timer); timer = null; }
    isLoading.value = false;
  }
};

const setDate = (value: string) => {
  if (!value || value === date.value) return;
  date.value = value;
  fetchReport();
};

export function useOperationsReport() {
  const branches = computed<OpsBranch[]>(() => report.value?.branches || []);

  const globalTotals = computed(() => {
    const t = { vendido: 0, ventaCierre: 0, bajas: 0, descuadre: 0 };
    for (const b of branches.value) {
      t.vendido += b.totals.vendido;
      t.ventaCierre += b.totals.ventaCierre;
      t.bajas += b.totals.bajas;
      t.descuadre += b.totals.descuadre;
    }
    return t;
  });

  // Todas las bajas del día, con su sucursal
  const allLosses = computed(() =>
    branches.value.flatMap(b => b.losses.map(l => ({ ...l, branch: b.branch })))
  );

  // Solo lo que no cuadra, con su sucursal, lo más grave primero
  const discrepancies = computed(() =>
    branches.value
      .flatMap(b => b.products
        .filter(p => (p.descuadre ?? 0) !== 0)
        .map(p => ({ ...p, branch: b.branch })))
      .sort((a, b) => Math.abs(b.descuadre ?? 0) - Math.abs(a.descuadre ?? 0))
  );

  const missingClosings = computed(() => report.value?.missingClosings || []);
  const hasError = computed(() => !!report.value?.error);

  const ensureLoaded = () => {
    if (!report.value && !isLoading.value) fetchReport();
  };

  return {
    date, report, isLoading, elapsed,
    fetchReport, setDate, ensureLoaded,
    branches, globalTotals, allLosses, discrepancies, missingClosings, hasError,
  };
}
