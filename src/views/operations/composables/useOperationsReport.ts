import { ref, computed } from 'vue';
import { posRestockService } from '@/services/pos-restock.service';
import { getECTTodayString } from '@/utils/dateUtils';

export interface OpsProduct {
  name: string;
  categoria: string | null; // tal cual Contífico

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
// Además se guarda en el navegador: al volver a abrir, el día se muestra AL
// INSTANTE con lo guardado y se refresca por detrás (stale-while-revalidate).
const date = ref(getECTTodayString());
const report = ref<any | null>(null);
const isLoading = ref(false); // sin nada que mostrar (skeleton)
const isRefreshing = ref(false); // mostrando datos guardados mientras llega lo fresco
const elapsed = ref(0);
const cache = new Map<string, any>();
let timer: ReturnType<typeof setInterval> | null = null;

const LS_PREFIX = 'ops-report-';

const readStored = (key: string): any | null => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeStored = (key: string, data: any) => {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
    // Mantener solo los últimos 7 días guardados
    const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).sort();
    while (keys.length > 7) localStorage.removeItem(keys.shift()!);
  } catch { /* almacenamiento lleno o bloqueado: no pasa nada */ }
};

const fetchReport = async (force = false) => {
  const key = date.value;
  if (!force && cache.has(key)) {
    report.value = cache.get(key);
    return;
  }

  // Al instante: si hay versión guardada, se muestra ya y se refresca por detrás
  const stored = force ? null : readStored(key);
  if (stored) {
    report.value = stored;
    cache.set(key, stored);
    isRefreshing.value = true;
  } else {
    isLoading.value = true;
    report.value = null;
  }

  elapsed.value = 0;
  if (timer) clearInterval(timer);
  timer = setInterval(() => { elapsed.value++; }, 1000);
  try {
    const data = await posRestockService.getOperationsReport(key);
    cache.set(key, data);
    writeStored(key, data);
    // Si mientras cargaba cambiaron de fecha, no pisar
    if (date.value === key) report.value = data;
  } catch (err) {
    console.error('Error cargando reporte de operaciones:', err);
    // Con datos guardados en pantalla no se rompe nada; sin ellos, error visible
    if (date.value === key && !stored) {
      report.value = { date: key, branches: [], missingClosings: [], error: true };
    }
  } finally {
    if (timer) { clearInterval(timer); timer = null; }
    isLoading.value = false;
    isRefreshing.value = false;
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
    date, report, isLoading, isRefreshing, elapsed,
    fetchReport, setDate, ensureLoaded,
    branches, globalTotals, allLosses, discrepancies, missingClosings, hasError,
  };
}
