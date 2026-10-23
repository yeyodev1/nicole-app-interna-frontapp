<script setup lang="ts">
import { QUICK_LOSS_REASON, type RestockItemData } from '@/views/pos/composables/useDailyClosing';
import RestockSoldBadge from './RestockSoldBadge.vue';

const props = defineProps<{
  item: RestockItemData;
  vendido: number | null;
  salesLoading: boolean;
}>();

const emit = defineEmits(['open-losses']);

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

const isSimpleSupply = () => props.item.isGeneral && !props.item.requiresMinimum;
</script>

<template>
  <div class="product-row" :class="{ 'zero-order': !item.isGeneral && getFinalPedido() === 0, 'is-general': item.isGeneral }">
    <div class="row-header">
      <div class="name-wrap">
        <span class="product-name">{{ item.productName }}</span>
        <span class="unit-badge">{{ item.unit }}</span>
        <span v-if="item.isGeneral" class="tag general">SUMINISTRO</span>
        <span class="tag dest" :class="item.category.toLowerCase()">{{ item.category }}</span>
        <span v-if="!isSimpleSupply()" class="goal-pill" title="Stock mínimo configurado para mañana">
          <i class="fa-solid fa-bullseye"></i> Mín. mañana: <strong>{{ item.stockObjectiveTomorrow }}</strong>
        </span>
      </div>
      <button
        v-if="!isSimpleSupply()"
        type="button"
        class="btn-losses"
        :class="{ 'has-losses': item.detailedLosses.length > 0 }"
        title="Detallar motivos de las bajas"
        @click="emit('open-losses')"
      >
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>{{ item.detailedLosses.length > 0 ? `Bajas: ${item.bajas}` : 'Detallar Bajas' }}</span>
      </button>
    </div>

    <!-- Suministro simple: solo cantidad a pedir -->
    <div v-if="isSimpleSupply()" class="simple-supply">
      <div class="field pedido">
        <label>Cantidad a Pedir</label>
        <input
          type="number" min="0" inputmode="numeric" class="num pedido-input"
          :class="{ 'has-value': getFinalPedido() > 0 }"
          :value="getFinalPedido()"
          @focus="($event.target as HTMLInputElement).select()"
          @input="setPedido(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="supply-note">
        <i class="fa-solid fa-info-circle"></i>
        <span>Se pedirá directamente a <strong>{{ item.category.toLowerCase() }}</strong>.</span>
      </div>
    </div>

    <!-- Producto de catálogo: venta real + conteo + pedido -->
    <div v-else class="row-grid">
      <RestockSoldBadge :vendido="vendido" :loading="salesLoading" :muted="item.isGeneral" />

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
        <label>Excedente (Vitrina)</label>
        <input
          type="number" min="0" inputmode="numeric" class="num"
          v-model.number="item.excedente"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </div>

      <div class="field pedido">
        <label>Pedido a {{ item.category === 'Bodega' ? 'Bodega' : 'Producción' }}</label>
        <input
          type="number" min="0" inputmode="numeric" class="num pedido-input"
          :class="{ 'has-value': getFinalPedido() > 0 }"
          :value="getFinalPedido()"
          @focus="($event.target as HTMLInputElement).select()"
          @input="setPedido(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div v-if="item.detailedLosses.length > 0" class="losses-summary">
      <div v-for="(loss, idx) in item.detailedLosses" :key="idx" class="loss-tag">
        <strong>{{ loss.quantity }}</strong>: {{ loss.reason }}
      </div>
    </div>

    <div
      v-if="!item.isGeneral && item.pedidoOverride !== null && item.pedidoOverride > item.stockObjectiveTomorrow"
      class="excess-alert"
    >
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>
        Pedido <strong>supera el mínimo</strong> en
        <strong class="delta">+{{ item.pedidoOverride - item.stockObjectiveTomorrow }}</strong> unidades
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.product-row {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);

  &.zero-order { opacity: 0.92; }

  &.is-general {
    border-left: 6px solid #6366F1;
    background: #F8FAFF;
  }
}

