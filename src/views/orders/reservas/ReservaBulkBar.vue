<script setup lang="ts">
defineProps<{
  selectedCount: number
  totalCount: number
  allSelected: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-all'): void
  (e: 'clear'): void
  (e: 'discard'): void
}>()
</script>

<template>
  <div class="bar" :class="{ active: selectedCount > 0 }">
    <label class="all">
      <input type="checkbox" :checked="allSelected" @change="emit('toggle-all')" />
      {{ selectedCount > 0 ? `${selectedCount} de ${totalCount} seleccionadas` : `Seleccionar todas (${totalCount})` }}
    </label>
    <div v-if="selectedCount > 0" class="buttons">
      <button type="button" class="btn" @click="emit('clear')">Quitar selección</button>
      <button type="button" class="btn danger" @click="emit('discard')">
        <i class="fa-regular fa-trash-can"></i> Eliminar ({{ selectedCount }})
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  min-height: 42px;
  padding: 0.2rem 0.1rem;

  &.active {
    position: sticky;
    bottom: 0.75rem;
    z-index: 20;
    padding: 0.55rem 0.8rem;
    border: 1px solid #ece7ef;
    border-radius: 12px;
    background: white;
    box-shadow: 0 8px 24px rgba(30, 27, 36, 0.12);
  }
}

.all {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #4b4453;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    accent-color: $NICOLE-PURPLE;
    cursor: pointer;
  }
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.4rem 0.8rem;
  border: 1px solid #ece7ef;
  border-radius: 10px;
  background: white;
  color: #4b4453;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: #f7f4f9; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }
}

.danger {
  border-color: #b91c1c;
  background: #b91c1c;
  color: white;

  &:hover { background: #991b1b; }
}
</style>
