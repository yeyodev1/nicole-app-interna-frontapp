<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Product } from '@/types/order'
import { isPrecioIvaIncluido } from '@/constants/pricing'

/**
 * Producto en una fila compacta (venta con link): nombre, precio final con IVA
 * y "+". Sin foto: el asesor busca por nombre y agrega rápido.
 */
const props = defineProps<{
  product: Product
  isBlocked?: boolean
}>()

const emit = defineEmits<{
  (e: 'add', product: Product): void
}>()

// Precio escrito a mano: Delivery y productos con pvp_manual (ej. Torta personalizada)
const isEditablePrice = computed(
  () => props.product.nombre.toLowerCase().includes('delivery') || props.product.pvp_manual === true
)
const manualPrice = ref<number | string>('')

/** Lo que paga el cliente: base + 15% IVA, salvo los de precio final. */
const finalPrice = computed(() => {
  const base = parseFloat(props.product.pvp1 || '0')
  return isPrecioIvaIncluido({ contifico_id: props.product.id, name: props.product.nombre }) ? base : base * 1.15
})

const justAdded = ref(false)

const handleAdd = () => {
  if (props.isBlocked) {
    emit('add', props.product)
    return
  }
  if (isEditablePrice.value) {
    const price = Number(manualPrice.value) || 0
    emit('add', { ...props.product, pvp1: price.toString() })
  } else {
    emit('add', props.product)
  }
  justAdded.value = true
  setTimeout(() => (justAdded.value = false), 900)
}
</script>

<template>
  <div class="row" :class="{ blocked: isBlocked }">
    <div class="info">
      <span class="name">{{ product.nombre }}</span>
      <span v-if="product.source === 'sucree'" class="brand">Sucree</span>
    </div>

    <label v-if="isEditablePrice && !isBlocked" class="manual">
      <span>$</span>
      <input
        v-model="manualPrice"
        type="number"
        min="0"
        step="0.01"
        :placeholder="isPrecioIvaIncluido({ id: product.id, nombre: product.nombre }) ? 'Precio final' : 'Sin IVA'"
        :aria-label="`Precio de ${product.nombre}`"
        @keyup.enter="handleAdd"
      />
    </label>
    <span v-else class="price">${{ finalPrice.toFixed(2) }}</span>

    <button
      type="button"
      class="add"
      :class="{ done: justAdded }"
      :title="isBlocked ? 'No se puede mezclar con el carrito actual' : 'Agregar'"
      :aria-label="`Agregar ${product.nombre}`"
      @click="handleAdd"
    >
      <i class="fa-solid" :class="isBlocked ? 'fa-lock' : justAdded ? 'fa-check' : 'fa-plus'"></i>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba($NICOLE-PURPLE, 0.05);
  }

  &.blocked {
    opacity: 0.45;
  }
}

.info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand {
  font-size: 0.7rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}

.price {
  font-weight: 700;
  color: $NICOLE-PURPLE;
  font-variant-numeric: tabular-nums;
}

.manual {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #64748b;

  input {
    width: 84px;
    padding: 0.4rem 0.5rem;
    border: 1px dashed $NICOLE-PURPLE;
    border-radius: 8px;
    font-size: 0.9rem;
  }
}

.add {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: $NICOLE-PURPLE;
  color: white;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.12s ease, background 0.15s ease;

  &:hover {
    transform: scale(1.06);
  }

  &:focus-visible {
    outline: 3px solid rgba($NICOLE-PURPLE, 0.35);
    outline-offset: 2px;
  }

  &.done {
    background: #16a34a;
  }
}

.blocked .add {
  background: #94a3b8;
}
</style>
