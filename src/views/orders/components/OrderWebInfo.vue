<script setup lang="ts">
import { computed } from 'vue'
import type { WebOrderInfo } from '@/types/order'

const props = defineProps<{
  webOrder: WebOrderInfo
  status?: string
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'mark-managed'): void
}>()

const isPending = computed(() => props.status === 'PENDIENTE_GESTION')
const isManaged = computed(() => props.status === 'GESTIONADO')

const payment = computed(() => {
  const method = props.webOrder.paymentMethod || '—'
  if (props.webOrder.paymentStatus === 'PAID') return { label: `${method} · Pagado`, class: 'paid' }
  if (props.webOrder.paymentStatus === 'PENDING_VERIFICATION') return { label: `${method} · Por verificar`, class: 'verify' }
  return { label: method, class: '' }
})

const formatDateTime = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="card web-card" :class="{ pending: isPending }">
    <div class="web-card-head">
      <h2><i class="fas fa-shopping-bag"></i> Pedido de la tienda online</h2>
      <span v-if="isPending" class="state-badge pending">Pendiente de gestionar</span>
      <span v-else-if="isManaged" class="state-badge managed">Gestionado</span>
    </div>

    <div class="field" v-if="webOrder.code">
      <label>Código web</label>
      <p class="code">{{ webOrder.code }}</p>
    </div>
    <div class="field" v-if="webOrder.customerEmail">
      <label>Email</label>
      <p><a :href="`mailto:${webOrder.customerEmail}`">{{ webOrder.customerEmail }}</a></p>
    </div>
    <div class="field" v-if="webOrder.customerIdNumber">
      <label>Cédula / RUC</label>
      <p>{{ webOrder.customerIdNumber }}</p>
    </div>
    <div class="field">
      <label>Pago</label>
      <p><span class="payment-chip" :class="payment.class">{{ payment.label }}</span></p>
    </div>
    <div class="field" v-if="webOrder.paymentReference">
      <label>Referencia de pago</label>
      <p class="mono">{{ webOrder.paymentReference }}</p>
    </div>
    <div class="field" v-if="webOrder.deliveryReference">
      <label>Referencia de entrega</label>
      <p>{{ webOrder.deliveryReference }}</p>
    </div>
    <div class="field" v-if="webOrder.receivedAt">
      <label>Recibido</label>
      <p>{{ formatDateTime(webOrder.receivedAt) }}</p>
    </div>

    <p class="hint">
      <i class="fas fa-info-circle"></i>
      Para facturar y enviar a producción, gestiónalo como cualquier otro pedido
      (revisa productos y datos de factura). Cuando termines, márcalo como gestionado.
    </p>

    <button v-if="isPending" class="btn-managed" :disabled="isSaving" @click="emit('mark-managed')">
      <i class="fas" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-check'"></i>
      Marcar como gestionado
    </button>
    <p v-else-if="isManaged" class="managed-note">
      <i class="fas fa-check-circle"></i>
      Gestionado{{ webOrder.managedBy ? ` por ${webOrder.managedBy}` : '' }}{{ webOrder.managedAt ? ` · ${formatDateTime(webOrder.managedAt)}` : '' }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.01);
  width: 100%;
  box-sizing: border-box;

  &.pending {
    border-left: 4px solid #f59e0b;
  }
}

.web-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid $gray-50;

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: $text-dark;
    font-weight: 700;

    i {
      color: #490F57;
      margin-right: 0.3rem;
    }
  }
}

.state-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid transparent;

  &.pending {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
  }

  &.managed {
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  }
}

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
    margin-bottom: 0.25rem;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: $text-dark;
    line-height: 1.4;
    word-break: break-word;
  }

  a {
    color: #490F57;
  }

  .code {
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85rem;
  }
}

.payment-chip {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #475569;

  &.paid {
    background: #f0fdf4;
    color: #15803d;
  }

  &.verify {
    background: #fff7ed;
    color: #c2410c;
  }
}

.hint {
  margin: 0.25rem 0 1rem;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.45;
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;

  i {
    color: #490F57;
    margin-right: 0.25rem;
  }
}

.btn-managed {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #490F57;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #350b40;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.managed-note {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;

  i {
    color: #22c55e;
    margin-right: 0.25rem;
  }
}
</style>
