<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { posRestockService } from '@/services/pos-restock.service';
import ProductionSettingsService from '@/services/production-settings.service';
import { useDailyClosing } from '@/views/pos/composables/useDailyClosing';
import { useClosingSteps } from '@/views/pos/composables/useClosingSteps';
// TEMPORAL (pruebas): cierre para otro día
import RestockDateSelector from './RestockDateSelector.vue';
import RestockQuickAdd from './RestockQuickAdd.vue';
import RestockProductRow from './RestockProductRow.vue';
import RestockClosingBanner from './RestockClosingBanner.vue';
import RestockExcessBanner from './RestockExcessBanner.vue';
import RestockDistributionStep, { type DeliveryRoundResult } from './RestockDistributionStep.vue';
import RestockModalHeader from './RestockModalHeader.vue';
import RestockClosingStates from './RestockClosingStates.vue';
import RestockCategorySection from './RestockCategorySection.vue';
import RestockSearchBar from './RestockSearchBar.vue';
import RestockCloserChip from './RestockCloserChip.vue';
import RestockClosingModals from './RestockClosingModals.vue';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  branch: { type: String, required: true }
});

const emit = defineEmits(['close', 'success', 'notify']);

// --- Branch switching (dynamic) ---
const dynamicBranches = ref<string[]>([]);
const localBranch = ref(props.branch);
const branchOptions = computed(() => dynamicBranches.value.map(b => ({ value: b, label: b })));

const fetchBranches = async () => {
  try {
    const settings = await ProductionSettingsService.getSettings();
    dynamicBranches.value = (settings.destinations || []).map((d: any) => d.name);
  } catch (e) {
    console.error('Error fetching dynamic branches:', e);
  }
};

// TEMPORAL (pruebas): día del cierre ('' = hoy)
const closingDate = ref('');

const {
  isLoading, isSubmitting, formData, formItems, hasExistingEntry,
  sales, salesLoading,
  fetchDailyForm, fetchDailySales,
  getVendido, getChannelSales, getFinalPedido, addQuickItem,
  submittedBy, setSubmittedBy, searchQuery, groupedItems,
  showLossModal, activeProductForLoss, openLossModal, handleSaveLosses,
  overriddenItems, hasExcessiveOverride, confirmMessage, confirmMessageHtml,
  buildPayload,
} = useDailyClosing(localBranch, closingDate);

// Modal de nombre: se pide al abrir el cierre si aún no hay nombre guardado.
const showNameModal = ref(false);

const handleNameSave = (name: string) => {
  setSubmittedBy(name);
  showNameModal.value = false;
};

const loadAll = () => {
  fetchDailySales();
  fetchDailyForm().catch(err => console.error('Error fetching daily form:', err));
};

// --- Pasos: formulario → distribución → confirmación → envío ---
const notify = (message: string, type: 'success' | 'error' | 'warning') => emit('notify', { message, type });

const {
  currentStep, showConfirmModal, goToDistribution, confirmDistribution, submit: executeSubmission, reset: resetSteps,
} = useClosingSteps({
  isSubmitting,
  buildPayload,
  notify,
  onSuccess: () => emit('success'),
  onClose: () => closeModal(),
});

const handleSubmitClick = () => {
  if (!formData.value) return;
  if (!submittedBy.value) {
    showNameModal.value = true;
    return;
  }
  goToDistribution();
};

const distributionItems = computed(() =>
  formItems.value.map(item => ({
    productName: item.productName,
    unit: item.unit,
    category: item.category,
    pedidoFinal: getFinalPedido(item),
  }))
);

// --- Quick Add ---
const handleQuickAdd = (newProduct: any) => {
  if (!addQuickItem(newProduct)) {
    emit('notify', { message: 'El producto ya está en el reporte.', type: 'warning' });
    return;
  }
  emit('notify', { message: `"${newProduct.productName}" agregado al reporte.`, type: 'success' });
  setTimeout(() => {
    const firstInput = document.querySelector('.products-container input:not([readonly])') as HTMLInputElement | null;
    firstInput?.focus();
  }, 100);
};

const closeModal = () => {
  resetSteps();
  emit('close');
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    localBranch.value = props.branch;
    resetSteps();
    searchQuery.value = '';
    // El nombre se pide recién al enviar (si falta): así el modal no tapa
    // el selector de sucursal al abrir el cierre.
    showNameModal.value = false;
    fetchBranches();
    loadAll();
  }
});

