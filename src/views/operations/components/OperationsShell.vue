<script setup lang="ts">
import { onMounted } from 'vue';
import { useOperationsReport } from '../composables/useOperationsReport';
import OperationsHeader from './OperationsHeader.vue';
import OperationsLoading from './OperationsLoading.vue';

defineProps<{
  title: string;
  subtitle: string;
  icon: string;
}>();

const {
  date, isLoading, elapsed, report,
  setDate, fetchReport, ensureLoaded,
  branches, missingClosings, hasError,
} = useOperationsReport();

onMounted(ensureLoaded);
</script>

<template>
  <div class="ops-page">
    <div class="container">
      <OperationsHeader
        :title="title"
        :subtitle="subtitle"
        :icon="icon"
        :date="date"
        :is-loading="isLoading"
        @set-date="setDate"
        @refresh="fetchReport(true)"
      />

      <OperationsLoading v-if="isLoading" :elapsed="elapsed" />

      <template v-else-if="report">
        <div v-if="hasError" class="error-note">
          <i class="fa-solid fa-triangle-exclamation"></i>
          No se pudo cargar el día. <button @click="fetchReport(true)">Reintentar</button>
        </div>

        <template v-else>
          <div v-if="missingClosings.length" class="missing-note">
            <i class="fa-solid fa-circle-exclamation"></i>
            Falta el cierre de: <strong>{{ missingClosings.map((m: any) => m.branch).join(', ') }}</strong> — sin cierre no hay descuadre que calcular.
          </div>

          <div v-if="branches.length === 0" class="empty">
            <i class="fa-solid fa-folder-open"></i>
            <p>No hay datos para este día.</p>
          </div>

          <slot v-else />
        </template>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ops-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 1.5rem 1rem 4rem;
  font-family: 'Inter', -apple-system, sans-serif;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.missing-note,
.error-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #f59e0b;
  color: #92400e;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-size: 0.86rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-note {
  background: #fef2f2;
  border-color: #fecaca;
  border-left-color: #dc2626;
  color: #991b1b;

  button {
    margin-left: auto;
    background: #dc2626;
    color: white;
    border: none;
    padding: 0.4rem 0.9rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
  }
}

.empty {
  text-align: center;
  padding: 4rem 1rem;
  color: #94a3b8;

  i { font-size: 3rem; opacity: 0.4; margin-bottom: 0.75rem; }
  p { font-weight: 600; }
}
</style>
