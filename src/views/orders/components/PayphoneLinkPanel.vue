<script setup lang="ts">
import { computed, ref } from 'vue'
import ClientLinkService from '@/services/client-link.service'
import { useToast } from '@/composables/useToast'
import { payphoneBreakdown, whatsappUrl } from '@/utils/payphone'
import type { CartItem } from '@/types/order'

/**
 * Genera el link de pago de Payphone por el total del carrito. Después el asesor
 * solo escribe el número de transacción en el cobro (Tarjeta · Payphone).
 */
const props = defineProps<{
  cart: CartItem[]
  totalValue: number
  globalDiscountPercentage?: number
  isGlobalCourtesy?: boolean
  customerName?: string
  customerPhone?: string
}>()

const emit = defineEmits<{
  (e: 'generated', url: string): void
}>()

const { success, error: showError } = useToast()
const isGenerating = ref(false)
const url = ref('')
// Total con el que se generó el link: si el carrito cambia, el link ya no cuadra.
const generatedFor = ref<number | null>(null)

const isStale = computed(() => !!url.value && generatedFor.value !== props.totalValue)
const canGenerate = computed(() => props.cart.length > 0 && props.totalValue > 0 && !props.isGlobalCourtesy)

const generate = async () => {
  if (!canGenerate.value) {
    showError('Agrega productos con valor antes de generar el link de pago.')
    return
  }
  isGenerating.value = true
  try {
    const breakdown = payphoneBreakdown(props.cart, {
      globalDiscountPercentage: props.globalDiscountPercentage,
      isGlobalCourtesy: props.isGlobalCourtesy,
      totalValue: props.totalValue
    })
    const reference = `Nicole Pastry${props.customerName ? ` · ${props.customerName}` : ''}`.slice(0, 100)
    const res = await ClientLinkService.createPayphoneLink({
      ...breakdown,
      reference,
      clientTransactionId: `LNK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase()
    })
    url.value = res.url
    generatedFor.value = props.totalValue
    emit('generated', res.url)
    success('Link de pago generado')
  } catch (e: any) {
    showError(e?.response?.data?.message || e?.message || 'No se pudo generar el link de Payphone')
  } finally {
    isGenerating.value = false
  }
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(url.value)
    success('Link copiado')
  } catch {
    showError('No se pudo copiar. Selecciónalo y cópialo a mano.')
  }
}

const sendWhatsApp = () => {
  const name = props.customerName ? props.customerName.split(' ')[0] : ''
  const text = `Hola${name ? ` ${name}` : ''} 👋 Este es tu link de pago de Nicole Pastry Arts por $${props.totalValue.toFixed(2)}:\n${url.value}`
  window.open(whatsappUrl(props.customerPhone, text), '_blank')
}
</script>

<template>
  <div class="payphone-panel">
    <div class="pp-head">
      <div class="pp-icon"><i class="fa-solid fa-credit-card"></i></div>
      <div>
        <strong>Link de pago Payphone</strong>
        <p>El cliente paga con tarjeta. Cuando pague, escribe el número de transacción abajo.</p>
      </div>
    </div>

    <button type="button" class="btn-generate" :disabled="isGenerating || !canGenerate" @click="generate">
      <i class="fa-solid" :class="isGenerating ? 'fa-circle-notch fa-spin' : 'fa-link'"></i>
      {{ url ? 'Generar otro link' : `Generar link por $${totalValue.toFixed(2)}` }}
    </button>

    <div v-if="url" class="pp-result" :class="{ stale: isStale }">
      <input :value="url" readonly @focus="($event.target as HTMLInputElement).select()" />
      <div class="pp-actions">
        <button type="button" class="btn-ghost" @click="copy"><i class="fa-regular fa-copy"></i> Copiar</button>
        <button type="button" class="btn-wa" @click="sendWhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>
      </div>
      <small v-if="isStale" class="stale-msg">
        <i class="fa-solid fa-triangle-exclamation"></i>
        El total cambió (link por ${{ generatedFor?.toFixed(2) }}). Genera uno nuevo.
      </small>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.payphone-panel {
  border: 1px solid #fde68a;
  background: #fffbeb;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.pp-head {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;

  strong {
    color: #92400e;
  }

  p {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
    color: #a16207;
  }
}

.pp-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f59e0b;
  color: white;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.btn-generate {
  align-self: flex-start;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  gap: 0.5rem;
  align-items: center;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.pp-result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  input {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    background: white;
    font-size: 0.85rem;
    box-sizing: border-box;
  }

  &.stale input {
    border-color: #f87171;
    text-decoration: line-through;
  }
}

.pp-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-ghost,
.btn-wa {
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.btn-ghost {
  background: white;
  border: 1px solid #e2e8f0;
  color: #334155;
}

.btn-wa {
  background: #22c55e;
  border: none;
  color: white;
}

.stale-msg {
  color: #b91c1c;
  font-size: 0.8rem;
}
</style>
