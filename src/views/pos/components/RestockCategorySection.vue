<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  label: string;
  icon: string;
  count: number;
  pedidos: number;
  forceOpen?: boolean; // con búsqueda activa la sección se abre sola
}>();

const open = ref(true);
const isOpen = computed(() => props.forceOpen || open.value);
</script>

<template>
  <section class="category-section">
    <button type="button" class="section-head" :class="{ collapsed: !isOpen }" @click="open = !open">
      <span class="head-left">
        <i class="fa-solid" :class="icon"></i>
        <span class="label">{{ label }}</span>
        <span class="count">{{ count }}</span>
      </span>
      <span class="head-right">
        <span v-if="pedidos > 0" class="pedidos-badge">{{ pedidos }} con pedido</span>
        <i class="fa-solid fa-chevron-down chevron" :class="{ rotated: !isOpen }"></i>
      </span>
    </button>
    <div v-show="isOpen" class="section-body">
      <slot />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.category-section {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fbfcfe;
  overflow: hidden;
}

.section-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  border: none;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #e8eef5; }
  &.collapsed { background: #f8fafc; }

  .head-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;

    i { color: #64748b; font-size: 0.9rem; }

    .label {
      font-size: 0.85rem;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .count {
      background: white;
      border: 1px solid #cbd5e1;
      color: #475569;
      font-size: 0.72rem;
      font-weight: 800;
      padding: 1px 8px;
      border-radius: 10px;
    }
  }

  .head-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .pedidos-badge {
      background: #dcfce7;
      border: 1px solid #bbf7d0;
      color: #15803d;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .chevron {
      color: #94a3b8;
      font-size: 0.8rem;
      transition: transform 0.2s;

      &.rotated { transform: rotate(-90deg); }
    }
  }
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.8rem;
}
</style>