.row-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.85rem;

  .name-wrap {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .product-name { font-weight: 700; color: #1e293b; font-size: 1rem; }

  .unit-badge {
    background: #f1f5f9; padding: 2px 6px; border-radius: 4px;
    font-size: 0.7rem; color: #64748b; font-weight: 600; text-transform: uppercase;
  }

  .tag {
    font-size: 0.62rem; font-weight: 800; padding: 2px 6px;
    border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;

    &.general { background: #EEF2FF; color: #6366F1; }
    &.dest.producción { background: rgba(#A855F7, 0.1); color: #A855F7; }
    &.dest.bodega { background: rgba(#16a34a, 0.1); color: #16a34a; }
  }

  .goal-pill {
    font-size: 0.72rem; color: #475569; background: #f8fafc;
    padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;
    display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap;

    i { font-size: 0.65rem; color: #94a3b8; }
    strong { color: #0f172a; }
  }
}

.btn-losses {
  background: white; border: 1px solid #fee2e2; color: #ef4444;
  padding: 0.4rem 0.75rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700;
  display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
  transition: all 0.2s; white-space: nowrap; flex-shrink: 0;

  &:hover { background: #fef2f2; border-color: #ef4444; }

  &.has-losses {
    background: #ef4444; color: white; border-color: #ef4444;
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
  }
}

.row-grid {
  display: grid;
  grid-template-columns: auto 1fr 1fr 1.2fr;
  gap: 0.75rem;
  align-items: end;
}

.field {
  display: flex; flex-direction: column;

  label {
    font-size: 0.72rem; margin-bottom: 5px; color: #64748b; font-weight: 600;
  }

  &.pedido label {
    color: #0369a1; font-weight: 800; text-transform: uppercase;
    font-size: 0.68rem; letter-spacing: 0.4px;
  }

  .num {
    width: 100%; padding: 9px; border: 1px solid #cbd5e1; border-radius: 8px;
    font-size: 1.05rem; text-align: center; font-weight: 600; color: #0f172a;
    transition: all 0.2s;

    &:focus { outline: none; border-color: #64748b; }

    &.bajas-input:not(.readonly) {
      border-color: #fecaca; color: #b91c1c;

      &:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.08); }
    }

    &.readonly {
      background: #f8fafc; border-style: dashed; color: #64748b; cursor: not-allowed;
    }

    &.pedido-input {
      border: 2px solid #0369a1; color: #0369a1; font-weight: 800; background: white;

      &:focus { box-shadow: 0 0 0 3px rgba(3, 105, 161, 0.12); }
      &.has-value { background: #e0f2fe; }
    }
  }
}

.simple-supply {
  display: flex; align-items: end; gap: 1.25rem;

  .field { width: 150px; }

  .supply-note {
    display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #64748B;
    background: white; padding: 8px 12px; border-radius: 8px; border: 1px dashed #E2E8F0;

    i { color: #6366F1; }
  }
}

.losses-summary {
  margin-top: 0.85rem; display: flex; flex-wrap: wrap; gap: 0.5rem;
  padding-top: 0.6rem; border-top: 1px dashed #e2e8f0;

  .loss-tag {
    background: #fef2f2; color: #991b1b; padding: 2px 8px; border-radius: 4px;
    font-size: 0.75rem; border: 1px solid #fee2e2;

    strong { color: #ef4444; }
  }
}

.excess-alert {
  display: flex; align-items: center; gap: 0.5rem; margin-top: 0.6rem;
  background: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #f97316;
  border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.82rem; color: #9a3412;

  i { color: #f97316; flex-shrink: 0; }
  .delta { color: #ea580c; font-size: 1rem; }
}

@media (max-width: 560px) {
  .row-grid {
    grid-template-columns: 1fr 1fr;

    :deep(.sold-box) { grid-column: span 2; }

    .field.pedido { grid-column: span 2; }
  }

  .simple-supply { flex-direction: column; align-items: stretch; .field { width: 100%; } }
}
</style>
