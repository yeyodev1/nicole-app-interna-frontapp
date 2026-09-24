<script setup lang="ts">
const props = defineProps<{
  customerName: string,
  customerPhone: string,
  deliveryType: string,
  comments?: string
}>()
</script>

<template>
  <div class="card client-card">
     <h2>Cliente</h2>
     <div class="field">
       <label>Nombre</label>
       <p>{{ customerName }}</p>
     </div>
     <div class="field">
       <label>Teléfono</label>
       <p>{{ customerPhone }}</p>
     </div>
     <div class="field">
       <label>Entrega</label>
       <p class="capitalize">{{ deliveryType }}</p>
     </div>
     <div class="field" v-if="comments">
       <label>Notas Especiales</label>
       <p class="comments">{{ comments }}</p>
     </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.01);
  width: 100%;
  box-sizing: border-box;

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: $text-dark;
    font-weight: 700;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid $gray-50;
  }
}

.field {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed $gray-100;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  label {
    display: block;
    font-size: 0.75rem;
    color: $text-light;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: $text-dark;
    line-height: 1.4;
  }

  .comments {
    white-space: pre-line;
    background: #fffbeb;
    color: #92400e;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }
}

.capitalize {
  text-transform: capitalize;
}
</style>
