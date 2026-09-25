<script setup lang="ts">
import { computed } from 'vue'
import type { WebOrderInfo } from '@/types/order'

/** Comprobante de transferencia que el cliente subió en la tienda online (por verificar). */
const props = defineProps<{ webOrder: WebOrderInfo }>()

const isTransfer = computed(() => props.webOrder.paymentMethod === 'Transferencia')
const isPaid = computed(() => props.webOrder.paymentStatus === 'PAID')
const proofUrl = computed(() => props.webOrder.paymentProofUrl || '')
</script>

<template>
  <div v-if="isTransfer" class="field proof">
    <label>Comprobante de transferencia</label>
    <div v-if="proofUrl" class="proof-row">
      <a :href="proofUrl" target="_blank" rel="noopener" class="proof-thumb" title="Ver comprobante">
        <img :src="proofUrl" alt="Comprobante de transferencia" loading="lazy" />
      </a>
      <div class="proof-info">
        <span v-if="!isPaid" class="proof-chip review">
          <i class="fas fa-receipt"></i> Comprobante recibido · por verificar
        </span>
        <span v-else class="proof-chip ok"><i class="fas fa-check"></i> Pago verificado</span>
        <a :href="proofUrl" target="_blank" rel="noopener" class="proof-link">
          <i class="fas fa-external-link-alt"></i> Ver comprobante
        </a>
      </div>
    </div>
    <p v-else-if="!isPaid" class="proof-chip none"><i class="fas fa-clock"></i> Sin comprobante todavía</p>
    <p v-else class="proof-chip ok"><i class="fas fa-check"></i> Pago verificado</p>
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
