import { ref, computed, type Ref } from 'vue';
import { posRestockService, type DailyFormData, type DailySales, type DetailedLoss } from '@/services/pos-restock.service';

/** Motivo que se guarda cuando la baja se escribe directo en el número (sin modal). */
export const QUICK_LOSS_REASON = 'Baja registrada en el cierre';

const CLOSER_NAME_KEY = 'pos-closing-name';

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export interface ClosingGroup {
  key: string;
  label: string;
  icon: string;
  items: RestockItemData[];
  pedidos: number; // cuántos ítems del grupo ya tienen pedido > 0
}

export interface RestockItemData {
  productName: string;
  unit: string;
  isGeneral: boolean;
  requiresMinimum: boolean;
  category: 'Producción' | 'Bodega';
  contificoCategory: string | null;
  stockObjectiveTomorrow: number;
  stockObjectiveToday: number;
  bajas: number;
  excedente: number;
  detailedLosses: DetailedLoss[];
  pedidoOverride: number | null;
}

/**
 * Lógica compartida del cierre de producción (página y modal):
 * carga del formulario, venta del día desde Contífico, bajas rápidas,
 * pedido manual (ya no existe pedido sugerido) y armado del payload.
 */
export function useDailyClosing(branch: Ref<string>) {
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const formData = ref<DailyFormData | null>(null);
  const formItems = ref<RestockItemData[]>([]);
  const hasExistingEntry = ref(false);

  // Venta del día según Contífico (se carga aparte: tarda unos segundos)
  const sales = ref<DailySales | null>(null);
  const salesLoading = ref(false);

  const fetchDailyForm = async () => {
    isLoading.value = true;
    formData.value = null;
    formItems.value = [];
    hasExistingEntry.value = false;
    try {
      const data = await posRestockService.getDailyForm(branch.value);
      formData.value = data;
      const today = data.formDate;

      formItems.value = (data.items || []).map(item => {
        const isToday = !!item.lastEntry && item.lastEntry.date === today;
        if (isToday) hasExistingEntry.value = true;

        return {
          productName: item.productName,
          unit: item.unit,
          isGeneral: item.isGeneral || false,
          requiresMinimum: item.requiresMinimum || false,
          category: item.category || 'Producción',
          contificoCategory: item.contificoCategory || null,
          stockObjectiveTomorrow: item.stockObjectiveTomorrow,
          stockObjectiveToday: item.stockObjectiveToday,
          bajas: (isToday && item.lastEntry) ? item.lastEntry.bajas : 0,
          excedente: (isToday && item.lastEntry) ? item.lastEntry.stockFinal : 0,
          detailedLosses: (isToday && item.lastEntry) ? (item.lastEntry.detailedLosses || []) : [],
          // Sin sugeridos ni precargas: el pedido SIEMPRE arranca en 0 y la
          // encargada escribe exactamente lo que necesita en cada envío.
          pedidoOverride: null,
        };
      });
    } finally {
      isLoading.value = false;
    }
  };

  const fetchDailySales = async () => {
    salesLoading.value = true;
    sales.value = null;
    try {
      sales.value = await posRestockService.getDailySales(branch.value);
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      sales.value = null;
    } finally {
      salesLoading.value = false;
    }
  };

  // Porciones vendidas hoy según Contífico; null = sin dato (suministro o Contífico caído)
  const getVendido = (item: RestockItemData): number | null => {
    if (item.isGeneral) return null;
    if (!sales.value || !sales.value.available) return null;
    return sales.value.products[item.productName] ?? 0;
  };

  // El pedido es exactamente lo que escribe la encargada.
  const getFinalPedido = (item: RestockItemData): number =>
    item.pedidoOverride !== null && item.pedidoOverride >= 0 ? item.pedidoOverride : 0;

  // Si hay bajas detalladas desde el modal, el número se edita solo ahí para no pisarlas.
  const hasModalLosses = (item: RestockItemData): boolean =>
    item.detailedLosses.some(l => l.reason !== QUICK_LOSS_REASON);

  const handleQuickBajas = (item: RestockItemData, value: string) => {
    if (hasModalLosses(item)) return;
    const qty = value === '' ? 0 : Math.max(0, Number(value));
    item.bajas = qty;
    item.detailedLosses = qty > 0
      ? [{ quantity: qty, reason: QUICK_LOSS_REASON, category: 'Other' as const }]
      : [];
  };

  // --- Quién realiza el cierre (se recuerda en el dispositivo) ---
  const submittedBy = ref('');
  try {
    submittedBy.value = localStorage.getItem(CLOSER_NAME_KEY) || '';
  } catch { /* almacenamiento bloqueado: se pedirá el nombre igual */ }

  const setSubmittedBy = (name: string) => {
    submittedBy.value = name.trim();
    try {
      localStorage.setItem(CLOSER_NAME_KEY, submittedBy.value);
    } catch { /* no pasa nada: solo no se recuerda para la próxima */ }
  };

  // --- Buscador + grupos por categoría (la lista crece mucho) ---
  const searchQuery = ref('');

  const groupedItems = computed<ClosingGroup[]>(() => {
    const q = norm(searchQuery.value);
    const filtered = q
      ? formItems.value.filter(i => norm(i.productName).includes(q))
      : formItems.value;

    // Secciones con la categoría tal cual Contífico; los suministros manuales
    // van en su propio grupo y lo sin categoría en "Otros" (al final).
    const groups = new Map<string, ClosingGroup>();
    for (const item of filtered) {
      const label = item.isGeneral ? 'Suministros' : (item.contificoCategory || 'Otros');
      const key = norm(label);
      let group = groups.get(key);
      if (!group) {
        const icon = item.isGeneral ? 'fa-box-open' : (item.contificoCategory ? 'fa-tag' : 'fa-circle-question');
        group = { key, label, icon, items: [], pedidos: 0 };
        groups.set(key, group);
      }
      group.items.push(item);
      if (getFinalPedido(item) > 0) group.pedidos++;
    }

    const LAST = ['otros', 'suministros'];
    return Array.from(groups.values()).sort((a, b) => {
      const la = LAST.indexOf(a.key), lb = LAST.indexOf(b.key);
      if (la !== -1 || lb !== -1) return (la === -1 ? -1 : la + 1) - (lb === -1 ? -1 : lb + 1);
      return a.label.localeCompare(b.label);
    });
  });

  // Producto agregado al vuelo desde el buscador del modal. false = ya estaba.
  const addQuickItem = (p: any): boolean => {
    if (formItems.value.some(i => i.productName === p.productName)) return false;
    formItems.value.unshift({
      productName: p.productName,
      unit: p.unit,
      isGeneral: p.isGeneral,
      requiresMinimum: p.requiresMinimum || false,
      category: p.category || 'Producción',
      contificoCategory: p.contificoCategory || null,
      stockObjectiveTomorrow: 0,
      stockObjectiveToday: 0,
      bajas: 0,
      excedente: 0,
      detailedLosses: [],
      pedidoOverride: null,
    });
    return true;
  };

  // --- Modal de bajas detalladas ---
  const showLossModal = ref(false);
  const activeProductForLoss = ref<RestockItemData | null>(null);

  const openLossModal = (item: RestockItemData) => {
    activeProductForLoss.value = item;
    showLossModal.value = true;
  };

  const handleSaveLosses = (losses: DetailedLoss[]) => {
    if (activeProductForLoss.value) {
      activeProductForLoss.value.detailedLosses = losses;
      activeProductForLoss.value.bajas = losses.reduce((sum, l) => sum + l.quantity, 0);
    }
    showLossModal.value = false;
    activeProductForLoss.value = null;
  };

  // --- Pedidos que superan el stock mínimo diario ---
  const overriddenItems = computed(() =>
    formItems.value.filter(
      item => !item.isGeneral && item.pedidoOverride !== null && item.pedidoOverride > item.stockObjectiveTomorrow
    )
  );
  const hasExcessiveOverride = computed(() => overriddenItems.value.length > 0);

  const confirmMessage = computed(() =>
    hasExcessiveOverride.value
      ? ''
      : '¿Confirmas el envío del reporte? Los pedidos se generarán al instante y cocina los verá de inmediato.'
  );

  const confirmMessageHtml = computed(() => {
    if (!hasExcessiveOverride.value) return undefined;

    const items = overriddenItems.value.map(i => `
      <li style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0.75rem;background:white;border:1px solid #fecdd3;border-radius:8px;margin-bottom:6px;">
        <span style="font-weight:700;color:#1e293b;font-size:0.88rem;">${i.productName}</span>
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="color:#94a3b8;font-size:0.78rem;">mín: ${i.stockObjectiveTomorrow}</span>
          <span style="color:#cbd5e1;">→</span>
          <span style="font-weight:900;color:#be123c;font-size:1rem;">${i.pedidoOverride}</span>
          <span style="background:#be123c;color:white;font-size:0.68rem;font-weight:800;padding:1px 7px;border-radius:10px;">+${i.pedidoOverride! - i.stockObjectiveTomorrow}</span>
        </span>
      </li>
    `).join('');

    return `
      <div style="margin:-0.1rem 0 0.25rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;background:#fff1f2;border:1px solid #fda4af;border-left:4px solid #be123c;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.85rem;color:#be123c;font-weight:700;font-size:0.88rem;">
          <i class="fa-solid fa-circle-exclamation" style="font-size:1rem;"></i>
          Pedidos fuera del stock mínimo diario
        </div>
        <ul style="list-style:none;padding:0;margin:0 0 0.85rem 0;">${items}</ul>
        <p style="font-size:0.78rem;color:#94a3b8;margin:0;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:0.65rem;">
          <i class="fa-solid fa-hand" style="color:#be123c;margin-right:4px;"></i>
          Mantén presionado el botón de confirmación para aceptar estos pedidos.
        </p>
      </div>
    `;
  });

  // Payload del POST /pos/restock/daily-entry. `rounds` viene del paso de
  // distribución del modal; la página lo envía sin rondas.
  const buildPayload = (rounds?: Array<{ productName: string; deliveryRounds: Array<{ label: string; quantity: number }> }>) => ({
    branch: branch.value,
    date: formData.value!.formDate,
    submittedBy: submittedBy.value || 'POS User',
    items: formItems.value.map(item => ({
      productName: item.productName,
      unit: item.unit,
      isGeneral: item.isGeneral,
      category: item.category,
      bajas: item.bajas,
      stockFinal: item.excedente,
      pedidoFinal: getFinalPedido(item),
      detailedLosses: item.detailedLosses,
      deliveryRounds: rounds?.find(r => r.productName === item.productName)?.deliveryRounds || [],
    })),
  });

  return {
    isLoading, isSubmitting, formData, formItems, hasExistingEntry,
    sales, salesLoading,
    fetchDailyForm, fetchDailySales,
    getVendido, getFinalPedido, hasModalLosses, handleQuickBajas, addQuickItem,
    submittedBy, setSubmittedBy, searchQuery, groupedItems,
    showLossModal, activeProductForLoss, openLossModal, handleSaveLosses,
    overriddenItems, hasExcessiveOverride, confirmMessage, confirmMessageHtml,
    buildPayload,
  };
}
