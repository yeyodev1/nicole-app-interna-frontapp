<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOperationsReport } from './composables/useOperationsReport';
import OperationsShell from './components/OperationsShell.vue';

const { allLosses, globalTotals } = useOperationsReport();

const search = ref('');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const filteredLosses = computed(() =>
  allLosses.value.filter(l => !search.value
    || norm(l.productName).includes(norm(search.value))
    || norm(l.reason || '').includes(norm(search.value))
    || norm((l as any).categoria || '').includes(norm(search.value)))
);

const CATEGORY_LABEL: Record<string, string> = {
  Transport: 'Transporte',
  Storage: 'Almacenamiento',
  Production: 'Producción',
  Other: 'Otro',
};

const byBranch = computed(() => {
  const map = new Map<string, typeof allLosses.value>();
  for (const l of filteredLosses.value) {
    if (!map.has(l.branch)) map.set(l.branch, []);
    map.get(l.branch)!.push(l);
  }
  return Array.from(map.entries()).map(([branch, losses]) => ({
    branch,
    losses,
    total: losses.reduce((s, l) => s + l.quantity, 0),
  }));
});
</script>

<template>
  <OperationsShell
    title="Bajas del Día"
    subtitle="Todo lo que las sucursales dieron de baja, con su motivo. Si está vacío, buen día."
    icon="fa-triangle-exclamation"
  >
    <div v-if="allLosses.length === 0" class="no-losses">
      <i class="fa-solid fa-circle-check"></i>
      <h3>Sin bajas reportadas este día 🎉</h3>
      <p>Ninguna sucursal registró desecho.</p>
    </div>

    <template v-else>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" type="text" placeholder="Buscar producto, motivo o categoría..." />
        <button v-if="search" @click="search = ''"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="losses-total">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <strong>{{ globalTotals.bajas }}</strong> unidades dadas de baja en total
      </div>

      <section v-for="g in byBranch" :key="g.branch" class="loss-card">
        <header>
          <i class="fa-solid fa-store"></i>
          <h3>{{ g.branch }}</h3>
          <span class="total">{{ g.total }} unids</span>
        </header>
        <ul>
          <li v-for="(l, i) in g.losses" :key="i">
            <span class="qty">{{ l.quantity }}×</span>
            <span class="pname">
              {{ l.productName }}
              <span v-if="(l as any).categoria" class="cat-chip">{{ (l as any).categoria }}</span>
            </span>
            <span class="reason">{{ l.reason }}</span>
            <span class="cat">{{ CATEGORY_LABEL[l.category] || l.category }}</span>
          </li>
        </ul>
      </section>
    </template>
  </OperationsShell>
</template>

<style lang="scss" scoped>
.no-losses {
  text-align: center;
  background: white;
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  padding: 3rem 1rem;

  i { font-size: 3rem; color: #16a34a; margin-bottom: 0.75rem; }
  h3 { margin: 0 0 0.3rem; color: #15803d; }
  p { margin: 0; color: #64748b; font-size: 0.9rem; }
}

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
  input { flex: 1; border: none; outline: none; padding: 0.75rem 0; font-size: 0.95rem; background: transparent; }
  button { background: #f1f5f9; border: none; color: #64748b; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; }
}

.cat-chip {
  display: inline-block;
  margin-left: 0.35rem;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  color: #6d28d9;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: 8px;
  vertical-align: middle;
}

.losses-total {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #f59e0b;
  color: #92400e;
  border-radius: 10px;
  padding: 0.8rem 1.1rem;
  font-size: 0.95rem;

  strong { font-size: 1.3rem; color: #b45309; }
  i { color: #f59e0b; }
}

.loss-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.1rem 1.3rem;

  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.8rem;

    i { color: #2563eb; }
    h3 { margin: 0; font-size: 1.05rem; color: #0f172a; flex: 1; }

    .total {
      background: #fffbeb; color: #b45309; border: 1px solid #fde68a;
      font-size: 0.78rem; font-weight: 800; padding: 3px 11px; border-radius: 12px;
    }
  }

  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }

  li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: #fffdf8;
    border: 1px solid #fef3c7;
    border-radius: 10px;
    padding: 0.55rem 0.85rem;
    flex-wrap: wrap;

    .qty { font-weight: 800; color: #b45309; font-size: 0.95rem; }
    .pname { font-weight: 700; color: #1e293b; font-size: 0.9rem; flex: 1; min-width: 140px; }
    .reason { color: #78350f; font-size: 0.82rem; font-style: italic; }

    .cat {
      background: #f1f5f9; color: #64748b;
      font-size: 0.68rem; font-weight: 800; text-transform: uppercase;
      padding: 2px 8px; border-radius: 8px;
    }
  }
}
</style>