watch(localBranch, () => { if (props.isOpen) loadAll(); });
// TEMPORAL (pruebas): al cambiar el día del cierre se recarga el formulario
watch(closingDate, () => { if (props.isOpen) loadAll(); });
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <RestockModalHeader v-model="localBranch" :options="branchOptions" @close="closeModal" />

      <div class="modal-body">
        <!-- Step 1: Form -->
        <template v-if="currentStep === 'form'">
          <RestockClosingStates
            v-if="isLoading || !formData || formItems.length === 0"
            :is-loading="isLoading"
            :branch="localBranch"
          >
            <p class="empty-hint">Pide a Administración configurar los "Objetivos de Stock".</p>
          </RestockClosingStates>

          <form v-else @submit.prevent="handleSubmitClick" class="form-grid">
            <RestockCloserChip :name="submittedBy" @change="showNameModal = true" />
            <!-- TEMPORAL (pruebas): elegir el día del cierre -->
            <RestockDateSelector v-model="closingDate" />
            <RestockClosingBanner
              :target-date="formData.targetDate"
              :sales="sales"
              :sales-loading="salesLoading"
            />
            <RestockSearchBar v-model="searchQuery" />

            <div class="products-container">
              <RestockQuickAdd :branch="localBranch" @add="handleQuickAdd" @close="closeModal" />

              <RestockCategorySection
                v-for="group in groupedItems"
                :key="group.key"
                :label="group.label"
                :icon="group.icon"
                :count="group.items.length"
                :pedidos="group.pedidos"
                :force-open="!!searchQuery"
              >
                <RestockProductRow
                  v-for="item in group.items"
                  :key="item.productName"
                  :item="item"
                  :vendido="getVendido(item)"
                  :channels="getChannelSales(item)"
                  :sales-loading="salesLoading"
                  @open-losses="openLossModal(item)"
                />
              </RestockCategorySection>

              <p v-if="searchQuery && groupedItems.length === 0" class="no-results">
                Sin resultados para «{{ searchQuery }}»
              </p>
            </div>

            <RestockExcessBanner v-if="hasExcessiveOverride" :items="overriddenItems" />

            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="closeModal">Cancelar</button>
              <button type="submit" :disabled="isSubmitting" class="btn-submit">
                <i class="fa-solid fa-truck-ramp-box"></i>
                {{ isSubmitting ? 'Enviando...' : (hasExistingEntry ? 'Actualizar y Distribuir' : 'Distribuir Entrega') }}
              </button>
            </div>
          </form>
        </template>

        <!-- Step 2: Distribution -->
        <RestockDistributionStep
          v-else-if="currentStep === 'distribution'"
          :items="distributionItems"
          @back="currentStep = 'form'"
          @confirm="confirmDistribution"
        />
      </div>
    </div>

    <RestockClosingModals
      :show-name="showNameModal"
      :submitted-by="submittedBy"
      :show-loss="showLossModal"
      :active-product="activeProductForLoss"
      :show-confirm="showConfirmModal"
      :confirm-message="confirmMessage"
      :confirm-message-html="confirmMessageHtml"
      @name-save="handleNameSave"
      @name-close="showNameModal = false"
      @loss-save="handleSaveLosses"
      @loss-close="showLossModal = false"
      @confirm="executeSubmission"
      @confirm-close="showConfirmModal = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}
.modal-content {
  background: white;
  border-radius: 12px;
  width: 95%;
  max-width: 760px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease-out;
}
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.modal-body { padding: 1.2rem; overflow-y: auto; flex: 1; }
.form-grid { display: flex; flex-direction: column; gap: 1rem; }
.products-container { display: flex; flex-direction: column; gap: 0.8rem; }

.empty-hint { font-size: 0.85rem; color: #94a3b8; margin: 0; }
.no-results { text-align: center; color: #94a3b8; font-size: 0.9rem; margin: 0.5rem 0; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;

  button { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.95rem; }

  .btn-cancel {
    background: white;
    border: 1px solid #cbd5e1;
    color: #475569;
    &:hover { background: #f8fafc; }
  }

  .btn-submit {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);
    &:hover:not(:disabled) { background: darken($NICOLE-PURPLE, 5%); transform: translateY(-1px); }
    &:disabled { background: #94a3b8; cursor: not-allowed; }
  }
}
</style>
