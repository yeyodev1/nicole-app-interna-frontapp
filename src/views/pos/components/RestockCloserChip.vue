<script setup lang="ts">
defineProps<{ name: string }>();
const emit = defineEmits(['change']);
</script>

<template>
  <div class="closer-chip">
    <span class="who">
      <i class="fa-solid fa-user-check"></i>
      Cierre a cargo de: <strong>{{ name || 'sin nombre' }}</strong>
    </span>
    <button type="button" @click="emit('change')">
      <i class="fa-solid fa-pen"></i> Cambiar
    </button>
  </div>
</template>

<style lang="scss" scoped>
.closer-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 0.85rem;

  .who {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #475569;

    i { color: #0369a1; }
    strong { color: #0f172a; }
  }

  button {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;

    &:hover { border-color: #94a3b8; color: #1e293b; }
  }
}
</style>
