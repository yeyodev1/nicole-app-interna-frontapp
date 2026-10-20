<script setup lang="ts">
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

defineProps<{
  modelValue: string;
  options: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits(['update:modelValue', 'manage', 'close']);
</script>

<template>
  <header class="modal-header">
    <div class="title-wrap">
      <span class="title-text">
        <i class="fa-solid fa-clipboard-check"></i> Cierre de Producción
      </span>
      <div class="branch-select-wrap">
        <SearchableSelect
          :model-value="modelValue"
          :options="options"
          placeholder="Sucursal..."
          @update:model-value="emit('update:modelValue', $event)"
        />
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-manage" @click="emit('manage')" title="Gestionar stocks mínimos diarios">
        <i class="fa-solid fa-sliders"></i>
        <span>Gestionar Stocks</span>
      </button>
      <button class="close-btn" @click="emit('close')">&times;</button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.modal-header {
  padding: 1.2rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
  gap: 1rem;

  .title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .title-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .branch-select-wrap {
    width: 200px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-manage {
    background: white;
    border: 1.5px solid #e2e8f0;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #1e293b;
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: #94a3b8;
    cursor: pointer;

    &:hover {
      color: #ef4444;
    }
  }
}
</style>
