<script setup lang="ts">
import type { NotaCreditoCajera } from '@/services/pos-restock.service';

const props = defineProps<{ modelValue: NotaCreditoCajera[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: NotaCreditoCajera[]): void }>();

const agregar = () => emit('update:modelValue', [...props.modelValue, { factura: '', monto: null, motivo: '' }]);
const quitar = (index: number) => emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
const actualizar = (index: number, cambio: Partial<NotaCreditoCajera>) =>
  emit('update:modelValue', props.modelValue.map((n, i) => (i === index ? { ...n, ...cambio } : n)));
const leer = (e: Event) => (e.target as HTMLInputElement).value;
</script>

<template>
  <section class="credit-notes">
    <h4>Notas de crédito del día</h4>
    <div v-for="(nota, i) in modelValue" :key="i" class="fila">
      <input required placeholder="N.º de factura" :value="nota.factura" @input="actualizar(i, { factura: leer($event) })" />
      <input required type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Monto" :value="nota.monto ?? ''" @input="actualizar(i, { monto: leer($event) === '' ? null : Number(leer($event)) })" />
      <input required placeholder="Motivo" :value="nota.motivo" @input="actualizar(i, { motivo: leer($event) })" />
      <button type="button" aria-label="Quitar" @click="quitar(i)">×</button>
    </div>
    <button type="button" class="agregar" @click="agregar">+ Agregar nota de crédito</button>
  </section>
</template>

<style scoped>
.credit-notes { display: grid; gap: 0.5rem; margin: 0.75rem 0; }
.credit-notes h4 { margin: 0; font-size: 0.9rem; }
.fila { display: grid; grid-template-columns: 1fr 5.5rem 1.5fr auto; gap: 0.4rem; }
.fila input { min-width: 0; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 8px; }
.fila button, .agregar { padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; }
</style>
