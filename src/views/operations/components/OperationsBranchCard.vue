<script setup lang="ts">
import { ref, computed } from 'vue';

interface ProductRow {
  name: string;
  vendido: number | null;
  ventaCierre: number | null;
  bajas: number;
  recibido: number;
  stockFinal: number | null;
  pedidoFinal: number;
  descuadre: number | null;
}

const props = defineProps<{
  branch: string;
  salesAvailable: boolean;
  hasClosing: boolean;
  totals: { vendido: number; ventaCierre: number; bajas: number; recibido: number; descuadre: number };
  products: ProductRow[];
  losses: Array<{ productName: string; quantity: number; reason: string; category: string }>;
}>();

const onlyIssues = ref(false);

const visibleProducts = computed(() =>
  onlyIssues.value
    ? props.products.filter(p => (p.descuadre ?? 0) !== 0 || p.bajas > 0)
    : props.products
);

const issuesCount = computed(() => props.products.filter(p => (p.descuadre ?? 0) !== 0).length);

// Venta de cierre negativa = apareció más stock del que entró registrado:
// casi siempre recepciones sin confirmar en el POS.
const hasNegativeCierre = computed(() => props.products.some(p => (p.ventaCierre ?? 0) < 0));
</script>

<template>
  <section class="branch-card">
    <header class="card-head">
      <div class="head-left">
        <div class="branch-icon"><i class="fa-solid fa-store"></i></div>
        <div>
          <h3>{{ branch }}</h3>
          <span class="status-line">
            <span v-if="issuesCount > 0" class="chip bad"><i class="fa-solid fa-scale-unbalanced"></i> {{ issuesCount }} no cuadra(n)</span>
            <span v-else-if="hasClosing && salesAvailable" class="chip ok"><i class="fa-solid fa-circle-check"></i> Todo cuadra</span>
            <span v-if="!hasClosing" class="chip warn"><i class="fa-solid fa-clock"></i> Sin cierre enviado este día</span>
            <span v-if="!salesAvailable" class="chip warn"><i class="fa-solid fa-plug-circle-xmark"></i> Sin venta de Contífico</span>
          </span>
        </div>
      </div>
      <label class="issues-toggle">
        <input type="checkbox" v-model="onlyIssues" />
        Solo novedades
      </label>
    </header>

    <div v-if="hasNegativeCierre" class="hint-note">
      <i class="fa-solid fa-circle-info"></i>
      Hay ventas de cierre en negativo: suele significar que la sucursal recibió producto
      <strong>sin confirmar la recepción</strong> en el POS. Revisa Recepción Masiva.
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="t-left">Producto</th>
            <th title="Unidades facturadas en Contífico">Vendido</th>
            <th title="Lo que salió de vitrina según el cierre">Cierre</th>
            <th>Bajas</th>
            <th>Recibido</th>
            <th title="Venta según cierre menos vendido en Contífico">Descuadre</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in visibleProducts" :key="p.name" :class="{ issue: (p.descuadre ?? 0) !== 0 }">
            <td class="t-left pname">{{ p.name }}</td>
            <td>{{ p.vendido ?? '—' }}</td>
            <td>{{ p.ventaCierre ?? '—' }}</td>
            <td :class="{ 'has-bajas': p.bajas > 0 }">{{ p.bajas || '' }}</td>
            <td>{{ p.recibido || '' }}</td>
            <td class="desc" :class="{ bad: (p.descuadre ?? 0) !== 0, ok: p.descuadre === 0 }">
              {{ p.descuadre === null ? '—' : (p.descuadre > 0 ? `+${p.descuadre}` : p.descuadre) }}
            </td>
          </tr>
          <tr v-if="visibleProducts.length === 0">
            <td colspan="6" class="empty-row">Sin novedades con este filtro 🎉</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="losses.length > 0" class="losses-box">
      <span class="losses-title"><i class="fa-solid fa-triangle-exclamation"></i> Bajas del día ({{ losses.reduce((s, l) => s + l.quantity, 0) }} unids)</span>
      <ul>
        <li v-for="(l, i) in losses" :key="i">
          <strong>{{ l.quantity }}×</strong> {{ l.productName }} — <em>{{ l.reason }}</em>
        </li>
      </ul>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.branch-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #fcfcfd;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;

  .head-left { display: flex; align-items: center; gap: 0.85rem; }

  .branch-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: #eff6ff; color: #2563eb;
    display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
  }

  h3 { margin: 0; font-size: 1.1rem; color: #0f172a; }

  .status-line { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 3px; }

  .chip {
    font-size: 0.7rem; font-weight: 800; padding: 2px 9px; border-radius: 10px;
    display: inline-flex; align-items: center; gap: 0.3rem;

    &.ok { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    &.bad { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    &.warn { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  }

  .issues-toggle {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.8rem; font-weight: 700; color: #475569; cursor: pointer;
    input { accent-color: #dc2626; width: 16px; height: 16px; }
  }
}

.hint-note {
  margin: 0.75rem 1.25rem 0;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  color: #1e40af;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.table-wrap { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th {
    padding: 0.6rem 0.75rem; background: #f8fafc; color: #64748b;
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px; text-align: center;
  }

  td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f8fafc; color: #334155; text-align: center; }
  .t-left { text-align: left; }
  .pname { font-weight: 600; color: #1e293b; }

  tr.issue { background: #fff7f7; }
  .has-bajas { color: #b45309; font-weight: 700; }

  .desc { font-weight: 800; }
  .desc.bad { color: #dc2626; }
  .desc.ok { color: #16a34a; }

  .empty-row { padding: 1.5rem; color: #94a3b8; }
}

.losses-box {
  margin: 0.9rem 1.25rem 1.1rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.75rem 1rem;

  .losses-title {
    font-size: 0.8rem; font-weight: 800; color: #92400e;
    display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem;
  }

  ul { margin: 0; padding-left: 1.1rem; font-size: 0.82rem; color: #78350f; }
  em { color: #a16207; }
}
</style>
