<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { posRestockService } from '@/services/pos-restock.service';
import { useDailyClosing } from '@/views/pos/composables/useDailyClosing';
import ConfirmationModal from '@/components/ConfirmationModal.vue';
import RestockLossDetailModal from './components/RestockLossDetailModal.vue';
import RestockProductRow from './components/RestockProductRow.vue';
import RestockClosingBanner from './components/RestockClosingBanner.vue';
import RestockExcessBanner from './components/RestockExcessBanner.vue';
import RestockClosingStates from './components/RestockClosingStates.vue';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const branch = ref<string>((route.query.branch as string) || 'San Marino');

const { success, error: showError } = useToast();
const showConfirmModal = ref(false);

const {
  isLoading, isSubmitting, formData, formItems, hasExistingEntry,
  sales, salesLoading,
  fetchDailyForm, fetchDailySales,
  getVendido,
  showLossModal, activeProductForLoss, openLossModal, handleSaveLosses,
  overriddenItems, hasExcessiveOverride, confirmMessage, confirmMessageHtml,
  buildPayload,
} = useDailyClosing(branch);

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
  if (branch.value) loadAll();
});
</script>

<template>
  <div class="restock-page">
    <div class="container">
      <header class="header">
        <div class="header-top">
          <button class="btn-back" @click="goBack">
            <i class="fa-solid fa-arrow-left"></i> Volver al POS
          </button>
          <button
            class="btn-config"
            @click="router.push({ name: 'pos-restock-management', query: { branch } })"
            title="Configurar objetivos de stock mínimos"
          >
            <i class="fa-solid fa-sliders"></i>
            <span>Configurar Objetivos</span>
          </button>
        </div>
        <div class="title-group">
          <h1>Cierre de Producción</h1>
          <p v-if="formData">
            Sucursal: <strong>{{ branch }}</strong> <span class="divider">|</span>
            Fecha: <strong>{{ formData.formDate }}</strong>
          </p>
        </div>
      </header>

      <RestockClosingStates
        v-if="isLoading || !formData || formItems.length === 0"
        :is-loading="isLoading"
        :branch="branch"
      >
        <p class="sub-text">Contacta a Administración para configurar los "Objetivos de Stock".</p>
      </RestockClosingStates>

      <form v-else @submit.prevent="handleSubmitClick" class="form-grid">
        <RestockClosingBanner
          :target-date="formData.targetDate"
          :sales="sales"
          :sales-loading="salesLoading"
        />

        <RestockProductRow
          v-for="item in formItems"
          :key="item.productName"
          :item="item"
          :vendido="getVendido(item)"
          :sales-loading="salesLoading"
          @open-losses="openLossModal(item)"
        />

        <RestockExcessBanner v-if="hasExcessiveOverride" :items="overriddenItems" />

        <div class="actions">
          <button type="submit" :disabled="isSubmitting" class="btn-submit">
            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
            {{ isSubmitting ? 'Enviando...' : (hasExistingEntry ? 'Actualizar Reporte de Hoy' : 'Confirmar y Enviar Reporte') }}
          </button>
        </div>
      </form>

      <RestockLossDetailModal
        v-if="showLossModal && activeProductForLoss"
        :is-open="showLossModal"
        :product-name="activeProductForLoss.productName"
        :initial-losses="activeProductForLoss.detailedLosses"
        :stock-objective-today="activeProductForLoss.stockObjectiveToday"
        :excedente="activeProductForLoss.excedente"
        @close="showLossModal = false"
        @save="handleSaveLosses"
      />

      <ConfirmationModal
        :is-open="showConfirmModal"
        title="Confirmar Reporte"
        :message="confirmMessage"
        :message-html="confirmMessageHtml"
        confirm-text="Enviar Reporte"
        :is-hold-to-confirm="true"
        @close="showConfirmModal = false"
        @confirm="executeSubmission"
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

.header {
  margin-bottom: 1.5rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.btn-back {
  background: none;
  border: none;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  font-size: 0.9rem;

  &:hover { color: #333; }
}

.btn-config {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  color: #475569;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  transition: all 0.2s;

  i { font-size: 0.85rem; }

  &:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
    color: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }
}

.title-group {
  h1 {
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
    color: #1e293b;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 0.95rem;

    strong { color: #333; }
    .divider { margin: 0 0.5rem; color: #ccc; }
  }
}

.sub-text {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  color: #94a3b8;
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
