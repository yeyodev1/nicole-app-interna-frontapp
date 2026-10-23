<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { posRestockService } from '@/services/pos-restock.service';
import { useDailyClosing } from '@/views/pos/composables/useDailyClosing';
import RestockProductRow from './components/RestockProductRow.vue';
import RestockClosingBanner from './components/RestockClosingBanner.vue';
import RestockExcessBanner from './components/RestockExcessBanner.vue';
import RestockClosingStates from './components/RestockClosingStates.vue';
import RestockCategorySection from './components/RestockCategorySection.vue';
import RestockSearchBar from './components/RestockSearchBar.vue';
import RestockCloserChip from './components/RestockCloserChip.vue';
import RestockPageHeader from './components/RestockPageHeader.vue';
import RestockClosingModals from './components/RestockClosingModals.vue';
// TEMPORAL (pruebas): cierre para otro día
import RestockDateSelector from './components/RestockDateSelector.vue';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const branch = ref<string>((route.query.branch as string) || 'San Marino');

const { success, error: showError } = useToast();
const showConfirmModal = ref(false);

// TEMPORAL (pruebas): día del cierre ('' = hoy)
const closingDate = ref('');

const {
  isLoading, isSubmitting, formData, formItems, hasExistingEntry,
  sales, salesLoading,
  fetchDailyForm, fetchDailySales,
  getVendido,
  submittedBy, setSubmittedBy, searchQuery, groupedItems,
  showLossModal, activeProductForLoss, openLossModal, handleSaveLosses,
  overriddenItems, hasExcessiveOverride, confirmMessage, confirmMessageHtml,
  buildPayload,
} = useDailyClosing(branch, closingDate);

// Modal de nombre: se pide al abrir el cierre si aún no hay nombre guardado.
const showNameModal = ref(false);

const handleNameSave = (name: string) => {
  setSubmittedBy(name);
  showNameModal.value = false;
};

// TEMPORAL (pruebas): recargar al cambiar el día del cierre
watch(closingDate, () => {
  fetchDailySales();
  fetchDailyForm().catch(err => console.error('Error fetching daily form:', err));
});

const goBack = () => {
  router.push({ name: 'pos-shipments' });
};

const loadAll = async () => {
  fetchDailySales();
  try {
    await fetchDailyForm();
  } catch (error) {
    console.error('Error fetching daily form:', error);
    showError('Error al cargar el formulario.');
  }
};

const handleSubmitClick = () => {
  if (!formData.value) return;
  if (!submittedBy.value) {
    showNameModal.value = true;
    return;
  }
  showConfirmModal.value = true;
};

const executeSubmission = async () => {
  showConfirmModal.value = false;
  if (!formData.value) return;

  isSubmitting.value = true;
  try {
    await posRestockService.submitDailyEntry(buildPayload());
    success('Reporte enviado correctamente.');
    router.push({ name: 'pos-shipments' });
  } catch (error) {
    console.error('Error submitting form:', error);
    showError('Hubo un error al enviar el reporte.');
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  // El nombre se pide recién al enviar (si falta), para no tapar el formulario.
  if (branch.value) loadAll();
});
</script>

<template>
  <div class="restock-page">
    <div class="container">
      <RestockPageHeader
        :branch="branch"
        :form-date="formData?.formDate"
        @back="goBack"
        @config="router.push({ name: 'pos-restock-management', query: { branch } })"
      />

      <RestockClosingStates
        v-if="isLoading || !formData || formItems.length === 0"
        :is-loading="isLoading"
        :branch="branch"
      >
        <p class="sub-text">Contacta a Administración para configurar los "Objetivos de Stock".</p>
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
            :sales-loading="salesLoading"
            @open-losses="openLossModal(item)"
          />
        </RestockCategorySection>

        <p v-if="searchQuery && groupedItems.length === 0" class="no-results">
          Sin resultados para «{{ searchQuery }}»
        </p>

        <RestockExcessBanner v-if="hasExcessiveOverride" :items="overriddenItems" />

        <div class="actions">
          <button type="submit" :disabled="isSubmitting" class="btn-submit">
            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
            {{ isSubmitting ? 'Enviando...' : (hasExistingEntry ? 'Actualizar Reporte de Hoy' : 'Confirmar y Enviar Reporte') }}
          </button>
        </div>
      </form>

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
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #d32f2f;
$bg-light: #f8fafc;

.restock-page {
  min-height: 100vh;
  background-color: $bg-light;
  padding: 1rem;
  font-family: 'Inter', sans-serif;
}

.container {
  max-width: 640px;
  margin: 0 auto;
  padding-bottom: 3rem;
}

.sub-text {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  color: #94a3b8;
}

.no-results {
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions {
  margin-top: 1rem;
  position: sticky;
  bottom: 1rem;
  z-index: 10;

  .btn-submit {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, $primary-color, darken($primary-color, 10%));
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba($primary-color, 0.25);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.1s;

    &:active { transform: scale(0.98); }

    &:disabled {
      background: #94a3b8;
      box-shadow: none;
      cursor: not-allowed;
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
