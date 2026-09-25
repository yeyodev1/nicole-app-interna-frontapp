<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { WebOrderInfo } from '@/types/order'
import OrderService from '@/services/order.service'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

/**
 * Transferencia de un pedido web por verificar: comprobante en grande y las acciones
 * de ventas (confirmar y facturar, confirmar para la factura de la noche, rechazar).
 */
const props = defineProps<{
  orderId: string
  webOrder: WebOrderInfo
  invoiceData?: { ruc?: string; businessName?: string }
  totalValue?: number
}>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const dialog = useDialog()
const { success, error: showError } = useToast()

const ALLOWED_ROLES = ['admin', 'superadmin', 'SALES_MANAGER', 'sales']
const canConfirm = computed(() => {
  try {
    return ALLOWED_ROLES.includes(JSON.parse(localStorage.getItem('user_info') || '{}')?.role)
  } catch {
    return false
  }
})

const proofUrl = computed(() => props.webOrder.paymentProofUrl || '')
const rejected = computed(() => (!proofUrl.value ? props.webOrder.proofRejected : undefined))
const amount = computed(() => `$${Number(props.totalValue || 0).toFixed(2)}`)
const billTo = computed(() => {
  const ruc = String(props.invoiceData?.ruc || '').trim()
  if (!ruc || /^9{10}(9{3})?$/.test(ruc)) return 'Consumidor Final (9999999999999)'
  return `${props.invoiceData?.businessName || 'Sin razón social'} · RUC/CI ${ruc}`
})

const busy = ref<'' | 'now' | 'night' | 'reject' | 'noproof'>('')
const zoom = ref(false)
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') zoom.value = false
}
watch(zoom, (open) => (open ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey)))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const errorMessage = (err: any, fallback: string) => err?.data?.message || err?.message || fallback

async function confirmPayment(kind: 'now' | 'night' | 'noproof') {
  const code = props.webOrder.code || ''
  const messages = {
    now: `¿Confirmas que la transferencia de ${amount.value} del pedido ${code} ya está acreditada?\n\nSe registra el cobro y se EMITE AHORA la factura electrónica al SRI a nombre de:\n${billTo.value}`,
    night: `¿Confirmas que la transferencia de ${amount.value} del pedido ${code} ya está acreditada?\n\nSe registra el cobro y la factura a nombre de ${billTo.value} se emite esta noche.`,
    noproof: `ATENCIÓN: el cliente NO ha subido el comprobante.\n\nConfirma solo si verificaste en el banco que llegaron ${amount.value} para el pedido ${code}. Se registra el cobro y la factura sale esta noche. Nicole no hace reembolsos si el dinero no llegó.`
  }
  const ok = await dialog.confirm(messages[kind], {
    title: kind === 'now' ? 'Confirmar pago y facturar' : kind === 'night' ? 'Confirmar pago' : 'Confirmar sin comprobante',
    confirmLabel: kind === 'now' ? 'Sí, confirmar y facturar' : 'Sí, confirmar pago',
    cancelLabel: 'Cancelar',
    variant: kind === 'noproof' ? 'error' : kind === 'now' ? 'info' : 'warning'
  })
  if (!ok) return
  busy.value = kind
  try {
    const res = await OrderService.confirmWebTransfer(props.orderId, {
      invoiceNow: kind === 'now',
      ...(kind === 'noproof' ? { withoutProof: true } : {})
    })
    success(res.message || 'Pago confirmado.', 5000)
  } catch (err: any) {
    // Con invoiceNow el pago puede quedar confirmado aunque la factura falle: el mensaje lo dice.
    showError(errorMessage(err, 'No se pudo confirmar el pago.'), 8000)
  } finally {
    busy.value = ''
    emit('updated')
  }
}

async function rejectProof() {
  const reason = await dialog.prompt(
    'El cliente recibirá un correo pidiéndole otro comprobante con este motivo.',
    { title: 'Rechazar comprobante', placeholder: 'Ej.: la foto está borrosa, el monto no coincide…', confirmLabel: 'Rechazar', cancelLabel: 'Cancelar', variant: 'warning' }
  )
  if (!reason) return
  busy.value = 'reject'
  try {
    const res = await OrderService.rejectWebTransferProof(props.orderId, reason)
    success(res.message || 'Comprobante rechazado.', 5000)
  } catch (err: any) {
    showError(errorMessage(err, 'No se pudo rechazar el comprobante.'))
  } finally {
    busy.value = ''
    emit('updated')
  }
}
</script>

