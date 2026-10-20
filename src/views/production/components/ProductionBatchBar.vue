<script setup lang="ts">
defineProps<{
  visible: boolean;
  selectedCount: number;
  isExporting: boolean;
  isProcessing: boolean;
}>();

const emit = defineEmits(['clear', 'export', 'complete']);
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="floating-batch-bar">
      <div class="batch-info">
        <span class="count">{{ selectedCount }}</span>
        <span class="label">productos seleccionados</span>
      </div>
      <div class="batch-actions">
        <button class="btn-clear" @click="emit('clear')">Cancelar</button>
        <button class="btn-process delivery" :disabled="isExporting" @click="emit('export', 'dispatch')">
          <i class="fas fa-truck-loading"></i> Entrega
        </button>
        <button class="btn-process production" :disabled="isExporting" @click="emit('export', 'production')">
          <i class="fas fa-bread-slice"></i> Producción
        </button>
        <button class="btn-process complete" :disabled="isProcessing" @click="emit('complete')">
          <i class="fas" :class="isProcessing ? 'fa-spinner fa-spin' : 'fa-check'"></i>
          Marcar Producido
        </button>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
$color-info: #3498db;

.floating-batch-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 700px;
  background: #1e293b;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .count {
      background: $color-info;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.9rem;
    }

    .label { font-weight: 600; }
  }

  .batch-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;

    .btn-clear {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;

      &:hover { background: rgba(255, 255, 255, 0.1); }
    }

    .btn-process {
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-size: 0.85rem;

      &.delivery {
        background: #3498db;
        color: white;
        &:hover:not(:disabled) { background: darken(#3498db, 5%); transform: translateY(-2px); }
      }

      &.production {
        background: #e67e22;
        color: white;
        &:hover:not(:disabled) { background: darken(#e67e22, 5%); transform: translateY(-2px); }
      }

      &.complete {
        background: #059669;
        color: white;
        &:hover:not(:disabled) { background: #047857; transform: translateY(-2px); }
      }

      &:disabled { background: #cbd5e1; color: #94a3b8; cursor: not-allowed; box-shadow: none; }
    }
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateX(-50%) translateY(100px);
  opacity: 0;
}
</style>
