<script setup lang="ts">
import { computed } from 'vue'
import type { CartItem } from '@/types/order'
import { isPrecioIvaIncluido } from '@/constants/pricing'

const props = defineProps<{
  cart: CartItem[]
  isSubmitting: boolean
  hasRider: boolean
  isEditMode?: boolean
  globalDiscountPercentage?: number
  isGlobalCourtesy?: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
  (e: 'update-quantity', index: number, change: number): void
  (e: 'toggle-courtesy', index: number): void // New emit
  (e: 'submit'): void
}>()

const cartSubtotal = computed(() => {
  if (props.isGlobalCourtesy) return 0

  return props.cart.reduce((total, item) => {
    let price = item.price
    if (props.globalDiscountPercentage && props.globalDiscountPercentage > 0 && !item.isCourtesy) {
      price = item.price * (1 - props.globalDiscountPercentage / 100)
    }
    return total + (price * item.quantity)
  }, 0)
})

const cartIVA = computed(() => {
  if (props.isGlobalCourtesy) return 0

  return props.cart.reduce((totalIVA, item) => {
    if (isPrecioIvaIncluido(item)) return totalIVA

    let price = item.price
    if (props.globalDiscountPercentage && props.globalDiscountPercentage > 0 && !item.isCourtesy) {
      price = item.price * (1 - props.globalDiscountPercentage / 100)
    }

    return totalIVA + (price * item.quantity * 0.15)
  }, 0)
})

const savings = computed(() => {
  const originalSubtotal = props.cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  const originalIVA = props.cart.reduce((totalIVA, item) => {
    return isPrecioIvaIncluido(item) ? totalIVA : totalIVA + (item.price * item.quantity * 0.15)
  }, 0)

  const originalTotal = originalSubtotal + originalIVA
  return Math.max(0, originalTotal - (cartSubtotal.value + cartIVA.value))
})

const finalTotal = computed(() => cartSubtotal.value + cartIVA.value)

const needsRider = computed(() => {
  return props.cart.some(item =>
    item.name.toLowerCase().includes('delivery') || item.name.toLowerCase().includes('envío')
  )
})

const onDecrease = (item: CartItem, index: number) => {
  if (item.quantity > 1) {
    emit('update-quantity', index, -1)
  } else {
    emit('remove', index)
  }
}
</script>

<template>
  <div class="card cart-card">
    <h2>Detalle del Pedido</h2>
    <div class="cart-items">
      <div v-for="(item, index) in cart" :key="index" class="cart-item">
        <div class="item-details">
          <div class="name-row">
            <span class="item-name">
              {{ item.name }}
              <span v-if="item.isCourtesy" class="badge-courtesy">Cortesía</span>
            </span>
            <button 
              class="btn-toggle-courtesy" 
              :class="{ active: item.isCourtesy }"
              @click="$emit('toggle-courtesy', index)"
              title="Alternar cortesía (100% descuento)"
            >
              <i class="fa-solid fa-gift"></i>
            </button>
          </div>
          <span class="item-price" v-if="!item.isCourtesy">${{ item.price.toFixed(2) }}</span>
          <span class="item-price free" v-else>$0.00</span>
        </div>
        <div class="item-controls">
          <button @click="onDecrease(item, index)">-</button>
          <span>{{ item.quantity }}</span>
          <button @click="emit('update-quantity', index, 1)">+</button>
        </div>
      </div>
      <div v-if="cart.length === 0" class="empty-cart">
        No hay items en el pedido
      </div>
    </div>

    <!-- Alerta de Motorizado Falta -->
    <div v-if="needsRider && !hasRider" class="rider-warning">
       <i class="fa-solid fa-triangle-exclamation"></i>
       <span>Este pedido incluye envío. Por favor asigne un <strong>Motorizado o Transporte</strong> en los datos del pedido.</span>
    </div>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${{ cartSubtotal.toFixed(2) }}</span>
      </div>
      <div class="total-row">
        <span>IVA (15% est):</span>
        <span>${{ cartIVA.toFixed(2) }}</span>
      </div>
      <div v-if="savings > 0" class="total-row savings">
        <span>Ahorro Descuento:</span>
        <span>-${{ savings.toFixed(2) }}</span>
      </div>
      <div class="total-row final">
        <span>Total:</span>
        <span>${{ finalTotal.toFixed(2) }}</span>
      </div>
    </div>

    <button 
      class="btn-submit" 
      @click="emit('submit')" 
      :disabled="cart.length === 0 || isSubmitting"
    >
      {{ isSubmitting ? 'Procesando...' : (isEditMode ? 'Actualizar Orden' : 'Generar Pedido') }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 16px; // Match OrderForm
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  border: 1px solid $border-light;
  margin-bottom: 2rem;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.06);
  }

  h2 {
    font-family: $font-principal;
    font-size: 1.5rem;
    color: $text-dark;
    margin-top: 0;
    border-bottom: 2px solid $gray-50;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
    font-weight: 700;
  }
}

