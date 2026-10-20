<script setup lang="ts">
defineProps<{ modelValue: string }>();
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="search-bar">
    <i class="fa-solid fa-magnifying-glass"></i>
    <input
      type="text"
      :value="modelValue"
      placeholder="Buscar producto en el cierre..."
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button v-if="modelValue" type="button" class="clear" title="Limpiar búsqueda" @click="emit('update:modelValue', '')">
      <i class="fa-solid fa-xmark"></i>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0 0.9rem;
  transition: border-color 0.2s;

  &:focus-within { border-color: #0369a1; }

  > i { color: #94a3b8; font-size: 0.9rem; }

  input {
    flex: 1;
    border: none;
    outline: none;
    padding: 11px 0;
    font-size: 0.95rem;
    color: #0f172a;
    background: transparent;

    &::placeholder { color: #94a3b8; }
  }

  .clear {
    background: #f1f5f9;
    border: none;
    color: #64748b;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;

    &:hover { background: #e2e8f0; color: #1e293b; }
  }
}
</style>
