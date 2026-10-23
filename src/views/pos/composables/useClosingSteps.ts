import { ref, type Ref } from 'vue';
import { posRestockService } from '@/services/pos-restock.service';
import type { DeliveryRoundResult } from '@/views/pos/components/RestockDistributionStep.vue';

type Notify = (message: string, type: 'success' | 'error' | 'warning') => void;

/**
 * Pasos del cierre de producción: formulario → distribución por rondas →
 * confirmación → envío.
 */
export function useClosingSteps(opts: {
  isSubmitting: Ref<boolean>;
  buildPayload: (rounds?: DeliveryRoundResult[]) => any;
  notify: Notify;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const currentStep = ref<'form' | 'distribution'>('form');
  const distributionData = ref<DeliveryRoundResult[] | null>(null);
  const showConfirmModal = ref(false);

  const goToDistribution = () => { currentStep.value = 'distribution'; };

  const confirmDistribution = (data: DeliveryRoundResult[]) => {
    distributionData.value = data;
    showConfirmModal.value = true;
  };

  const reset = () => {
    currentStep.value = 'form';
    distributionData.value = null;
  };

  const submit = async () => {
    showConfirmModal.value = false;
    opts.isSubmitting.value = true;
    try {
      await posRestockService.submitDailyEntry(opts.buildPayload(distributionData.value || undefined));
      opts.notify('Cierre de producción enviado correctamente', 'success');
      opts.onSuccess();
      opts.onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
      opts.notify('Hubo un error al enviar el reporte.', 'error');
    } finally {
      opts.isSubmitting.value = false;
    }
  };

  return { currentStep, distributionData, showConfirmModal, goToDistribution, confirmDistribution, submit, reset };
}
