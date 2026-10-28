<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import POSService from '@/services/pos.service';
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { parseECTDate, getECTTodayString } from '@/utils/dateUtils';
import ReceptionDayTabs, { type ReceptionDayMode } from './ReceptionDayTabs.vue';

const props = defineProps<{
  isOpen: boolean;
  dispatches: any[]; // kept for compat but modal fetches its own data
  selectedBranch: string;
  branches: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
  (e: 'open-restock'): void;
  (e: 'change-branch', branch: string): void;
}>();

const isProcessing = ref(false);
const errorMessage = ref('');
const isLoadingData = ref(false);
const localBranch = ref(props.selectedBranch);

watch(() => props.selectedBranch, (v) => { localBranch.value = v });
watch(localBranch, (v) => {
  if (v !== props.selectedBranch) emit('change-branch', v);
  if (props.isOpen) fetchModalData();
});

const bulkNotes = ref('');
const filterMode = ref<ReceptionDayMode>('today');
const filterDate = ref(getECTTodayString()); // Día específico (filterMode = 'date')

watch([filterMode, filterDate], () => { if (props.isOpen) fetchModalData(); });

const selectedDateLabel = computed(() =>
  new Date(filterDate.value + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'long' })
);

// --- Options ---
const statusOptions = [
  { value: 'OK',            label: 'Bien (Todo OK)',        icon: 'fa-solid fa-circle-check' },
  { value: 'MISSING',       label: 'Novedad: Faltante',     icon: 'fa-solid fa-triangle-exclamation' },
  { value: 'DAMAGED',       label: 'Novedad: Dañado',       icon: 'fa-solid fa-circle-xmark' },
  { value: 'BAD_CONDITION', label: 'Mal estado (detallar)', icon: 'fa-solid fa-comment-dots' },
]

const branchOptions = computed(() => props.branches.map(b => ({ value: b, label: b })))

// --- Internal data ---
const internalDispatches = ref<any[]>([]);  // PENDING + PROBLEM
const alreadyReceived    = ref<any[]>([]);  // RECEIVED (history)

const fetchModalData = async () => {
  isLoadingData.value = true;
  try {
    // Pendiente = solo PENDING. PROBLEM ya se receptó (con novedad): va al historial.
    const [pending, received] = await Promise.all([
      POSService.getIncomingDispatches(localBranch.value, { filterMode: 'all', receptionStatus: ['PENDING'] }),
      POSService.getIncomingDispatches(
        localBranch.value,
        filterMode.value === 'date'
          ? { date: filterDate.value, receptionStatus: ['RECEIVED', 'PROBLEM'] }
          : { filterMode: filterMode.value, receptionStatus: ['RECEIVED', 'PROBLEM'] }
      ),
    ]);

    internalDispatches.value = pending.flatMap(o =>
      (o.dispatches || [])
        .filter((d: any) => d.receptionStatus === 'PENDING')
        .map((d: any) => ({ ...o, orderId: o._id, dispatch: d }))
    );

    alreadyReceived.value = received.flatMap(o =>
      (o.dispatches || [])
        .filter((d: any) => ['RECEIVED', 'PROBLEM'].includes(d.receptionStatus))
        .map((d: any) => ({ ...o, orderId: o._id, dispatch: d }))
    );

    calculateConsolidated();
  } catch (e) {
    console.error('Error fetching modal data:', e);
  } finally {
    isLoadingData.value = false;
  }
};

// --- CONSOLIDATED LOGIC ---
interface ConsolidatedItem {
  productId: string;
  name: string;
  totalSent: number;
  quantityReceived: number;
  itemStatus: 'OK' | 'MISSING' | 'DAMAGED' | 'BAD_CONDITION';
  itemNote: string;
  sources: { orderId: string; dispatchId: string; quantitySent: number; productId: string; }[];
  deliveryRounds: string[]; // e.g. ['Primera Entrega', 'Segunda Entrega']
}

const consolidatedItems = ref<ConsolidatedItem[]>([]);

