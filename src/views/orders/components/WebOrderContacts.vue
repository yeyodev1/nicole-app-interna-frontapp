<script setup lang="ts">
import { computed } from 'vue'
import type { WebOrderInfo } from '@/types/order'

/**
 * Pedidos de la tienda (contrato v7): quién compró y quién recibe/retira.
 * customerName/customerPhone del pedido ya son de quien recibe (lo usa el motorizado).
 */
const props = defineProps<{
  webOrder: WebOrderInfo
  customerName: string
  customerPhone: string
  deliveryType?: string
}>()

/** "0991234567" → "593991234567" para wa.me. */
function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('593')) return digits
  return digits.startsWith('0') ? `593${digits.slice(1)}` : digits
}

const rows = computed(() => {
  const buyer = props.webOrder.buyer
  const list = [] as Array<{ label: string; name: string; phone: string }>
  if (buyer?.name || buyer?.phone) list.push({ label: 'Compró', name: buyer.name || '—', phone: buyer.phone || '' })
  list.push({
    label: props.deliveryType === 'retiro' ? 'Retira' : 'Recibe',
    name: props.customerName,
    phone: props.customerPhone
  })
  return list
})
</script>

<template>
  <div class="card contacts-card">
    <h2><i class="fas fa-user-friends"></i> Compra y entrega</h2>
    <div v-for="row in rows" :key="row.label" class="contact">
      <label>{{ row.label }}</label>
      <p>{{ row.name }}<template v-if="row.phone"> · {{ row.phone }}</template></p>
      <div v-if="row.phone" class="links">
        <a :href="`tel:${row.phone}`"><i class="fas fa-phone"></i> Llamar</a>
        <a :href="`https://wa.me/${waNumber(row.phone)}`" target="_blank" rel="noopener">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </a>
      </div>
    </div>
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

  h2 {
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid $gray-50;
    font-size: 1.1rem;
    font-weight: 700;
    color: $text-dark;

    i {
      color: #490F57;
      margin-right: 0.3rem;
    }
  }
}

.contact {
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px dashed $gray-100;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: $text-light;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: $text-dark;
    word-break: break-word;
  }
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.2rem;

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 36px;
    font-size: 0.88rem;
    font-weight: 600;
    color: #490F57;
  }
}
</style>
