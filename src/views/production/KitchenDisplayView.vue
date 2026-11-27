<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ProductionService from '@/services/production.service'

interface KitchenItem {
  name: string
  quantity: number
  category: string
  isDelayed: boolean
}

const items = ref<KitchenItem[]>([])
const isLoading = ref(true)
const lastRefresh = ref<Date>(new Date())
const now = ref<Date>(new Date())
const REFRESH_INTERVAL = 30_000 // 30 seconds

let refreshTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

const CATEGORY_ORDER = [
  'cakes enteros',
  'cakes porcion',
  'pack de turrones',
  'panetton',
  'secos market',
  'individual',
  'panaderia',
]

const groupedItems = computed(() => {
  const groups: Record<string, KitchenItem[]> = {}
  items.value.forEach(item => {
    const cat = item.category || 'Otros'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  })

  return Object.entries(groups)
    .map(([name, list]) => ({ name, list }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.name.toLowerCase())
      const ib = CATEGORY_ORDER.indexOf(b.name.toLowerCase())
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
})

const totalPending = computed(() => items.value.reduce((acc, i) => acc + i.quantity, 0))
const hasDelayed = computed(() => items.value.some(i => i.isDelayed))

const processBucket = (raw: any[], isDelayed: boolean): KitchenItem[] => {
  if (!raw || !Array.isArray(raw)) return []
  return raw
    .map(group => {
      const pending = (group.orders || [])
        .filter((o: any) => o.stage !== 'FINISHED')
        .reduce((acc: number, o: any) => acc + (o.pendingInOrder ?? o.quantity ?? 0), 0)
      if (pending <= 0) return null
      return {
        name: group._id as string,
        quantity: pending,
        category: group.category || 'Otros',
        isDelayed
      }
    })
    .filter(Boolean) as KitchenItem[]
}

const fetchData = async () => {
  try {
    const [delayedRes, todayRes] = await Promise.all([
      ProductionService.getSummary('delayed'),
      ProductionService.getSummary('today')
    ])

    const delayed = processBucket((delayedRes as any)?.delayed ?? [], true)
    const today = processBucket((todayRes as any)?.today ?? [], false)

    // Merge: if same product appears in both, sum quantities
    const merged: Record<string, KitchenItem> = {}
    ;[...delayed, ...today].forEach(item => {
      const existing = merged[item.name]
      if (existing) {
        existing.quantity += item.quantity
        if (item.isDelayed) existing.isDelayed = true
      } else {
        merged[item.name] = { ...item }
      }
    })

    items.value = Object.values(merged)
    lastRefresh.value = new Date()
  } catch (err) {
    console.error('Kitchen display fetch error:', err)
  } finally {
    isLoading.value = false
  }
}

const clockLabel = computed(() => {
  return now.value.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
})

const dateLabel = computed(() => {
  const s = now.value.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1) // "Viernes, 27 de noviembre"
})

const secondsToNextRefresh = computed(() => {
  const elapsed = (new Date().getTime() - lastRefresh.value.getTime()) / 1000
  return Math.max(0, Math.round(REFRESH_INTERVAL / 1000 - elapsed))
})

const logout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  window.location.href = '/login'
}

onMounted(() => {
  fetchData()
  refreshTimer = setInterval(fetchData, REFRESH_INTERVAL)
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="kitchen-screen">
    <!-- Header Bar -->
    <header class="kitchen-header">
      <div class="header-left">
        <span class="brand">
          <i class="fas fa-utensils"></i> Nicole Pastry Arts
        </span>
        <span class="date-label">{{ dateLabel }}</span>
      </div>
      <div class="header-center">
        <span class="clock">{{ clockLabel }}</span>
      </div>
      <div class="header-right">
        <span class="refresh-badge" :class="{ refreshing: isLoading }">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
          {{ isLoading ? 'Actualizando...' : `${secondsToNextRefresh}s` }}
        </span>
        <button class="btn-logout" @click="logout" title="Cerrar sesión">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading && items.length === 0" class="full-center">
      <div class="big-spinner"></div>
      <p class="loading-text">Cargando orden del día...</p>
    </div>

    <!-- All Done -->
    <div v-else-if="!isLoading && items.length === 0" class="full-center all-done">
      <i class="fas fa-check-circle done-icon"></i>
      <h2>¡Todo producido!</h2>
      <p>No hay ítems pendientes para hoy.</p>
    </div>

    <!-- Main Content -->
    <main v-else class="kitchen-body">
      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-stat">
          <span class="stat-num">{{ totalPending }}</span>
          <span class="stat-label">unidades pendientes</span>
        </div>
        <div class="summary-stat">
          <span class="stat-num">{{ items.length }}</span>
          <span class="stat-label">productos distintos</span>
        </div>
        <div class="summary-stat delayed-stat" v-if="hasDelayed">
          <i class="fas fa-exclamation-triangle"></i>
          <span class="stat-label">HAY ÍTEMS ATRASADOS</span>
        </div>
      </div>

      <!-- Categories & Items -->
      <div class="categories-grid">
        <div
          v-for="group in groupedItems"
          :key="group.name"
          class="category-block"
        >
          <div class="category-title">
            <i class="fas fa-layer-group"></i>
            {{ group.name }}
          </div>
          <div class="items-list">
            <div
              v-for="item in group.list"
              :key="item.name"
              class="item-row"
              :class="{ 'item-delayed': item.isDelayed }"
            >
              <div class="item-name">
                <span v-if="item.isDelayed" class="delayed-tag">ATRASADO</span>
                {{ item.name }}
              </div>
              <div class="item-qty">
                <span class="qty-num">{{ item.quantity }}</span>
                <span class="qty-unit">u</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// Full-screen dark display optimized for kitchen TVs / tablets
.kitchen-screen {
  min-height: 100vh;
  min-height: 100dvh;
  background: #0d0f14;
  color: #f1f5f9;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', system-ui, sans-serif;
  overflow-y: auto;
}

// ─── HEADER ────────────────────────────────────────────────────────────────
.kitchen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #161b26;
  border-bottom: 2px solid #1e2736;
  flex-shrink: 0;

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;

    .brand {
      font-size: 1rem;
      font-weight: 800;
      color: #818cf8;
      letter-spacing: 0.03em;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      i { font-size: 0.85rem; }
    }

    .date-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
    }
  }

  .header-center {
    .clock {
      font-size: 2.5rem;
      font-weight: 900;
      color: #f8fafc;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;

      @media (min-width: 1024px) {
        font-size: 3rem;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;

    .refresh-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #1e2736;
      border: 1px solid #2d3748;
      border-radius: 10px;
      padding: 0.45rem 0.9rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #64748b;

      i { font-size: 0.75rem; }

      &.refreshing {
        color: #818cf8;
        border-color: #818cf8;
      }
    }

    .btn-logout {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid #2d3748;
      background: #1e2736;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      transition: all 0.2s;

      &:hover {
        border-color: #ef4444;
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }
    }
  }
}

