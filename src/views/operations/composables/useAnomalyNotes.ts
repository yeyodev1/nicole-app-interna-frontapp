import { ref, computed, watch, effectScope } from 'vue';
import { posRestockService, type AnomalyNote } from '@/services/pos-restock.service';
import { useOperationsReport, type OpsProduct } from './useOperationsReport';

// Orden 2/3: comentarios de anomalías. Llamada aparte del reporte, una por cambio de fecha;
// no se guardan en el caché local del reporte.
const notes = ref<AnomalyNote[]>([]);
let started = false;

export const normKey = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function useAnomalyNotes() {
  const { date, dateTo } = useOperationsReport();
  const isRange = computed(() => date.value !== dateTo.value);

  const load = async () => {
    try {
      notes.value = await posRestockService.getAnomalyNotes(date.value, dateTo.value);
    } catch {
      notes.value = [];
    }
  };
  if (!started) {
    started = true;
    effectScope(true).run(() => watch([date, dateTo], load, { immediate: true }));
  }

  /** Notas de un producto en la sucursal (Orden 8: por código; si no, por nombre normalizado). */
  const notesOf = (branch: string, p: Pick<OpsProduct, 'name' | 'codigo'>) =>
    notes.value.filter(n =>
      n.branchKey === normKey(branch) &&
      ((p.codigo && n.codigo === p.codigo) || n.productKey === normKey(p.name) || normKey(n.productName) === normKey(p.name)));

  const save = async (branch: string, p: OpsProduct, comment: string) => {
    const saved = await posRestockService.saveAnomalyNote({
      branch, date: date.value, productName: p.name, descuadre: p.descuadre ?? 0, comment,
    });
    notes.value = [...notes.value.filter(n => n._id !== saved._id), saved];
  };

  return { notes, isRange, notesOf, save, reload: load };
}
