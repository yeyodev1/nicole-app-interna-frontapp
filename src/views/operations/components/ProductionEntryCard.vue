<script setup lang="ts">
import { type HistoryEntry, money, shortDate, timeOf } from '@/services/production-history.service'

/** Tarjeta de un ingreso de producción (como llega de la tablet). */
defineProps<{ entry: HistoryEntry; photo?: string | null }>()
</script>

<template>
  <div class="entry">
    <div class="eh">
      <img v-if="photo" :src="photo" class="av" :alt="`Foto de ${entry.operatorName}`" />
      <span v-else class="av">{{ entry.operatorName.charAt(0).toUpperCase() }}</span>
      <div class="who">
        <b>{{ entry.operatorName }}</b>
        <span>{{ entry.company === 'nicole' ? 'Nicole' : 'Sucrée' }} · {{ entry.area }} · {{ entry.items.length }} productos</span>
        <span class="when"><i class="fa-regular fa-calendar"></i> {{ shortDate(entry.date) }} · <i class="fa-regular fa-clock"></i> {{ timeOf(entry.createdAt) }}</span>
      </div>
      <div class="ev">{{ entry.totalUnits }} u<small>{{ money(entry.value) }}</small></div>
    </div>
    <div v-for="i in entry.items" :key="i.code" class="li">
      <div>{{ i.name }} <span>· {{ i.code }}</span></div>
      <b>{{ i.quantity }}</b>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.entry { border: 1px solid #e8ecf2; border-radius: 14px; overflow: hidden; background: #fff; }
.eh { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.av { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; display: grid; place-items: center; font-weight: 800; color: #fff; background: linear-gradient(160deg, #c9a9c1, #7b2d6b); }
.who { min-width: 0;
  b { display: block; color: #1e293b; }
  span { display: block; font-size: .8rem; color: #64748b; }
  .when { margin-top: 3px; font-weight: 700; color: #6d28d9; font-variant-numeric: tabular-nums; text-transform: capitalize; }
}
.ev { margin-left: auto; font-weight: 800; font-variant-numeric: tabular-nums; color: #3b1d6e; text-align: right;
  small { display: block; font-weight: 600; color: #64748b; font-size: .72rem; }
}
.li { display: flex; justify-content: space-between; gap: 10px; padding: 9px 14px; border-top: 1px solid #e8ecf2; font-size: .9rem; color: #334155;
  span { color: #64748b; font-size: .78rem; }
  b { font-variant-numeric: tabular-nums; }
}
</style>
