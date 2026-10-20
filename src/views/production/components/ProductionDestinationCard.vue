<script setup lang="ts">
defineProps<{
  destination: string;
  rounds: Record<string, Record<string, Record<string, number>>>;
  collapsedKeys: Set<string>;
  selected: Set<string>;
  totals: Record<string, number>;
}>();

const emit = defineEmits(['toggle-category', 'toggle-product']);

const sumCats = (cats: Record<string, Record<string, number>>) =>
  Object.values(cats).reduce((a, prods) => a + Object.values(prods).reduce((a2, b2) => a2 + b2, 0), 0);

const sumProds = (prods: Record<string, number>) =>
  Object.values(prods).reduce((a, b) => a + b, 0);

const catSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
</script>

<template>
  <div class="destination-card">
    <div class="dest-title">
      <div class="dest-icon-box">
        <i v-if="destination === 'San Marino'" class="fas fa-store"></i>
        <i v-else-if="destination === 'Mall del Sol'" class="fas fa-shopping-bag"></i>
        <i v-else-if="destination === 'Centro Prod.'" class="fas fa-industry"></i>
        <i v-else-if="destination === 'Delivery'" class="fas fa-motorcycle"></i>
        <i v-else class="fas fa-map-marker-alt"></i>
      </div>
      <div class="dest-info">
        <h3>{{ destination }}</h3>
        <span class="dest-total">
          {{ Object.values(rounds).reduce((acc, cats) => acc + sumCats(cats), 0) }} unids
        </span>
      </div>
    </div>

    <div v-for="(categories, roundLabel) in rounds" :key="roundLabel" class="round-section">
      <div v-if="roundLabel" class="round-badge-header">
        <i class="fas fa-clock"></i>
        <span>{{ roundLabel }}</span>
        <span class="round-total">{{ sumCats(categories) }} unids</span>
      </div>

      <div v-for="(products, catName) in categories" :key="catName" class="cat-section">
        <button
          class="cat-header"
          :class="`cat--${catSlug(String(catName))}`"
          @click="emit('toggle-category', `${destination}|||${roundLabel}|||${catName}`)"
        >
          <span class="cat-name">
            <i class="fas fa-chevron-right cat-chevron"
              :class="{ open: !collapsedKeys.has(`${destination}|||${roundLabel}|||${catName}`) }">
            </i>
            {{ catName }}
          </span>
          <span class="cat-qty">{{ sumProds(products) }} unids</span>
        </button>

        <Transition name="cat-collapse">
          <table v-if="!collapsedKeys.has(`${destination}|||${roundLabel}|||${catName}`)" class="raw-table">
            <tbody>
              <tr
                v-for="(qty, productName) in products"
                :key="productName"
                class="raw-row"
                :class="{ selected: selected.has(String(productName)) }"
                @click="emit('toggle-product', String(productName))"
              >
                <td class="col-check">
                  <div class="custom-checkbox" :class="{ checked: selected.has(String(productName)) }">
                    <i v-if="selected.has(String(productName))" class="fas fa-check"></i>
                  </div>
                </td>
                <td class="col-name">{{ productName }}</td>
                <td class="col-qty"><strong>{{ qty }}</strong></td>
                <td class="col-qty pending-qty" v-if="totals[String(productName)]">
                  <strong>{{ totals[String(productName)] }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$color-info: #3498db;

.destination-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  border: 1px solid #f1f2f6;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover { transform: translateY(-4px); box-shadow: 0 15px 35px rgba(0, 0, 0, 0.08); }
}

.dest-title {
  background: #fcfcfc;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-bottom: 2px solid #f8f9fa;

  .dest-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    color: $color-info;
  }

  .dest-info {
    flex: 1;
    h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b; }
    .dest-total { font-size: 0.8rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
  }
}

.round-section {
  & + .round-section { border-top: 2px dashed #e2e8f0; }
}

.round-badge-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: linear-gradient(135deg, #ede9fe, #f3e8ff);
  border-bottom: 1px solid #ddd6fe;
  font-size: 0.8rem;
  font-weight: 800;
  color: #7c3aed;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  i { font-size: 0.75rem; }

  .round-total {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(124, 58, 237, 0.12);
    padding: 2px 8px;
    border-radius: 10px;
    color: #6d28d9;
  }
}

.cat-section {
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
}

.cat-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.9rem;
  border: none;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: filter 0.15s;

  &:hover { filter: brightness(0.96); }

  .cat-name { display: flex; align-items: center; gap: 0.5rem; }

  .cat-chevron {
    font-size: 0.65rem;
    transition: transform 0.2s;
    &.open { transform: rotate(90deg); }
  }

  .cat-qty {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.08);
  }

  &.cat--tortas { background: #ede9fe; color: #5b21b6; }
  &.cat--tortas-porción { background: #e0e7ff; color: #3730a3; }
  &.cat--joyitas { background: #fce7f3; color: #9d174d; }
  &.cat--bollería { background: #fef3c7; color: #92400e; }
  &.cat--galletería { background: #ffedd5; color: #9a3412; }
  &.cat--siropes { background: #ccfbf1; color: #134e4a; }
  &.cat--vegetales { background: #dcfce7; color: #14532d; }
  &.cat--heladería { background: #dbeafe; color: #1e3a5f; }
  &.cat--casa-mia { background: #ffe4e6; color: #9f1239; }
  &.cat--otros { background: #f1f5f9; color: #475569; }
}

.cat-collapse-enter-active,
.cat-collapse-leave-active { transition: all 0.22s ease; overflow: hidden; }
.cat-collapse-enter-from,
.cat-collapse-leave-to { opacity: 0; max-height: 0; }
.cat-collapse-enter-to,
.cat-collapse-leave-from { opacity: 1; max-height: 1000px; }

.raw-table {
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 0.75rem;
    font-size: 0.9rem;
    color: #334155;
    border-bottom: 1px solid #f8fafc;
    font-weight: 500;
  }

  .col-qty {
    text-align: right;
    width: 70px;
    strong { color: $color-info; font-weight: 800; font-size: 1rem; }
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fdfdfd; }
}

.raw-row {
  cursor: pointer;
  transition: all 0.2s;

  &:hover { background: #f8fafc !important; }

  &.selected {
    background: rgba(142, 68, 173, 0.05) !important;
    td { color: #8e44ad !important; font-weight: 700; }
  }
}

.col-check { width: 40px; padding-right: 0; }

.custom-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  background: white;

  i { font-size: 0.8rem; color: white; }
  &.checked { background: #8e44ad; border-color: #8e44ad; }
}

.pending-qty {
  strong { color: #e67e22 !important; }
}
</style>
