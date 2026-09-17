<script setup lang="ts">
import { computed } from 'vue'
import { isPrecioIvaIncluido } from '@/constants/pricing'

const props = defineProps<{
  products: any[],
  computedTotal: number,
  globalDiscountPercentage?: number,
  isGlobalCourtesy?: boolean,
  deliveryValue?: number
}>()

const subtotalBruto = computed(() => {
  return props.products.reduce((sum, p) => sum + (p.price * p.quantity), 0)
})

const ivaTotal = computed(() => {
  // Rough estimate based on products (excluding delivery which is usually 0%)
  return props.products.reduce((sum, p) => {
    if (isPrecioIvaIncluido(p)) return sum

    let discount = p.isCourtesy ? 100 : 0
    if (props.isGlobalCourtesy) {
      discount = 100
    } else if (props.globalDiscountPercentage && props.globalDiscountPercentage > 0 && discount < 100) {
      discount = props.globalDiscountPercentage
    }

    const itemTotal = (p.price * p.quantity) * (1 - discount / 100)
    return sum + (itemTotal * 0.15)
  }, 0)
})
</script>

<template>
  <section class="card products-card">
    <h2>Productos</h2>
    <div class="table-wrapper">
       <table>
         <thead>
           <tr>
             <th>Producto</th>
             <th class="text-right">Precio Unit.</th>
             <th class="text-center">Cant.</th>
             <th class="text-right">Total</th>
           </tr>
         </thead>
         <tbody>
           <tr v-for="(item, idx) in products" :key="idx">
             <td>
               {{ item.name }}
               <span v-if="item.isCourtesy" class="badge-courtesy">Cortesía</span>
             </td>
             <td class="text-right">${{ item.price.toFixed(2) }}</td>
             <td class="text-center">{{ item.quantity }}</td>
             <td class="text-right font-bold">${{ (item.price * item.quantity).toFixed(2) }}</td>
           </tr>
         </tbody>
         <tfoot>
           <tr>
             <td colspan="3" class="text-right label-sub">Subtotal Bruto:</td>
             <td class="text-right">${{ subtotalBruto.toFixed(2) }}</td>
           </tr>
           <tr v-if="isGlobalCourtesy || (globalDiscountPercentage || 0) > 0">
             <td colspan="3" class="text-right label-sub text-success">Descuento Global:</td>
             <td class="text-right text-success">
               -{{ isGlobalCourtesy ? '100%' : `${globalDiscountPercentage}%` }}
             </td>
           </tr>
           <tr v-if="deliveryValue">
             <td colspan="3" class="text-right label-sub">Envío:</td>
             <td class="text-right">${{ deliveryValue.toFixed(2) }}</td>
           </tr>
           <tr>
             <td colspan="3" class="text-right label-sub">IVA (15%):</td>
             <td class="text-right">${{ ivaTotal.toFixed(2) }}</td>
           </tr>
           <tr>
             <td colspan="3" class="text-right label-total">Total del Pedido:</td>
             <td class="text-right value-total">${{ computedTotal.toFixed(2) }}</td>
           </tr>
         </tfoot>
       </table>
    </div>
  </section>
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
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: $text-dark;
    font-weight: 700;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid $gray-50;
  }
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: white;

  table {
    width: 100%;
    min-width: 500px;
    border-collapse: collapse;

    th {
      text-align: left;
      padding: 0.75rem;
      background: $gray-50;
      color: $text-dark;
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid $border-light;
      font-size: 0.9rem;
      color: $text-dark;
    }

    tfoot {
      background-color: $gray-50;

      td {
        border-top: 2px solid $border-light;
        padding: 0.75rem;
        font-weight: 700;
      }

      .value-total {
        font-size: 1.2rem;
        color: $NICOLE-PURPLE;
      }
    }
  }
}

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

.text-success {
  color: #15803d !important;
}

.label-sub {
  font-size: 0.85rem;
  color: $text-light;
  font-weight: 600;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 700;
}
</style>
