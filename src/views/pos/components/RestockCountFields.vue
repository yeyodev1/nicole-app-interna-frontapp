<script setup lang="ts">
import { QUICK_LOSS_REASON, type RestockItemData, type ChannelSale } from '@/views/pos/composables/useDailyClosing';
import RestockSoldBadge from './RestockSoldBadge.vue';

const props = defineProps<{
  item: RestockItemData;
  vendido: number | null;
  channels: ChannelSale[];
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
</script>

<template>
  <!-- Orden pedido por Diego: venta isla · combo · Casa Mía · Dela Cream · bajas · excedentes -->
  <div class="row-grid">
    <RestockSoldBadge label="Venta Isla" :vendido="vendido" :loading="salesLoading" :muted="item.isGeneral" />

    <div class="field">
      <label>Venta Combo</label>
      <input
        type="number" min="0" inputmode="numeric" placeholder="0" class="num"
        title="Unidades de este producto que salieron dentro de combos"
        :value="item.ventaCombo || ''"
        @focus="selectAll"
        @input="item.ventaCombo = Math.max(0, Number(($event.target as HTMLInputElement).value) || 0)"
      />
    </div>

    <RestockSoldBadge
      v-for="ch in channels"
      :key="ch.key"
      :label="ch.label"
      icon="fa-store"
      :vendido="ch.value"
      :loading="salesLoading"
      :muted="item.isGeneral"
    />

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
