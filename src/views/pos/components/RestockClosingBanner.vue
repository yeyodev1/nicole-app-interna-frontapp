<script setup lang="ts">
import type { DailySales } from '@/services/pos-restock.service';

defineProps<{
  targetDate: string;
  sales: DailySales | null;
  salesLoading: boolean;
}>();
</script>

<template>
  <div class="closing-banner">
    <i class="fa-regular fa-calendar-check"></i>
    <span>Pedidos para el: <strong>{{ targetDate }}</strong></span>
    <span class="sales-status" v-if="salesLoading">
      <i class="fa-solid fa-spinner fa-spin"></i> Cargando venta del día desde Contífico...
    </span>
    <span class="sales-status ok" v-else-if="sales && sales.available">
      <i class="fa-solid fa-circle-check"></i> Venta del día desde Contífico
    </span>
    <span class="sales-status warn" v-else>
      <i class="fa-solid fa-triangle-exclamation"></i> Sin venta de Contífico ahora mismo
    </span>
  </div>
</template>

<style lang="scss" scoped>
.closing-banner {
  background: #e0f2fe;
  color: #0369a1;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid #bae6fd;
  flex-wrap: wrap;

  .sales-status {
    margin-left: auto;
    font-size: 0.78rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #0369a1;

    &.ok { color: #15803d; }
    &.warn { color: #b45309; }
  }
}
</style>
