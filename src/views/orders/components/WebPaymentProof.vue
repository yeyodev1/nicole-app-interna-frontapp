<script setup lang="ts">
import { computed } from 'vue'
import type { WebOrderInfo } from '@/types/order'
import WebTransferReview from './WebTransferReview.vue'

/**
 * Comprobante de transferencia que el cliente subió en la tienda online. Por verificar
 * (y con el pedido cargado) muestra las acciones de ventas; pagado, el estado de la factura.
 */
const props = defineProps<{
  webOrder: WebOrderInfo
  order?: { _id: string; invoiceData?: { ruc?: string; businessName?: string }; invoiceStatus?: string; totalValue?: number }
}>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const isTransfer = computed(() => props.webOrder.paymentMethod === 'Transferencia')
const isPaid = computed(() => props.webOrder.paymentStatus === 'PAID')
const proofUrl = computed(() => props.webOrder.paymentProofUrl || '')
const paidLabel = computed(() => {
  const status = props.order?.invoiceStatus
  if (status === 'PROCESSED') return 'Pagado · Facturado'
  if (status === 'ERROR') return 'Pagado · la factura tuvo un error'
  if (status === 'PENDING') return 'Pagado · factura en cola'
  return 'Pago verificado'
})
</script>

<template>
  <div v-if="isTransfer" class="field proof">
    <label>Comprobante de transferencia</label>
    <WebTransferReview
      v-if="!isPaid && order"
      :order-id="order._id"
      :web-order="webOrder"
      :invoice-data="order.invoiceData"
      :total-value="order.totalValue"
      @updated="emit('updated')"
    />
    <div v-else-if="proofUrl" class="proof-row">
      <a :href="proofUrl" target="_blank" rel="noopener" class="proof-thumb" title="Ver comprobante">
        <img :src="proofUrl" alt="Comprobante de transferencia" loading="lazy" />
      </a>
      <div class="proof-info">
        <span v-if="!isPaid" class="proof-chip review">
          <i class="fas fa-receipt"></i> Comprobante recibido · por verificar
        </span>
        <span v-else class="proof-chip ok"><i class="fas fa-check"></i> {{ paidLabel }}</span>
        <a :href="proofUrl" target="_blank" rel="noopener" class="proof-link">
          <i class="fas fa-external-link-alt"></i> Ver comprobante
        </a>
      </div>
    </div>
    <p v-else-if="!isPaid" class="proof-chip none"><i class="fas fa-clock"></i> Sin comprobante todavía</p>
    <p v-else class="proof-chip ok"><i class="fas fa-check"></i> {{ paidLabel }}</p>
  </div>
</template>

<style lang="scss" scoped>
.field {
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px dashed $gray-100;

  label {
    display: block;
    font-size: 0.75rem;
    color: $text-light;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 0.4rem;
  }
}

.proof-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.proof-thumb {
  flex: 0 0 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid $border-light;
  background: #f8fafc;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.proof-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.proof-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;

  &.review {
    background: #eff6ff;
    color: #1d4ed8;
  }

  &.none {
    background: #fff7ed;
    color: #c2410c;
  }

  &.ok {
    background: #f0fdf4;
    color: #15803d;
  }
}

.proof-link {
  font-size: 0.85rem;
  font-weight: 600;
  color: #490f57;
}
</style>
