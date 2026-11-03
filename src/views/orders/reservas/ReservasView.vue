<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReservas } from '@/composables/useReservas'
import { useReservaActions } from '@/composables/useReservaActions'
import { EMPTY_MESSAGES, RESERVA_FILTERS } from '@/utils/reserva'
import ReservaFilters from './ReservaFilters.vue'
import ReservaBulkBar from './ReservaBulkBar.vue'
import ReservaCard from './ReservaCard.vue'
import ReservaDiscardModal from './ReservaDiscardModal.vue'

const {
  filter,
  brand,
  search,
  orders,
  counts,
  reminderStats,
  limit,
  isLoading,
  loadFailed,
  isTruncated,
  selectedIds,
  selectedOrders,
  discardable,
  allSelected,
  fetchReservas,
  toggleSelected,
  toggleAll,
  clearSelection
} = useReservas()

const actions = useReservaActions(fetchReservas)

const discardTargets = ref<any[]>([])
const isDiscarding = computed(() => discardTargets.value.length > 0 && actions.busyId.value !== null)
const singleTargetName = computed(() => {
  const order = discardTargets.value[0]
  return order?.webOrder?.buyer?.name || order?.customerName
})
const activeLabel = computed(() => RESERVA_FILTERS.find(tab => tab.key === filter.value)?.label)
const hasNoResults = computed(() => !isLoading.value && !loadFailed.value && orders.value.length === 0)

async function confirmDiscard(payload: { reason?: string; note?: string }) {
  const done = await actions.discard(discardTargets.value.map(order => order._id), payload)
  if (done) {
    discardTargets.value = []
    clearSelection()
  }
}
</script>

<template>
  <main class="reservas">
    <header class="top">
      <div>
        <h1>Reservas sin pago</h1>
        <p>{{ counts.pending }} por contactar · {{ counts.contacted }} en seguimiento</p>
        <p v-if="reminderStats.returned > 0" class="recovered">
          <i class="fa-solid fa-envelope-open-text"></i>
          {{ reminderStats.returned }} {{ reminderStats.returned === 1 ? 'entró' : 'entraron' }} por correo de recordatorio
          · ${{ reminderStats.recoveredTotal.toFixed(2) }} en ventas
        </p>
      </div>
      <button type="button" class="refresh" :disabled="isLoading" aria-label="Actualizar" title="Actualizar" @click="fetchReservas">
        <i class="fa-solid fa-rotate" :class="{ 'fa-spin': isLoading }"></i>
      </button>
    </header>

    <ReservaFilters v-model:filter="filter" v-model:brand="brand" v-model:search="search" :counts="counts" />

    <div v-if="loadFailed" class="notice error" role="alert">
      <span>No se pudieron cargar las reservas.</span>
      <button type="button" class="link" @click="fetchReservas">Reintentar</button>
    </div>

    <ReservaBulkBar
      v-if="discardable.length > 0"
      :selected-count="selectedIds.size"
      :total-count="discardable.length"
      :all-selected="allSelected"
      @toggle-all="toggleAll"
      @clear="clearSelection"
      @discard="discardTargets = selectedOrders"
    />

    <p v-if="isTruncated" class="notice">
      Se muestran las primeras {{ limit }} reservas de {{ activeLabel }}. Usa la búsqueda para encontrar las demás.
    </p>

    <div v-if="hasNoResults" class="empty">
      <i class="fa-regular fa-circle-check"></i>
      <p v-if="search.trim()">No hay resultados para esa búsqueda en {{ activeLabel }}.</p>
      <p v-else>{{ EMPTY_MESSAGES[filter] }}</p>
    </div>

    <div v-else-if="isLoading && orders.length === 0" class="empty">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Cargando reservas…</p>
    </div>

    <div v-else class="grid">
      <ReservaCard
        v-for="order in orders"
        :key="order._id"
        :order="order"
        :selected="selectedIds.has(order._id)"
        :busy="actions.busyId.value === order._id"
        @toggle-select="toggleSelected(order._id)"
        @contact="actions.contact(order)"
        @new-contact="actions.newContact(order)"
        @note="actions.editNote(order)"
        @undo="actions.undoContact(order)"
        @managed="actions.markManaged(order)"
        @discard="discardTargets = [order]"
        @restore="actions.restore(order)"
      />
    </div>

    <ReservaDiscardModal
      v-if="discardTargets.length > 0"
      :count="discardTargets.length"
      :customer-name="singleTargetName"
      :busy="isDiscarding"
      @close="discardTargets = []"
      @confirm="confirmDiscard"
    />
  </main>
</template>

<style lang="scss" scoped>
.reservas {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 1rem;
  text-align: left;

  @media (min-width: 768px) { padding: 1.5rem; }
  @media (min-width: 1024px) { padding: 2rem; }
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  h1 {
    margin: 0;
    color: #1e1b24;
    font-size: 1.4rem;
    line-height: 1.2;
  }

  p {
    margin: 0.2rem 0 0;
    color: #6b6475;
    font-size: 0.86rem;
  }

  .recovered {
    color: $NICOLE-PURPLE;
    font-weight: 600;
  }
}

.refresh {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border: 1px solid #ece7ef;
  border-radius: 10px;
  background: white;
  color: #4b4453;
  cursor: pointer;

  &:hover:not(:disabled) { background: #f7f4f9; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }
  &:disabled { opacity: 0.6; cursor: wait; }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
  align-content: start;
}

.notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
  padding: 0.65rem 0.85rem;
  border: 1px solid #ece7ef;
  border-radius: 10px;
  background: #f7f4f9;
  color: #4b4453;
  font-size: 0.85rem;

  &.error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }
}

.link {
  padding: 0.25rem 0;
  border: none;
  background: none;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 2.5rem 1.25rem;
  border: 1px dashed #ddd6e3;
  border-radius: 16px;
  color: #6b6475;

  i { color: #9a92a3; font-size: 1.4rem; }
  p { margin: 0; font-size: 0.92rem; }
}
</style>