<template>
  <div class="review">
    <p v-if="rejected" class="notice rejected">
      <i class="fas fa-ban"></i> Comprobante rechazado{{ rejected.by ? ` por ${rejected.by}` : '' }}{{ rejected.reason ? `: «${rejected.reason}»` : '' }}.
      Esperando uno nuevo del cliente.
    </p>

    <button v-if="proofUrl" type="button" class="proof-big" title="Ver en pantalla completa" @click="zoom = true">
      <img :src="proofUrl" alt="Comprobante de transferencia" />
      <span class="zoom-hint"><i class="fas fa-expand"></i> Ampliar</span>
    </button>
    <p v-else class="notice empty"><i class="fas fa-clock"></i> El cliente aún no sube el comprobante</p>

    <p class="bill-to">
      <span>Monto a verificar <strong>{{ amount }}</strong></span>
      <span>Se factura a <strong>{{ billTo }}</strong></span>
    </p>

    <div v-if="canConfirm" class="actions">
      <template v-if="proofUrl">
        <button class="btn primary" :disabled="!!busy" @click="confirmPayment('now')">
          <i class="fas" :class="busy === 'now' ? 'fa-spinner fa-spin' : 'fa-file-invoice-dollar'"></i> Confirmar pago y facturar ahora
        </button>
        <button class="btn secondary" :disabled="!!busy" @click="confirmPayment('night')">
          <i class="fas" :class="busy === 'night' ? 'fa-spinner fa-spin' : 'fa-moon'"></i> Confirmar pago (factura esta noche)
        </button>
        <button class="btn danger" :disabled="!!busy" @click="rejectProof">
          <i class="fas" :class="busy === 'reject' ? 'fa-spinner fa-spin' : 'fa-times'"></i> Rechazar comprobante
        </button>
      </template>
      <button v-else class="btn warn" :disabled="!!busy" @click="confirmPayment('noproof')">
        <i class="fas" :class="busy === 'noproof' ? 'fa-spinner fa-spin' : 'fa-exclamation-triangle'"></i> Confirmar sin comprobante
      </button>
    </div>

    <Teleport to="body">
      <div v-if="zoom" class="lightbox" role="dialog" aria-label="Comprobante" @click="zoom = false">
        <img :src="proofUrl" alt="Comprobante de transferencia" />
        <button type="button" class="close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.review { display: flex; flex-direction: column; gap: 0.75rem; }

.proof-big {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid $border-light;
  border-radius: 10px;
  overflow: hidden;
  background: #f8fafc;
  cursor: zoom-in;

  img { display: block; width: 100%; max-height: 420px; object-fit: contain; }
}

.zoom-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  background: rgba(15, 23, 42, 0.7);
  padding: 3px 9px;
  border-radius: 20px;
}

.notice {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.45;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;

  i { margin-right: 0.25rem; }
  &.empty { background: #fff7ed; color: #c2410c; }
  &.rejected { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
}

.bill-to {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  font-size: 0.85rem;
  color: #475569;

  strong { color: $text-dark; }
}

.actions { display: flex; flex-direction: column; gap: 0.5rem; }

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: background 0.2s, opacity 0.2s;

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &.primary { background: #490f57; color: white; &:hover:not(:disabled) { background: #350b40; } }
  &.secondary { background: white; color: #490f57; border-color: #490f57; &:hover:not(:disabled) { background: #faf5fb; } }
  &.danger { background: white; color: #b91c1c; border-color: #fecaca; &:hover:not(:disabled) { background: #fef2f2; } }
  &.warn { background: #fffbeb; color: #92400e; border-color: #f59e0b; &:hover:not(:disabled) { background: #fef3c7; } }
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.92);
  cursor: zoom-out;

  img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }

  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
  }
}
</style>