// ─── FULL CENTER STATES ────────────────────────────────────────────────────
.full-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  text-align: center;
  padding: 2rem;

  .loading-text {
    font-size: 1.25rem;
    font-weight: 600;
    color: #475569;
  }

  &.all-done {
    .done-icon {
      font-size: 5rem;
      color: #22c55e;
      opacity: 0.8;
    }

    h2 {
      font-size: 2.5rem;
      font-weight: 900;
      color: #22c55e;
      margin: 0;
    }

    p {
      font-size: 1.25rem;
      font-weight: 600;
      color: #475569;
    }
  }
}

.big-spinner {
  width: 80px;
  height: 80px;
  border: 6px solid #1e2736;
  border-top-color: #818cf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ─── MAIN BODY ─────────────────────────────────────────────────────────────
.kitchen-body {
  flex: 1;
  padding: 1.5rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

// ─── SUMMARY BAR ───────────────────────────────────────────────────────────
.summary-bar {
  display: flex;
  align-items: center;
  gap: 2rem;
  background: #161b26;
  border: 1px solid #1e2736;
  border-radius: 18px;
  padding: 1rem 2rem;
  flex-wrap: wrap;

  .summary-stat {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;

    .stat-num {
      font-size: 2rem;
      font-weight: 900;
      color: #818cf8;
      font-variant-numeric: tabular-nums;

      @media (min-width: 1024px) {
        font-size: 2.5rem;
      }
    }

    .stat-label {
      font-size: 0.85rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }

  .delayed-stat {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 1rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1.5px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;

    i {
      color: #ef4444;
      font-size: 1rem;
    }

    .stat-label {
      color: #ef4444;
      font-size: 0.8rem;
      font-weight: 900;
    }
  }
}

// ─── CATEGORIES GRID ───────────────────────────────────────────────────────
.categories-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;

  @media (min-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.category-block {
  background: #161b26;
  border: 1px solid #1e2736;
  border-radius: 20px;
  overflow: hidden;
}

.category-title {
  padding: 0.9rem 1.5rem;
  background: #1a2035;
  font-size: 0.8rem;
  font-weight: 900;
  color: #818cf8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid #1e2736;

  i { font-size: 0.75rem; opacity: 0.7; }
}

.items-list {
  display: flex;
  flex-direction: column;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #1a2035;
  transition: background 0.15s;

  &:last-child { border-bottom: none; }

  &:hover { background: #1a2035; }

  &.item-delayed {
    background: rgba(239, 68, 68, 0.05);
    border-left: 3px solid #ef4444;

    .item-name { color: #fca5a5; }
    .qty-num { color: #f87171; }
  }

  .item-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #e2e8f0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;

    @media (min-width: 1024px) {
      font-size: 1.2rem;
    }

    .delayed-tag {
      font-size: 0.62rem;
      font-weight: 900;
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 6px;
      padding: 0.15rem 0.5rem;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
  }

  .item-qty {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
    flex-shrink: 0;
    margin-left: 1rem;

    .qty-num {
      font-size: 2rem;
      font-weight: 900;
      color: #f8fafc;
      font-variant-numeric: tabular-nums;
      line-height: 1;

      @media (min-width: 1024px) {
        font-size: 2.5rem;
      }
    }

    .qty-unit {
      font-size: 0.85rem;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
    }
  }
}
</style>
