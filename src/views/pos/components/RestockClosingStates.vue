<script setup lang="ts">
// Estados de carga / sin configuración del cierre de producción (página y modal).
defineProps<{
  isLoading: boolean;
  branch: string;
}>();
</script>

<template>
  <div v-if="isLoading" class="state loading">
    <div class="spinner"></div>
    Cargando formulario...
  </div>

  <div v-else class="state empty">
    <i class="fa-solid fa-clipboard-question"></i>
    <h3>No hay productos configurados</h3>
    <p>No se encontraron objetivos de stock para <strong>{{ branch }}</strong>.</p>
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #d32f2f;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  i {
    font-size: 3rem;
    color: #cbd5e1;
  }

  h3 {
    margin: 0;
    color: #334155;
  }

  p {
    margin: 0;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
