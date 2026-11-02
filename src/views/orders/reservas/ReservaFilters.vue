<script setup lang="ts">
import { RESERVA_FILTERS, type ReservaCounts, type ReservaFilter } from '@/utils/reserva'
import type { ReservaBrand } from '@/composables/useReservas'

defineProps<{ counts: ReservaCounts }>()

const filter = defineModel<ReservaFilter>('filter', { required: true })
const brand = defineModel<ReservaBrand>('brand', { required: true })
const search = defineModel<string>('search', { required: true })

const BRANDS: Array<{ key: ReservaBrand; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'nicole', label: 'Nicole' },
  { key: 'sucree', label: 'Sucrée' }
]
</script>

<template>
  <div class="filters">
    <div class="tabs" role="group" aria-label="Estado de la reserva">
      <button
        v-for="tab in RESERVA_FILTERS"
        :key="tab.key"
        type="button"
        class="tab"
        :class="{ on: filter === tab.key }"
        :aria-pressed="filter === tab.key"
        @click="filter = tab.key"
      >
        {{ tab.label }}
        <span class="count">{{ counts[tab.key] }}</span>
      </button>
    </div>

    <div class="tools">
      <label class="search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <span class="sr">Buscar reserva</span>
        <input v-model="search" type="search" placeholder="Nombre, teléfono, correo o código" />
      </label>
      <div class="brands" role="group" aria-label="Marca">
        <button
          v-for="option in BRANDS"
          :key="option.key"
          type="button"
          class="brand"
          :class="{ on: brand === option.key }"
          :aria-pressed="brand === option.key"
          @click="brand = option.key"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$line: #ece7ef;

.filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.tabs {
  display: flex;
  gap: 0.35rem;
  // En celular las pestañas se desplazan solas, sin mover la página.
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.tab {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
  min-height: 42px;
  padding: 0.45rem 0.85rem;
  border: 1px solid $line;
  border-radius: 10px;
  background: white;
  color: #4b4453;
  font-size: 0.86rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:hover { background: #f7f4f9; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }

  &.on {
    border-color: $NICOLE-PURPLE;
    background: $NICOLE-PURPLE;
    color: white;

    .count { background: rgba(255, 255, 255, 0.22); color: white; }
  }
}

.count {
  min-width: 1.35rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: #f4f2f6;
  color: #4b4453;
  font-size: 0.74rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.search {
  position: relative;
  flex: 1 1 260px;
  min-width: 0;

  i {
    position: absolute;
    top: 50%;
    left: 0.75rem;
    color: #6b6475;
    font-size: 0.82rem;
    transform: translateY(-50%);
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-height: 42px;
    padding: 0.45rem 0.75rem 0.45rem 2.1rem;
    border: 1px solid $line;
    border-radius: 10px;
    background: white;
    font-size: 0.9rem;

    &:focus { outline: 2px solid $NICOLE-PURPLE; outline-offset: 1px; }
  }
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.brands {
  display: inline-flex;
  padding: 0.2rem;
  border: 1px solid $line;
  border-radius: 10px;
  background: white;
}

.brand {
  min-height: 36px;
  padding: 0.3rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #4b4453;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;

  &.on { background: rgba($NICOLE-PURPLE, 0.1); color: $NICOLE-PURPLE; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 1px; }
}
</style>