// Received history consolidated
interface ReceivedHistoryItem { name: string; quantityReceived: number; itemStatus: string; }
const receivedHistory = computed<ReceivedHistoryItem[]>(() => {
  const map = new Map<string, ReceivedHistoryItem>();
  alreadyReceived.value.forEach(d => {
    (d.dispatch.items || []).forEach((item: any) => {
      const key = item.productId || item.name;
      if (!map.has(key)) map.set(key, { name: item.name, quantityReceived: 0, itemStatus: item.itemStatus || 'OK' });
      map.get(key)!.quantityReceived += item.quantityReceived ?? item.quantitySent ?? 0;
    });
  });
  return Array.from(map.values());
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    bulkNotes.value = '';
    showReceipt.value = false;
    errorMessage.value = '';
    filterMode.value = 'today';
    fetchModalData();
  }
});

const getDStr = (d: Date) => d.toISOString().slice(0, 10);
const isRestockOrder = (d: any) => d.salesChannel === 'Restock' || d.salesChannel === 'Restock-Bodega';

// ¿El despacho pendiente entra en el día que se está viendo?
const matchesSelectedDay = (d: any): boolean => {
  if (!d.deliveryDate) return false;
  const dDateStr = getDStr(parseECTDate(d.deliveryDate));
  const today = new Date(getECTTodayString() + 'T12:00:00');
  const shift = (n: number) => { const x = new Date(today); x.setDate(today.getDate() + n); return getDStr(x); };

  if (filterMode.value === 'date') return dDateStr === filterDate.value;
  if (filterMode.value === 'yesterday') return dDateStr === shift(-1);
  if (filterMode.value === 'tomorrow') return dDateStr === shift(1);
  // Hoy: lo de hoy + la reposición pedida en el cierre de anoche (llega en la
  // mañana). La de otros días sale en SU fecha (ej. cierres de prueba).
  return dDateStr === shift(0) || (isRestockOrder(d) && dDateStr === shift(-1));
};

const calculateConsolidated = () => {
  const map = new Map<string, ConsolidatedItem>();

  internalDispatches.value.forEach(d => {
    if (!matchesSelectedDay(d)) return;
    const isRestock = isRestockOrder(d);

    const roundLabel = isRestock && d.comments ? (d.comments as string) : null;

    d.dispatch.items.forEach((item: any) => {
      const key = item.name;
      if (!map.has(key)) {
        map.set(key, { productId: String(item.productId), name: item.name, totalSent: 0, quantityReceived: 0, itemStatus: 'OK', itemNote: '', sources: [], deliveryRounds: [] });
      }
      const entry = map.get(key)!;
      entry.totalSent        += item.quantitySent;
      entry.quantityReceived += item.quantitySent;
      entry.sources.push({ orderId: d.orderId, dispatchId: d.dispatch._id, quantitySent: item.quantitySent, productId: String(item.productId) });
      if (roundLabel && !entry.deliveryRounds.includes(roundLabel)) {
        entry.deliveryRounds.push(roundLabel);
      }
    });
  });

  consolidatedItems.value = Array.from(map.values());
};

// ── Receipt state ──────────────────────────────────────────────────────────
interface ReceiptItem {
  name: string;
  totalSent: number;
  quantityReceived: number;
  itemStatus: string;
  itemNote: string;
}

const showReceipt = ref(false);
const receiptSnapshot = ref<ReceiptItem[]>([]);
const receiptNotes = ref('');
const receiptBranch = ref('');
const receiptDate = ref('');

const statusLabel: Record<string, { label: string; icon: string; color: string }> = {
  OK:            { label: 'Todo OK',        icon: 'fa-solid fa-circle-check',          color: '#16a34a' },
  MISSING:       { label: 'Faltante',       icon: 'fa-solid fa-triangle-exclamation',  color: '#d97706' },
  DAMAGED:       { label: 'Dañado',         icon: 'fa-solid fa-circle-xmark',          color: '#dc2626' },
  BAD_CONDITION: { label: 'Mal estado',     icon: 'fa-solid fa-comment-dots',          color: '#be123c' },
};

