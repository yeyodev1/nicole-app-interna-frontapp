<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOperationsReport } from './composables/useOperationsReport';
import OperationsShell from './components/OperationsShell.vue';

const { branches } = useOperationsReport();

const search = ref('');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const branchSales = computed(() =>
  branches.value.map(b => ({
    branch: b.branch,
    salesAvailable: b.salesAvailable,
    total: b.totals.vendido,
    products: b.products
      .filter(p => (p.vendido ?? 0) > 0)
      .filter(p => !search.value || norm(p.name).includes(norm(search.value)))
      .sort((a, b2) => (b2.vendido ?? 0) - (a.vendido ?? 0)),
  }))
);

const maxSold = (products: any[]) => Math.max(1, ...products.map(p => p.vendido ?? 0));
</script>

<template>
  <OperationsShell
    title="Ventas del Día"
    subtitle="Lo facturado en Contífico, producto por producto y por sucursal. Los más vendidos arriba."
    icon="fa-cash-register"
  >
    <div class="search-wrap">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input v-model="search" type="text" placeholder="Buscar producto..." />
      <button v-if="search" @click="search = ''"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <section v-for="b in branchSales" :key="b.branch" class="sales-card">
      <header>
        <i class="fa-solid fa-store"></i>
        <h3>{{ b.branch }}</h3>
        <span class="total">{{ b.total }} unids</span>
      </header>

      <p v-if="!b.salesAvailable" class="warn">Sin conexión con Contífico para esta sucursal.</p>
      <p v-else-if="b.products.length === 0" class="warn muted">
        {{ search ? `Nada con «${search}» en esta sucursal` : 'Sin ventas registradas este día.' }}
      </p>

      <ul v-else class="sales-list">
        <li v-for="p in b.products" :key="p.name">
          <span class="pname">{{ p.name }}</span>
          <div class="bar"><div class="fill" :style="{ width: ((p.vendido ?? 0) / maxSold(b.products) * 100) + '%' }"></div></div>
          <span class="qty">{{ p.vendido }}</span>
        </li>
      </ul>
    </section>
  </OperationsShell>
</template>

<style lang="scss" scoped>
.search-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 1rem;
  max-width: 420px;

  &:focus-within { border-color: #7c3aed; }
  > i { color: #94a3b8; font-size: 0.9rem; }

  input {
    flex: 1;
    border: none;
    outline: none;
    padding: 0.75rem 0;
    font-size: 0.95rem;
    background: transparent;
  }

  button {
    background: #f1f5f9; border: none; color: #64748b;
    width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
  }
}

.sales-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.1rem 1.3rem;

  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.9rem;

    i { color: #2563eb; }
    h3 { margin: 0; font-size: 1.05rem; color: #0f172a; flex: 1; }

    .total {
      background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
      font-size: 0.78rem; font-weight: 800; padding: 3px 11px; border-radius: 12px;
    }
  }

  .warn {
    margin: 0; font-size: 0.85rem; color: #92400e;
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.6rem 0.9rem;
    &.muted { color: #64748b; background: #f8fafc; border-color: #e2e8f0; }
  }
}

.sales-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;

  li {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) 2fr 48px;
    align-items: center;
    gap: 0.75rem;

    .pname { font-size: 0.88rem; font-weight: 600; color: #334155; }

    .bar {
      height: 10px; background: #f1f5f9; border-radius: 6px; overflow: hidden;
      .fill { height: 100%; background: linear-gradient(90deg, #2563eb, #60a5fa); border-radius: 6px; }
    }

    .qty { text-align: right; font-weight: 800; color: #1d4ed8; font-size: 0.95rem; }
  }
}

@media (max-width: 560px) {
  .sales-list li { grid-template-columns: 1fr 1fr 42px; }
}
</style>
