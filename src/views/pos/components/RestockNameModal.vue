<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  initialName: string;
}>();

const emit = defineEmits(['save', 'close']);

const name = ref(props.initialName);
const inputEl = ref<HTMLInputElement | null>(null);

watch(() => props.isOpen, async (open) => {
  if (open) {
    name.value = props.initialName;
    await nextTick();
    inputEl.value?.focus();
  }
});

const canSave = () => name.value.trim().length >= 3;

const save = () => {
  if (!canSave()) return;
  emit('save', name.value.trim());
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="name-backdrop" @click.self="initialName && emit('close')">
      <div class="name-card">
        <div class="icon-circle"><i class="fa-solid fa-user-pen"></i></div>
        <h3>¿Quién realiza el cierre?</h3>
        <p>Tu nombre quedará registrado en el reporte de hoy.</p>
        <input
          ref="inputEl"
          v-model="name"
          type="text"
          placeholder="Ej: María Pérez"
          maxlength="60"
          @keyup.enter="save"
        />
        <button class="btn-start" :disabled="!canSave()" @click="save">
          <i class="fa-solid fa-circle-check"></i> Comenzar cierre
        </button>
        <button v-if="initialName" class="btn-cancel" @click="emit('close')">Cancelar</button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.name-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 25000;
  padding: 1rem;
}

.name-card {
  background: white;
  border-radius: 16px;
  padding: 2rem 1.75rem;
  width: 100%;
  max-width: 380px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  animation: pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);

  .icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  h3 {
    margin: 0 0 0.35rem;
    font-size: 1.2rem;
    color: #1e293b;
  }

  p {
    margin: 0 0 1.25rem;
    font-size: 0.88rem;
    color: #64748b;
  }

  input {
    width: 100%;
    padding: 12px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 1.05rem;
    text-align: center;
    font-weight: 600;
    color: #0f172a;
    outline: none;
    transition: border-color 0.2s;

    &:focus { border-color: #0369a1; }
  }

  .btn-start {
    width: 100%;
    margin-top: 1rem;
    padding: 12px;
    background: #0369a1;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover:not(:disabled) { background: darken(#0369a1, 6%); }
    &:disabled { background: #cbd5e1; cursor: not-allowed; }
  }

  .btn-cancel {
    margin-top: 0.6rem;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;

    &:hover { color: #475569; }
  }
}

@keyframes pop {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
