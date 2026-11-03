<script setup lang="ts">
import { computed } from 'vue'
import { formatContactTime } from '@/utils/reserva'

/** Si la reserva volvió por el correo de recordatorio, o cuántos se le han enviado. */
const props = defineProps<{ order: any }>()

const reminder = computed(() => props.order.webOrder?.reminder)
const sentLabel = computed(() => {
  const count = reminder.value?.sentCount || 0
  if (!count) return ''
  return count === 1 ? 'Recordatorio por correo enviado' : `${count} recordatorios por correo enviados`
})
</script>

<template>
  <p v-if="reminder?.clickedAt" class="tag returned">
    <i class="fa-solid fa-envelope-open-text"></i>
    Entró por correo de recordatorio, {{ formatContactTime(reminder.clickedAt) }}
  </p>
  <p v-else-if="sentLabel" class="tag">
    <i class="fa-regular fa-envelope"></i>
    {{ sentLabel }}
  </p>
</template>

<style lang="scss" scoped>
.tag {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: #6b6475;
  font-size: 0.78rem;
}

.returned {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba($NICOLE-PURPLE, 0.18);
  border-radius: 10px;
  background: rgba($NICOLE-PURPLE, 0.08);
  color: $NICOLE-PURPLE;
  font-weight: 700;
}
</style>
