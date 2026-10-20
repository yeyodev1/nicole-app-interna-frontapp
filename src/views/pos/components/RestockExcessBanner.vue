<script setup lang="ts">
import type { RestockItemData } from '@/views/pos/composables/useDailyClosing';

defineProps<{ items: RestockItemData[] }>();
</script>

<template>
  <div class="excess-banner">
    <div class="banner-head">
      <i class="fa-solid fa-circle-exclamation"></i>
      <strong>Pedidos que superan el stock mínimo diario</strong>
    </div>
    <ul class="banner-list">
      <li v-for="item in items" :key="item.productName">
        <span class="pname">{{ item.productName }}</span>
        <span class="pdetail">
          Mínimo: <strong>{{ item.stockObjectiveTomorrow }}</strong>
          &nbsp;→&nbsp;
          Pedido: <strong class="qty-over">{{ item.pedidoOverride }}</strong>
          <span class="delta-badge">+{{ item.pedidoOverride! - item.stockObjectiveTomorrow }}</span>
        </span>
      </li>
    </ul>
    <p class="banner-note">
      <i class="fa-solid fa-hand"></i>
      Deberás mantener presionado el botón de confirmación para aceptar estos pedidos.
    </p>
  </div>
</template>

<style lang="scss" scoped>
.excess-banner {
  background: #fff1f2;
  border: 2px solid #fda4af;
  border-radius: 10px;
  padding: 1rem 1.1rem;
  animation: fadeIn 0.3s ease;

  .banner-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #be123c;
    margin-bottom: 0.75rem;

    i { font-size: 1rem; }
  }

  .banner-list {
    list-style: none;
    padding: 0;
    margin: 0 0 0.75rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.25rem;
      background: white;
      border: 1px solid #fecdd3;
      border-radius: 6px;
      padding: 0.4rem 0.7rem;
      font-size: 0.83rem;
    }

    .pname { font-weight: 700; color: #1e293b; }
    .pdetail { color: #64748b; font-size: 0.8rem; }
    .qty-over { color: #be123c; }

    .delta-badge {
      display: inline-block;
      background: #be123c;
      color: white;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 4px;
    }
  }

  .banner-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #9f1239;
    font-weight: 600;
    margin: 0;

    i { color: #e11d48; }
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
