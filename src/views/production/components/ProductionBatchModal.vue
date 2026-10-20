<script setup lang="ts">
import { computed } from 'vue';
import ActionHoldButton from '@/components/common/ActionHoldButton.vue';

const props = defineProps<{
  isOpen: boolean;
  products: string[]; // nombres seleccionados
  pending: Record<string, number>; // pendiente por producto
  quantities: Record<string, number>; // cantidad elegida por producto
  isProcessing: boolean;
}>();

const emit = defineEmits(['close', 'confirm', 'set-quantity']);

const set = (name: string, qty: number) => emit('set-quantity', name, qty);

const onInput = (name: string, value: string) => {
  set(name, value === '' ? 0 : Number(value));
};

const totalToProduce = computed(() =>
  props.products.reduce((sum, name) => sum + (props.quantities[name] || 0), 0)
);

const isPartial = (name: string) =>
  (props.quantities[name] || 0) < (props.pending[name] || 0);
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="batch-overlay" @click.self="emit('close')">
      <div class="batch-card">
        <div class="card-head">
          <i class="fas fa-check-circle"></i>
          <h2>¿Cuánto vas a producir?</h2>
          <p>Por defecto está todo lo pendiente. Baja la cantidad si hoy harás menos: el resto queda pendiente.</p>
        </div>

        <div class="rows">
          <div v-for="name in products" :key="name" class="row" :class="{ partial: isPartial(name) }">
            <div class="row-info">
              <span class="pname">{{ name }}</span>
              <span class="pmeta">
                Pendiente: <strong>{{ pending[name] || 0 }}</strong>
                <span v-if="isPartial(name)" class="rest-badge">
                  quedan {{ (pending[name] || 0) - (quantities[name] || 0) }}
                </span>
              </span>
            </div>
            <div class="row-controls">
              <button type="button" class="step minus" :disabled="(quantities[name] || 0) <= 0" @click="set(name, (quantities[name] || 0) - 1)">
                <i class="fas fa-minus"></i>
              </button>
              <input
                type="number" min="0" :max="pending[name] || 0" inputmode="numeric"
                :value="quantities[name] ?? 0"
                @input="onInput(name, ($event.target as HTMLInputElement).value)"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button type="button" class="step plus" :disabled="(quantities[name] || 0) >= (pending[name] || 0)" @click="set(name, (quantities[name] || 0) + 1)">
                <i class="fas fa-plus"></i>
              </button>
              <button type="button" class="all" :class="{ active: !isPartial(name) }" @click="set(name, pending[name] || 0)">
                Todo
              </button>
            </div>
          </div>
        </div>

        <div class="total-line">
          <span>Total a marcar como producido:</span>
          <strong>{{ totalToProduce }} unids</strong>
        </div>

        <div class="card-actions">
          <button class="btn-cancel" :disabled="isProcessing" @click="emit('close')">Cancelar</button>
          <ActionHoldButton
            label="MANTENER 2S PARA CONFIRMAR"
            :duration="2000"
            color="#2ecc71"
            @trigger="emit('confirm')"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.batch-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
}

.batch-card {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
  padding: 1.5rem;
}

.card-head {
  text-align: center;
  margin-bottom: 1rem;

  i { font-size: 2.4rem; color: #059669; margin-bottom: 0.4rem; }
  h2 { margin: 0 0 0.3rem; color: #1e293b; font-size: 1.25rem; }
  p { margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.45; }
}

.rows {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0.5rem 0;
  padding-right: 2px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.6rem 0.85rem;

  &.partial {
    background: #fffbeb;
    border-color: #fcd34d;
  }
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .pname { font-weight: 800; color: #1e293b; font-size: 0.92rem; }

  .pmeta {
    font-size: 0.75rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.4rem;

    strong { color: #334155; }
  }

  .rest-badge {
    background: #f59e0b;
    color: white;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 1px 7px;
    border-radius: 10px;
    white-space: nowrap;
  }
}

.row-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;

  .step {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1.5px solid #cbd5e1;
    background: white;
    color: #475569;
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;

    &:hover:not(:disabled) { border-color: #64748b; background: #f1f5f9; }
    &:disabled { opacity: 0.35; cursor: not-allowed; }
  }

  input {
    width: 64px;
    height: 36px;
    border: 2px solid #059669;
    border-radius: 10px;
    text-align: center;
    font-size: 1.05rem;
    font-weight: 800;
    color: #047857;
    outline: none;

    &:focus { box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15); }
  }

  .all {
    height: 36px;
    padding: 0 0.7rem;
    border-radius: 10px;
    border: 1.5px solid #cbd5e1;
    background: white;
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;

    &:hover { border-color: #64748b; }
    &.active { background: #059669; border-color: #059669; color: white; }
  }
}

.total-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 10px;
  padding: 0.65rem 0.9rem;
  font-size: 0.88rem;
  color: #065f46;
  margin-bottom: 1rem;

  strong { font-size: 1.05rem; color: #047857; }
}

.card-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;

  .btn-cancel {
    background: #f1f2f6;
    color: #7f8c8d;
    border: none;
    padding: 0.7rem 1.4rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;

    &:hover:not(:disabled) { background: #e1e2e6; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
  .batch-card { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  .batch-card { transform: scale(0.92) translateY(16px); }
}
</style>
