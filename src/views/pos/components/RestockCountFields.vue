<script setup lang="ts">
import { QUICK_LOSS_REASON, type RestockItemData } from '@/views/pos/composables/useDailyClosing';
import RestockSoldBadge from './RestockSoldBadge.vue';

const props = defineProps<{
  item: RestockItemData;
  vendido: number | null;
  salesLoading: boolean;
}>();

const getFinalPedido = (): number =>
  props.item.pedidoOverride !== null && props.item.pedidoOverride >= 0 ? props.item.pedidoOverride : 0;

// Si hay bajas detalladas desde el modal, el número se edita solo ahí para no pisarlas.
const hasModalLosses = (): boolean =>
  props.item.detailedLosses.some(l => l.reason !== QUICK_LOSS_REASON);

const handleQuickBajas = (value: string) => {
  if (hasModalLosses()) return;
  const qty = value === '' ? 0 : Math.max(0, Number(value));
  props.item.bajas = qty;
  props.item.detailedLosses = qty > 0
    ? [{ quantity: qty, reason: QUICK_LOSS_REASON, category: 'Other' as const }]
    : [];
};

const setPedido = (value: string) => {
  props.item.pedidoOverride = value === '' ? null : Number(value);
};

const selectAll = (e: FocusEvent) => (e.target as HTMLInputElement).select();

// Ventas que la isla escribe a mano porque el sistema no las trae solas
type ManualSale = 'ventaCombo' | 'ventaCasaMia' | 'ventaDelaCrem';
const MANUAL_SALES: Array<{ key: ManualSale; label: string; title: string }> = [
  { key: 'ventaCombo', label: 'Venta Combo', title: 'Unidades de este producto que salieron dentro de combos' },
  { key: 'ventaCasaMia', label: 'Venta Casa Mía', title: 'Unidades que vendió Casa Mía con producto de la isla' },
  { key: 'ventaDelaCrem', label: 'Venta Dela Cream', title: 'Unidades que vendió Dela Cream con producto de la isla' },
];

const setSale = (key: ManualSale, value: string) => {
  props.item[key] = Math.max(0, Number(value) || 0);
};
</script>

<template>
  <!-- Orden pedido por Diego: venta isla · combo · Casa Mía · Dela Cream · bajas · excedentes -->
  <div class="row-grid">
    <RestockSoldBadge label="Venta Isla" :vendido="vendido" :loading="salesLoading" :muted="item.isGeneral" />

    <div v-for="sale in MANUAL_SALES" :key="sale.key" class="field">
      <label>{{ sale.label }}</label>
      <input
        type="number" min="0" inputmode="numeric" placeholder="0" class="num"
        :title="sale.title"
        :value="item[sale.key] || ''"
        @focus="selectAll"
        @input="setSale(sale.key, ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="field">
      <label>Bajas</label>
      <input
        type="number" min="0" placeholder="0" class="num bajas-input"
        :class="{ readonly: hasModalLosses() }"
        :readonly="hasModalLosses()"
        :title="hasModalLosses() ? 'Hay bajas detalladas: edítalas con el botón Detallar Bajas' : 'Escribe el total de bajas del día'"
        :value="item.bajas || ''"
        @input="handleQuickBajas(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="field">
      <label>Excedentes</label>
      <input
        type="number" min="0" inputmode="numeric" class="num"
        title="Lo que queda en vitrina al cierre"
        v-model.number="item.excedente"
        @focus="selectAll"
      />
    </div>

    <div class="field pedido">
      <label>Pedido a {{ item.category === 'Bodega' ? 'Bodega' : 'Producción' }}</label>
      <input
        type="number" min="0" inputmode="numeric" class="num pedido-input"
        :class="{ 'has-value': getFinalPedido() > 0 }"
        :value="getFinalPedido()"
        @focus="selectAll"
        @input="setPedido(($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@include restock-fields;

// Solo flex: se acomoda en cualquier ancho sin media queries de columnas.
.row-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;

  :deep(.sold-box) { flex: 0 0 auto; }

  .field { flex: 1 1 110px; min-width: 100px; }
  .field.pedido { flex: 1 1 150px; }
}

@media (max-width: 560px) {
  .row-grid {
    :deep(.sold-box) { flex: 1 1 100%; }
    .field.pedido { flex: 1 1 100%; }
  }
}
</style>