.cart-items {
  margin-bottom: 2rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: $gray-200;
    border-radius: 3px;
  }
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px dashed $border-light;

  &:last-child {
    border-bottom: none;
  }

  .item-details {
    flex: 1;

    .item-name {
      display: block;
      font-size: 0.95rem;
      font-weight: 600;
      color: $text-dark;
      margin-bottom: 0.25rem;

      .badge-courtesy {
        background-color: #e0f2fe;
        color: #0369a1;
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 6px;
        vertical-align: middle;
        font-weight: 700;
      }
    }

    .name-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .btn-toggle-courtesy {
      border: none;
      background: #f1f5f9;
      color: #94a3b8;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;

      &:hover {
        background: #e2e8f0;
        color: #64748b;
      }

      &.active {
        background: #e0f2fe;
        color: #0369a1;
        box-shadow: 0 2px 4px rgba(3, 105, 161, 0.2);
      }
    }

    .item-price {
      font-size: 0.9rem;
      color: $text-light;
      font-feature-settings: "tnum";

      &.free {
        color: #0369a1;
        font-weight: 700;
      }
    }
  }

  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: $gray-50;
    padding: 0.25rem;
    border-radius: 8px;
    border: 1px solid $border-light;

    button {
      width: 28px;
      height: 28px;
      border: none;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $text-dark;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: all 0.2s;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        color: $NICOLE-PURPLE;
      }
    }

    span {
      font-weight: 700;
      min-width: 24px;
      text-align: center;
      font-size: 0.9rem;
    }
  }
}

.totals {
  background: $gray-50;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 1px solid $border-light;

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
    color: $text-light;

    &:last-child {
      margin-bottom: 0;
    }

    span:last-child {
      font-feature-settings: "tnum";
      font-weight: 600;
    }

    &.savings {
      color: $success;
      font-weight: 700;
      font-size: 0.9rem;
    }

    &.final {
      font-size: 1.25rem;
      font-weight: 800;
      color: $NICOLE-PURPLE;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 2px dashed rgba($border-light, 0.5);
    }
  }
}

.btn-submit {
  width: 100%;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 1.2rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);

  &:hover:not(:disabled) {
    background: lighten-color($NICOLE-PURPLE, 5%);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.4);
  }

  &:disabled {
    background: $gray-400;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
}

.empty-cart {
  text-align: center;
  padding: 3rem 1rem;
  color: $text-light;
  font-style: italic;
  background: $gray-50;
  border-radius: 8px;
  border: 1px dashed $border-light;
}

.rider-warning {
  margin-bottom: 1.5rem;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  color: #9a3412;
  font-size: 0.9rem;
  line-height: 1.4;

  i {
    font-size: 1.2rem;
    color: #ea580c;
  }

  strong {
    color: #7c2d12;
  }
}
</style>