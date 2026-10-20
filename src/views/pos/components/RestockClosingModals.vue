<script setup lang="ts">
import type { DetailedLoss } from '@/services/pos-restock.service';
import type { RestockItemData } from '@/views/pos/composables/useDailyClosing';
import RestockNameModal from './RestockNameModal.vue';
import RestockLossDetailModal from './RestockLossDetailModal.vue';
import ConfirmationModal from '@/components/ConfirmationModal.vue';

defineProps<{
  showName: boolean;
  submittedBy: string;
  showLoss: boolean;
  activeProduct: RestockItemData | null;
  showConfirm: boolean;
  confirmMessage: string;
  confirmMessageHtml?: string;
}>();

const emit = defineEmits(['name-save', 'name-close', 'loss-save', 'loss-close', 'confirm', 'confirm-close']);

const onLossSave = (losses: DetailedLoss[]) => emit('loss-save', losses);
</script>

<template>
  <RestockNameModal
    :is-open="showName"
    :initial-name="submittedBy"
    @save="emit('name-save', $event)"
    @close="emit('name-close')"
  />

  <RestockLossDetailModal
    v-if="showLoss && activeProduct"
    :is-open="showLoss"
    :product-name="activeProduct.productName"
    :initial-losses="activeProduct.detailedLosses"
    :stock-objective-today="activeProduct.stockObjectiveToday"
    :excedente="activeProduct.excedente"
    @close="emit('loss-close')"
    @save="onLossSave"
  />

  <ConfirmationModal
    :is-open="showConfirm"
    title="Confirmar Reporte"
    :message="confirmMessage"
    :message-html="confirmMessageHtml"
    confirm-text="Enviar Reporte"
    :is-hold-to-confirm="true"
    @close="emit('confirm-close')"
    @confirm="emit('confirm')"
  />
</template>
