<script setup lang="ts">
import { computed, ref } from 'vue'
import ClientLinkService from '@/services/client-link.service'
import { useToast } from '@/composables/useToast'
import { clientLinkCompletedMessage, clientLinkMessage, clientLinkState, clientLinkUrl, copyText, CLIENT_LINK_LABELS } from '@/utils/clientLink'
import { whatsappUrl } from '@/utils/payphone'
import { formatECT } from '@/utils/dateUtils'

/**
 * Link de gestión de entrega del pedido: estado, reenvío por WhatsApp, renovación
 * y lo que llenó el cliente. El cliente ya no puede cambiar la dirección: si hay
 * que corregirla, lo hace el asesor desde aquí.
 */
const props = defineProps<{ order: any }>()
const emit = defineEmits<{
  (e: 'updated'): void
  (e: 'edit-address'): void
  (e: 'edit-maps-link'): void
}>()

const { success, error: showError } = useToast()
const isRenewing = ref(false)

const link = computed(() => props.order.clientLink || {})
const state = computed(() => clientLinkState(props.order))
const url = computed(() => clientLinkUrl(props.order))
const isCompleted = computed(() => state.value === 'COMPLETED')
const isDelivery = computed(() => props.order.deliveryType === 'delivery')

const buyerPhone = computed(() => link.value.buyer?.phone || props.order.customerPhone || '')

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

const deliveryWhen = computed(() => {
  if (!props.order.deliveryDate) return ''
  const date = formatECT(props.order.deliveryDate, false)
  return props.order.deliveryTime ? `${date} · ${props.order.deliveryTime}` : date
})

const invoiceNote = computed(() => {
  switch (link.value.invoiceDeadlineHandled) {
    case 'CONSUMIDOR_FINAL': return 'Pasaron 2 días sin datos de factura: se facturó a consumidor final.'
    case 'ADVISOR_NOTIFIED': return 'Pasaron 2 días sin datos de factura y el pedido es de $50 o más: consigue los datos del cliente para facturar.'
    case 'CLIENT_DATA': return 'El cliente llenó sus datos de factura.'
    default: return ''
  }
})

const copy = async () => {
  if (await copyText(url.value)) success('Link copiado')
  else showError('No se pudo copiar. Selecciónalo y cópialo a mano.')
}

// Pendiente: el mensaje para que llene el link. Completado: el de "tu pedido quedó agendado".
const message = () => (isCompleted.value ? clientLinkCompletedMessage(props.order) : clientLinkMessage(props.order))

const copyMessage = async () => {
  if (await copyText(message())) success('Mensaje copiado: pégalo en el WhatsApp del cliente')
  else showError('No se pudo copiar. Inténtalo con "Copiar link".')
}

const resend = () => {
  window.open(whatsappUrl(buyerPhone.value, message()), '_blank')
}

const renew = async () => {
  isRenewing.value = true
  try {
    await ClientLinkService.renew(props.order._id)
    success('Link renovado por 7 días más')
    emit('updated')
  } catch (e: any) {
    showError(e?.response?.data?.message || e?.message || 'No se pudo renovar el link')
  } finally {
    isRenewing.value = false
  }
}
</script>