const handleConfirm = async () => {
  if (consolidatedItems.value.length === 0) return;
  isProcessing.value = true;

  const dispatchUpdates = new Map<string, {
    orderId: string;
    items: { productId: string; quantityReceived: number; itemStatus: string; itemNote?: string }[];
  }>();

  consolidatedItems.value.forEach(cItem => {
    let remaining = cItem.quantityReceived;
    cItem.sources.forEach(source => {
      if (!dispatchUpdates.has(source.dispatchId)) {
        dispatchUpdates.set(source.dispatchId, { orderId: source.orderId, items: [] });
      }
      const update = dispatchUpdates.get(source.dispatchId)!;
      let allocated = 0;
      let status    = cItem.itemStatus as string;

      if (remaining >= source.quantitySent) {
        allocated  = source.quantitySent;
        remaining -= source.quantitySent;
      } else {
        allocated = remaining;
        remaining = 0;
        if (allocated < source.quantitySent && status === 'OK') status = 'MISSING';
      }

      update.items.push({
        productId: source.productId,
        quantityReceived: allocated,
        itemStatus: status,
        ...(cItem.itemNote ? { itemNote: cItem.itemNote } : {})
      });
    });
  });

  errorMessage.value = '';
  // Secuencial: varios despachos pueden vivir en el mismo pedido y guardarlos
  // en paralelo hace chocar las escrituras en Mongo (se perdían recepciones).
  const failed: string[] = [];
  for (const [dispatchId, data] of dispatchUpdates.entries()) {
    try {
      await POSService.confirmReception(data.orderId, dispatchId, {
        receivedBy: 'Encargado POS (Masivo)',
        receptionNotes: bulkNotes.value || 'Recepción Masiva General',
        items: data.items
      });
      const orderData = internalDispatches.value.find(d => d.orderId === data.orderId);
      // Solo los pedidos de clientes se liquidan en isla. Una reposición interna
      // no se "factura en isla" ni se marca entregada: queda RECIBIDA y ya.
      const isRestockOrder = orderData?.salesChannel === 'Restock' || orderData?.salesChannel === 'Restock-Bodega';
      if (orderData?.branch && !isRestockOrder) {
        try { await POSService.settleInIsland(data.orderId, orderData.branch); }
        catch (e) { console.warn(`Non-blocking settle error for ${data.orderId}:`, e); }
      }
    } catch (error) {
      console.error(`Bulk reception error (dispatch ${dispatchId}):`, error);
      failed.push(dispatchId);
    }
  }

  if (failed.length > 0) {
    // Nada de éxito falso: se avisa y se recarga para ver qué quedó pendiente.
    errorMessage.value = `No se pudo confirmar la recepción de ${failed.length} envío(s). Revisa la lista: lo que siga pendiente, vuelve a confirmarlo.`;
    await fetchModalData();
    isProcessing.value = false;
    return;
  }

  // Store snapshot and show receipt
  receiptSnapshot.value = consolidatedItems.value.map(i => ({
    name: i.name,
    totalSent: i.totalSent,
    quantityReceived: i.quantityReceived,
    itemStatus: i.itemStatus,
    itemNote: i.itemNote,
  }));
  receiptNotes.value = bulkNotes.value;
  receiptBranch.value = localBranch.value;
  receiptDate.value = new Date().toLocaleString('es-EC', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  showReceipt.value = true;
  // success is emitted when user closes the receipt, not here
  isProcessing.value = false;
};

const handleEditReceipt = () => {
  showReceipt.value = false;
};

watch(() => props.isOpen, (v) => {
  if (!v) { showReceipt.value = false; }
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">

      <!-- ── Header ── -->
      <div class="modal-header">
        <div class="header-text">
          <h3><i class="fa-solid fa-boxes-stacked"></i> Recepción Masiva</h3>
          <div class="branch-row">
            <span class="branch-label">Recibiendo en:</span>
            <div class="branch-select-wrap">
              <SearchableSelect
                v-model="localBranch"
                :options="branchOptions"
                placeholder="Sucursal..."
                searchPlaceholder="Buscar sucursal..."
              >
                <template #icon><i class="fa-solid fa-store branch-icon"></i></template>
              </SearchableSelect>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-restock-shortcut" @click="emit('open-restock')">
            <i class="fa-solid fa-clipboard-check"></i>
            <span>Hacer Reposición</span>
          </button>
          <button class="btn-close" @click="$emit('close')">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>

      <!-- ── Receipt (post-confirmation) ── -->
      <div v-if="showReceipt" class="receipt-view">
        <div class="receipt-header">
          <div class="receipt-check"><i class="fa-solid fa-circle-check"></i></div>
          <h3>¡Recepción registrada!</h3>
          <p class="receipt-meta">
            <i class="fa-solid fa-store"></i> {{ receiptBranch }}
            &nbsp;·&nbsp;
            <i class="fa-solid fa-clock"></i> {{ receiptDate }}
          </p>
        </div>

        <div class="receipt-items">
          <div
            v-for="item in receiptSnapshot"
            :key="item.name"
            class="receipt-item"
            :class="{ 'has-issue': item.itemStatus !== 'OK' }"
          >
            <div class="receipt-item-left">
              <i :class="statusLabel[item.itemStatus]?.icon" :style="{ color: statusLabel[item.itemStatus]?.color }"></i>
              <div class="receipt-item-info">
                <span class="receipt-item-name">{{ item.name }}</span>
                <span v-if="item.itemNote" class="receipt-item-note">{{ item.itemNote }}</span>
              </div>
            </div>
            <div class="receipt-item-qty">
              <span class="qty-received">{{ item.quantityReceived }}</span>
              <span class="qty-slash">/</span>
              <span class="qty-sent">{{ item.totalSent }} env.</span>
            </div>
          </div>
        </div>

        <div v-if="receiptNotes" class="receipt-notes">
          <i class="fa-solid fa-comment-dots"></i>
          <span>{{ receiptNotes }}</span>
        </div>

        <div class="receipt-actions">
          <button class="btn-edit-receipt" @click="handleEditReceipt">
            <i class="fa-solid fa-pen-to-square"></i> Editar recepción
          </button>
          <button class="btn-close-receipt" @click="emit('success'); emit('close')">
            <i class="fa-solid fa-check"></i> Cerrar
          </button>
        </div>
      </div>

      <!-- ── Body ── -->
      <div v-else class="modal-body">

        <!-- Loading overlay -->
        <div v-if="isLoadingData" class="branch-loading">
          <div class="branch-spinner"></div>
          <span>Cargando envíos...</span>
        </div>

        <!-- Filter tabs -->
        <ReceptionDayTabs
          v-else
          v-model:mode="filterMode"
          v-model:date="filterDate"
        />

        <!-- Empty -->
        <div v-if="!isLoadingData && consolidatedItems.length === 0" class="empty-msg">
          <template v-if="receivedHistory.length > 0 && filterMode === 'today'">
            <!-- Already received today -->
            <div class="already-received-header">
              <i class="fa-solid fa-circle-check"></i>
              <div>
                <strong>¡Todo recibido hoy!</strong>
                <span>Se registró la recepción de estos productos en <strong>{{ localBranch }}</strong>.</span>
              </div>
            </div>
            <div class="already-received-list">
              <div v-for="item in receivedHistory" :key="item.name" class="already-received-item">
                <div class="ar-item-left">
                  <i
                    :class="statusLabel[item.itemStatus]?.icon || 'fa-solid fa-circle-check'"
                    :style="{ color: statusLabel[item.itemStatus]?.color || '#16a34a' }"
                  ></i>
                  <span class="ar-item-name">{{ item.name }}</span>
                </div>
                <span class="ar-item-qty">× {{ item.quantityReceived }}</span>
              </div>
            </div>
            <div class="locked-notice">
              <i class="fa-solid fa-lock"></i>
              <span>Una recepción confirmada <strong>no se puede editar</strong>. Si hubo una novedad, quedó registrada con su estado.</span>
            </div>
          </template>
          <template v-else>
            <i class="fa-solid fa-check-circle"></i>
            <p v-if="filterMode === 'today'">No hay envíos pendientes para <strong>HOY</strong>.</p>
            <p v-else-if="filterMode === 'yesterday'">No hay ítems para <strong>AYER</strong>.</p>
            <p v-else-if="filterMode === 'date'">No hay ítems para el <strong>{{ selectedDateLabel }}</strong>.</p>
            <p v-else>No hay ítems para <strong>MAÑANA</strong>.</p>
            <div v-if="filterMode === 'today'" class="empty-hint">
              <i class="fa-solid fa-circle-info"></i>
              <span>Puede que producción aún no haya marcado ningún envío como <strong>enviado</strong> hacia esta sucursal, o que todo ya fue recibido.</span>
            </div>
          </template>
          <button v-if="filterMode === 'today'" class="btn-restock-empty" @click="emit('open-restock')">
            <i class="fa-solid fa-clipboard-check"></i>
            Hacer Cierre de Producción (Reposición)
          </button>
        </div>

        <!-- Items list (normal: PENDING dispatches) -->
        <div v-else-if="!isLoadingData && consolidatedItems.length > 0" class="items-list">
          <div class="list-header">
            <span>Producto</span>
            <span class="col-right">Enviado / Recibido</span>
            <span class="col-status">Estado Físico</span>
          </div>

          <div
            v-for="item in consolidatedItems"
            :key="item.productId"
            class="item-row"
            :class="{
              'has-issue':  item.quantityReceived !== item.totalSent || item.itemStatus !== 'OK',
              'is-bad':     item.itemStatus === 'BAD_CONDITION'
            }"
          >
            <!-- Top: name + qty -->
            <div class="item-main">
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <div v-if="item.deliveryRounds.length > 0" class="round-badges">
                  <span v-for="round in item.deliveryRounds" :key="round" class="round-badge">
                    <i class="fa-solid fa-truck-ramp-box"></i> {{ round }}
                  </span>
                </div>
                <div v-if="item.quantityReceived !== item.totalSent" class="diff-badge">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span v-if="item.quantityReceived < item.totalSent">
                    Faltan {{ item.totalSent - item.quantityReceived }}
                  </span>
                  <span v-else>Sobran {{ item.quantityReceived - item.totalSent }}</span>
                </div>
              </div>

              <div class="item-qty-block">
                <div class="sent-count">
                  <span class="sent-label">Env.</span>
                  <strong>{{ item.totalSent }}</strong>
                </div>
                <div class="qty-control">
                  <button tabindex="-1" @click="item.quantityReceived = Math.max(0, item.quantityReceived - 1)">−</button>
                  <input type="number" v-model="item.quantityReceived" min="0" />
                  <button tabindex="-1" @click="item.quantityReceived++">+</button>
                </div>
              </div>
            </div>

            <!-- Bottom: status select + note -->
            <div class="item-status-block">
              <div class="status-select-wrap" :class="item.itemStatus.toLowerCase()">
                <SearchableSelect
                  v-model="item.itemStatus"
                  :options="statusOptions"
                  placeholder="Estado..."
                  searchPlaceholder="Buscar estado..."
                >
                  <template #icon>
                    <i v-if="item.itemStatus === 'OK'"            class="fa-solid fa-circle-check status-icon ok"></i>
                    <i v-else-if="item.itemStatus === 'MISSING'"  class="fa-solid fa-triangle-exclamation status-icon missing"></i>
                    <i v-else-if="item.itemStatus === 'DAMAGED'"  class="fa-solid fa-circle-xmark status-icon damaged"></i>
                    <i v-else                                      class="fa-solid fa-comment-dots status-icon bad"></i>
                  </template>
                </SearchableSelect>
              </div>

              <Transition name="slide-note">
                <div v-if="item.itemStatus === 'BAD_CONDITION'" class="note-field">
                  <i class="fa-solid fa-pen-to-square note-icon"></i>
                  <input
                    v-model="item.itemNote"
                    type="text"
                    placeholder="Ej: llegó mal glaseado, deformado..."
                    class="note-input"
                  />
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- General notes -->
        <div class="notes-section">
          <label><i class="fa-solid fa-comment-dots"></i> Observaciones Generales:</label>
          <input
            type="text"
            v-model="bulkNotes"
            placeholder="Alguna observación general para este lote..."
          />
        </div>

      </div>

      <!-- Error de confirmación -->
      <div v-if="errorMessage && !showReceipt" class="confirm-error-banner">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- ── Footer ── -->
      <div v-if="!showReceipt" class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <div class="hold-btn-container">
          <HoldConfirmButton
            :label="isProcessing ? 'Confirmando recepción…' : 'Confirmar Recepción Masiva'"
            @confirmed="handleConfirm"
            :disabled="isProcessing || isLoadingData || consolidatedItems.length === 0"
            color="#7C3AED"
          />
        </div>
      </div>

    </div>
  </div>
</template>

<style lang="scss" scoped>
// ─── Overlay & shell ──────────────────────────────────────────────────────────
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1200;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  width: 90%;
  max-width: 820px;
  max-height: 92vh;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

// ─── Header ───────────────────────────────────────────────────────────────────
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-shrink: 0;

  .header-text {
    flex: 1;
    min-width: 0;

    h3 {
      margin: 0 0 0.65rem;
      color: $NICOLE-PURPLE;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.15rem;
    }
  }
}

.branch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.branch-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: $text-light;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.branch-select-wrap {
  width: 210px;

  :deep(.select-trigger) {
    padding: 0.38rem 0.8rem;
    border-radius: 20px;
    border: 1.5px solid rgba($NICOLE-PURPLE, 0.3);
    background: rgba($NICOLE-PURPLE, 0.05);

    &:hover:not(.disabled) {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.08);
    }
    &.open {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }

    .text        { color: $NICOLE-PURPLE; font-weight: 800; font-size: 0.87rem; }
    .arrow       { color: $NICOLE-PURPLE; }
    .placeholder { color: rgba($NICOLE-PURPLE, 0.5); font-size: 0.87rem; }
  }

  :deep(.dropdown-menu) { z-index: 1400; }
}

