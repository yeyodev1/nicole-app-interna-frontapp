<script setup lang="ts">
defineProps<{
  branch: string;
  formDate?: string;
}>();

const emit = defineEmits(['back', 'config']);
</script>

<template>
  <header class="page-header">
    <div class="header-top">
      <button class="btn-back" @click="emit('back')">
        <i class="fa-solid fa-arrow-left"></i> Volver al POS
      </button>
      <button class="btn-config" title="Configurar objetivos de stock mínimos" @click="emit('config')">
        <i class="fa-solid fa-sliders"></i>
        <span>Configurar Objetivos</span>
      </button>
    </div>
    <div class="title-group">
      <h1>Cierre de Producción</h1>
      <p v-if="formDate">
        Sucursal: <strong>{{ branch }}</strong> <span class="divider">|</span>
        Fecha: <strong>{{ formDate }}</strong>
      </p>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.page-header {
  margin-bottom: 1.5rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.btn-back {
  background: none;
  border: none;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  font-size: 0.9rem;

  &:hover { color: #333; }
}

.btn-config {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  color: #475569;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  transition: all 0.2s;

  i { font-size: 0.85rem; }

  &:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
    color: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }
}

.title-group {
  h1 {
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
    color: #1e293b;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 0.95rem;

    strong { color: #333; }
    .divider { margin: 0 0.5rem; color: #ccc; }
  }
}
</style>