<template>
  <div class="card link-card" :class="state?.toLowerCase()">
    <div class="head">
      <h2><i class="fa-solid fa-link"></i> Link del cliente</h2>
      <span v-if="state" class="state" :class="state.toLowerCase()">{{ CLIENT_LINK_LABELS[state] }}</span>
    </div>

    <div class="field">
      <label>Lo planificó el asesor</label>
      <p>
        {{ link.plannedType === 'delivery' ? 'Entrega a domicilio' : 'Retiro en isla' }}
        <template v-if="link.plannedType === 'delivery'"> · envío estimado ${{ Number(link.estimatedDeliveryValue || 0).toFixed(2) }}</template>
      </p>
    </div>

    <div v-if="!isCompleted" class="field">
      <label>{{ state === 'EXPIRED' ? 'Venció' : 'Vence' }}</label>
      <p>{{ fmt(link.expiresAt) }}</p>
    </div>
    <div v-else class="field">
      <label>Completado</label>
      <p>{{ fmt(link.completedAt) }}</p>
    </div>

    <div v-if="url" class="link-box">
      <input :value="url" readonly @focus="($event.target as HTMLInputElement).select()" />
      <button type="button" class="icon-btn" title="Copiar link" @click="copy"><i class="fa-regular fa-copy"></i></button>
    </div>

    <div class="actions">
      <button type="button" class="btn-copy-msg" @click="copyMessage">
        <i class="fa-regular fa-copy"></i> {{ isCompleted ? 'Copiar confirmación' : 'Copiar mensaje' }}
      </button>
      <button type="button" class="btn-wa" @click="resend">
        <i class="fa-brands fa-whatsapp"></i> {{ isCompleted ? 'Enviar confirmación' : 'Abrir WhatsApp' }}
      </button>
      <button v-if="!isCompleted" type="button" class="btn-outline" :disabled="isRenewing" @click="renew">
        <i class="fa-solid" :class="isRenewing ? 'fa-circle-notch fa-spin' : 'fa-rotate'"></i> Renovar 7 días
      </button>
    </div>

    <!-- Lo que llenó el cliente -->
    <template v-if="isCompleted">
      <div class="divider"></div>
      <div class="field">
        <label>{{ isDelivery ? 'Entrega' : 'Retiro' }}</label>
        <p>{{ deliveryWhen || '—' }}</p>
      </div>
      <div v-if="!isDelivery" class="field">
        <label>Isla de retiro</label>
        <p>{{ order.branch || '—' }}</p>
      </div>
      <template v-else>
        <div class="field">
          <label>Dirección</label>
          <p>{{ order.deliveryAddress || '—' }}</p>
          <button type="button" class="link-btn" @click="emit('edit-address')"><i class="fa-solid fa-pen"></i> Corregir dirección</button>
        </div>
        <div v-if="link.deliveryReference" class="field">
          <label>Referencia</label>
          <p>{{ link.deliveryReference }}</p>
        </div>
        <div class="field">
          <label>Ubicación</label>
          <p>
            <a v-if="order.googleMapsLink" :href="order.googleMapsLink" target="_blank" rel="noopener">Ver en Google Maps</a>
            <span v-else>—</span>
            <span v-if="typeof link.deliveryKm === 'number'" class="muted"> · {{ link.deliveryKm }} km desde el CDP</span>
          </p>
          <button type="button" class="link-btn" @click="emit('edit-maps-link')"><i class="fa-solid fa-pen"></i> Corregir ubicación</button>
        </div>
      </template>
      <div class="field">
        <label>Recibe</label>
        <p>{{ order.customerName }} · {{ order.customerPhone }}</p>
      </div>
      <div v-if="link.buyer?.name && link.buyer.name !== order.customerName" class="field">
        <label>Compró</label>
        <p>{{ link.buyer.name }}<template v-if="link.buyer.phone"> · {{ link.buyer.phone }}</template></p>
      </div>
      <p class="lock-note">
        <i class="fa-solid fa-lock"></i> El cliente ya no puede cambiar estos datos. Si hay que corregirlos, hazlo tú.
      </p>
    </template>

    <p v-if="invoiceNote" class="invoice-note" :class="{ warn: link.invoiceDeadlineHandled === 'ADVISOR_NOTIFIED' }">
      <i class="fa-solid fa-file-invoice-dollar"></i> {{ invoiceNote }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid $border-light;
  margin-bottom: 1.5rem;

  &.pending {
    border-color: #ddd6fe;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.06);
  }

  &.expired {
    border-color: #fecaca;
  }
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: $text-dark;
    display: flex;
    gap: 0.5rem;
    align-items: center;

    i {
      color: $NICOLE-PURPLE;
    }
  }
}

.state {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;

  &.pending { background: #ede9fe; color: #6d28d9; }
  &.expired { background: #fee2e2; color: #b91c1c; }
  &.completed { background: #dcfce7; color: #15803d; }
}

.field {
  margin-bottom: 0.75rem;

  label {
    display: block;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
    font-weight: 700;
    margin-bottom: 0.15rem;
  }

  p {
    margin: 0;
    color: #1e293b;
    font-size: 0.92rem;
  }

  a {
    color: $NICOLE-PURPLE;
    font-weight: 600;
  }
}

.muted {
  color: #64748b;
}

.link-box {
  display: flex;
  gap: 0.4rem;
  margin: 0.25rem 0 0.75rem;

  input {
    flex: 1;
    min-width: 0;
    padding: 0.55rem 0.7rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    font-size: 0.82rem;
  }
}

.icon-btn {
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  padding: 0 0.75rem;
  cursor: pointer;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-copy-msg,
.btn-wa,
.btn-outline {
  border-radius: 8px;
  padding: 0.55rem 0.9rem;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.btn-copy-msg {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
}

.btn-wa {
  background: #22c55e;
  color: white;
  border: none;
}

.btn-outline {
  background: white;
  border: 1px solid $NICOLE-PURPLE;
  color: $NICOLE-PURPLE;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.link-btn {
  margin-top: 0.3rem;
  border: none;
  background: none;
  padding: 0;
  color: $NICOLE-PURPLE;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
}

.divider {
  height: 1px;
  background: $border-light;
  margin: 1rem 0;
}

.lock-note,
.invoice-note {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  gap: 0.45rem;
  align-items: flex-start;
  margin: 0.5rem 0 0;
  line-height: 1.4;
}

.invoice-note.warn {
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
}
</style>