.branch-icon { font-size: 0.78rem; color: $NICOLE-PURPLE; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.btn-restock-shortcut {
  background: white;
  color: $NICOLE-PURPLE;
  border: 1.2px solid $NICOLE-PURPLE;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba($NICOLE-PURPLE, 0.05);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.1);
  }

  @media (max-width: 480px) { span { display: none; } }
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: $text-light;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  transition: color 0.15s;
  &:hover { color: $text-dark; }
}

// ─── Body ─────────────────────────────────────────────────────────────────────
.modal-body {
  padding: 1.25rem 1.5rem;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow: hidden; // scroll is handled by items-list, not modal-body
}

// ─── Branch loading ───────────────────────────────────────────────────────────
.branch-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  color: $text-light;
  font-size: 0.9rem;
  font-weight: 600;
}

.branch-spinner {
  width: 22px;
  height: 22px;
  border: 3px solid $border-light;
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.confirm-error-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 1.25rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 4px solid #dc2626;
  border-radius: 8px;
  padding: 0.65rem 0.9rem;
  font-size: 0.83rem;
  font-weight: 600;
  color: #991b1b;

  i { color: #dc2626; flex-shrink: 0; }
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

// ─── Items list ───────────────────────────────────────────────────────────────
.items-list {
  border: 1px solid $border-light;
  border-radius: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
}

.list-header {
  display: grid;
  grid-template-columns: 1fr auto 240px;
  gap: 1rem;
  align-items: center;
  padding: 0.6rem 1rem;
  background: $gray-50;
  border-bottom: 1px solid $border-light;

  span {
    font-size: 0.72rem;
    font-weight: 700;
    color: $text-light;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .col-right  { text-align: center; }
  .col-status { text-align: left; }

  @media (max-width: 600px) { display: none; }
}

.item-row {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid $border-light;
  transition: background 0.15s;

  &:last-child { border-bottom: none; }
  &:hover      { background: #fafafa; }
  &.has-issue  { background: #fff9db; &:hover { background: #fff5cc; } }
  &.is-bad     { background: #fff1f2; &:hover { background: #ffe4e6; } }
}

.item-main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.65rem;

  @media (max-width: 500px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1e293b;
  line-height: 1.3;
}

.round-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
}

.round-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: $NICOLE-PURPLE;
  background: rgba($NICOLE-PURPLE, 0.08);
  border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  padding: 2px 7px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  i { font-size: 0.6rem; }
}

.diff-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.item-qty-block {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.sent-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 34px;

  .sent-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    color: $text-light;
    letter-spacing: 0.04em;
  }

  strong {
    font-size: 1.1rem;
    font-weight: 900;
    color: #1e293b;
    line-height: 1;
  }
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 0.3rem;

  button {
    width: 30px;
    height: 30px;
    border: 1px solid $border-light;
    background: white;
    border-radius: 7px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 700;
    color: #475569;
    line-height: 1;
    transition: background 0.15s;
    &:hover { background: $gray-100; }
  }

  input {
    width: 52px;
    text-align: center;
    border: 1.5px solid $border-light;
    border-radius: 7px;
    padding: 0.3rem;
    font-weight: 800;
    font-size: 0.95rem;
    color: $NICOLE-PURPLE;
    &:focus { outline: none; border-color: $NICOLE-PURPLE; }
  }
}

// ─── Status block ─────────────────────────────────────────────────────────────
.item-status-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.status-select-wrap {
  :deep(.select-trigger) {
    padding: 0.42rem 0.75rem;
    border-radius: 8px;
    border-width: 1.5px;
    font-size: 0.88rem;
  }

  &.ok :deep(.select-trigger) {
    border-color: rgba($success, 0.35);
    background: rgba($success, 0.05);
    .text { color: darken($success, 5%); font-weight: 700; }
  }
  &.missing :deep(.select-trigger) {
    border-color: rgba($warning, 0.45);
    background: rgba($warning, 0.07);
    .text { color: darken($warning, 12%); font-weight: 700; }
  }
  &.damaged :deep(.select-trigger) {
    border-color: rgba($error, 0.35);
    background: rgba($error, 0.05);
    .text { color: $error; font-weight: 700; }
  }
  &.bad_condition :deep(.select-trigger) {
    border-color: rgba(#e11d48, 0.4);
    background: rgba(#e11d48, 0.06);
    .text { color: #be123c; font-weight: 700; }
  }

  :deep(.dropdown-menu) { z-index: 1400; }
}

.status-icon {
  font-size: 0.85rem;
  &.ok      { color: $success; }
  &.missing { color: $warning; }
  &.damaged { color: $error; }
  &.bad     { color: #be123c; }
}

// ─── Note field ───────────────────────────────────────────────────────────────
.note-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fff1f2;
  border: 1.5px solid rgba(#e11d48, 0.25);
  border-radius: 8px;
}

.note-icon {
  font-size: 0.8rem;
  color: #be123c;
  flex-shrink: 0;
}

.note-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.88rem;
  color: #1e293b;
  font-family: inherit;
  &::placeholder { color: #fca5a5; }
  &:focus { outline: none; }
}

.slide-note-enter-active,
.slide-note-leave-active { transition: all 0.2s ease; overflow: hidden; }
.slide-note-enter-from,
.slide-note-leave-to { opacity: 0; max-height: 0; }
.slide-note-enter-to,
.slide-note-leave-from { opacity: 1; max-height: 60px; }

// ─── General notes ────────────────────────────────────────────────────────────
.notes-section {
  flex-shrink: 0;

  label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.5rem;
  }

  input {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9rem;
    box-sizing: border-box;
    &:focus { outline: none; border-color: $NICOLE-PURPLE; }
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────
.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  background: $gray-50;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  flex-shrink: 0;

  .btn-cancel {
    padding: 0.65rem 1.4rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
    background: white;
    border: 1px solid $border-light;
    color: $text-light;
    &:hover { background: $gray-100; color: $text-dark; }
  }
}

.hold-btn-container {
  flex: 1;
  max-width: 320px;
}

// ─── Receipt view ─────────────────────────────────────────────────────────────
.receipt-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem 1.75rem;
  flex: 1;
  overflow-y: auto;
}

.receipt-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;

  .receipt-check {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba($success, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;

    i { font-size: 2rem; color: $success; }
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: #1e293b;
  }

  .receipt-meta {
    margin: 0;
    font-size: 0.8rem;
    color: $text-light;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.35rem;

    i { font-size: 0.75rem; }
  }
}

.receipt-items {
  border: 1px solid $border-light;
  border-radius: 12px;
  overflow: hidden;
}

.receipt-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid $border-light;
  transition: background 0.15s;

  &:last-child { border-bottom: none; }
  &.has-issue { background: #fff9db; }

  .receipt-item-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex: 1;
    min-width: 0;

    > i { font-size: 1rem; flex-shrink: 0; }
  }

  .receipt-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .receipt-item-name {
    font-weight: 700;
    font-size: 0.92rem;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .receipt-item-note {
    font-size: 0.74rem;
    color: #be123c;
    font-style: italic;
  }

  .receipt-item-qty {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
    flex-shrink: 0;

    .qty-received {
      font-size: 1.15rem;
      font-weight: 900;
      color: #1e293b;
    }

    .qty-slash {
      font-size: 0.85rem;
      color: $text-light;
    }

    .qty-sent {
      font-size: 0.78rem;
      color: $text-light;
      font-weight: 500;
    }
  }
}

.receipt-notes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid $border-light;
  border-radius: 8px;
  padding: 0.65rem 0.9rem;
  font-size: 0.85rem;
  color: #475569;
  font-style: italic;

  i { color: $text-light; flex-shrink: 0; }
}

.receipt-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  padding-top: 0.25rem;

  button {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.65rem 1.4rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-edit-receipt {
    background: white;
    color: $NICOLE-PURPLE;
    border: 1.5px solid $NICOLE-PURPLE !important;
    &:hover { background: rgba($NICOLE-PURPLE, 0.06); }
  }

  .btn-close-receipt {
    background: $NICOLE-PURPLE;
    color: white;
    &:hover { background: darken(#7C3AED, 6%); transform: translateY(-1px); box-shadow: 0 6px 16px rgba($NICOLE-PURPLE, 0.25); }
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────
.empty-msg {
  text-align: center;
  padding: 3rem 1rem;
  color: $text-light;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;

  i { font-size: 3rem; color: $success; }
  p { font-size: 1.05rem; margin: 0; }

  .locked-notice {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.82rem;
    text-align: left;
    margin-top: 0.25rem;

    i { font-size: 0.85rem !important; color: #94a3b8 !important; flex-shrink: 0; }
    strong { color: #475569; }
  }

  .already-received-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: rgba($success, 0.08);
    border: 1px solid rgba($success, 0.25);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    text-align: left;
    width: 100%;
    max-width: 460px;

    > i { font-size: 1.4rem; color: $success; flex-shrink: 0; margin-top: 2px; }

    div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong { font-size: 0.95rem; color: #166534; }
      span   { font-size: 0.82rem; color: #16a34a; }
    }
  }

  .already-received-list {
    width: 100%;
    max-width: 460px;
    border: 1px solid $border-light;
    border-radius: 10px;
    overflow: hidden;
  }

  .already-received-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid $border-light;
    &:last-child { border-bottom: none; }

    .ar-item-left {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      i { font-size: 0.9rem; flex-shrink: 0; }
    }

    .ar-item-name { font-size: 0.88rem; font-weight: 600; color: #1e293b; }
    .ar-item-qty  { font-size: 0.85rem; font-weight: 700; color: $text-light; }
  }

  .empty-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    font-size: 0.83rem;
    color: #0369a1;
    text-align: left;
    max-width: 420px;

    i { font-size: 0.9rem; color: #0284c7; flex-shrink: 0; margin-top: 1px; }
  }

  .btn-restock-empty {
    background: white;
    color: $NICOLE-PURPLE;
    border: 2px solid $NICOLE-PURPLE;
    padding: 0.9rem 1.75rem;
    border-radius: 12px;
    font-weight: 800;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: $NICOLE-PURPLE;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.2);
    }

    i { font-size: 1.1rem; color: inherit; }
  }
}
</style>
