<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AnalyticsService from '@/services/analytics.service'
import GoalSettingsService from '@/services/goal-settings.service'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

// --- Role-based defaults (fallback when no individual override exists) ---
const MANAGER_ROLE = 'SALES_MANAGER'
const DEFAULT_SELLER_GOAL = 10000
const DEFAULT_MANAGER_GOAL = 7000

const sellerGoal = ref(DEFAULT_SELLER_GOAL)
const managerGoal = ref(DEFAULT_MANAGER_GOAL)
// Per-person overrides: keyed by stat._id (person's name from analytics)
const individualGoals = ref<Record<string, number>>({})
// Dynamic Commission Tiers
const commissionTiers = ref<{ threshold: number; rate: number }[]>([])

const showGoalEditor = ref(false)
const isSavingGoals = ref(false)
const sidebarOpen = ref(false)
const goalSaveStatus = ref<'idle' | 'success' | 'error'>('idle')

const totalSales = ref(0)
const stats = ref<any[]>([])
const isLoading = ref(false)
const dateRange = ref({ from: '', to: '' })
const selectedSource = ref<'nicole' | 'sucree' | null>(null)

/**
 * Returns the effective goal for a stat:
 * 1. Per-person override (if set)
 * 2. Role-based default (managerGoal / sellerGoal)
 */
const getIndividualGoal = (stat: any): number => {
  if (individualGoals.value[stat._id] !== undefined) {
    return individualGoals.value[stat._id]!
  }
  return stat.role?.toUpperCase() === MANAGER_ROLE ? managerGoal.value : sellerGoal.value
}

/** Makes sure every person in stats has a value in the editor draft. */
const buildEditorDraft = () => {
  stats.value.forEach((stat: any) => {
    if (individualGoals.value[stat._id] === undefined) {
      // Pre-populate with the role-based default so the input is never empty
      individualGoals.value[stat._id] =
        stat.role?.toUpperCase() === MANAGER_ROLE ? managerGoal.value : sellerGoal.value
    }
  })
}

/** Team goal = sum of effective goals for each real person in stats. */
const teamGoal = computed(() => {
  if (!stats.value.length) return sellerGoal.value + managerGoal.value
  return stats.value.reduce((acc: number, stat: any) => acc + getIndividualGoal(stat), 0)
})

const totalCommissions = computed(() =>
  stats.value.reduce((acc: number, curr: any) => acc + (curr.commission || 0), 0)
)

const isManager = computed(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (!userInfoStr) return false
  const user = JSON.parse(userInfoStr)
  const role = user.role?.toUpperCase() || ''
  return role === 'SALES_MANAGER' || role === 'ADMIN' || role === 'SALES'
})

const currentUserName = computed(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (!userInfoStr) return ''
  const user = JSON.parse(userInfoStr)
  return user.name || ''
})

const currentUserGoal = computed(() => {
  const name = currentUserName.value
  const myStat = stats.value.find((s: any) => s._id.toLowerCase() === name.toLowerCase())
  if (myStat) {
    return getIndividualGoal(myStat)
  }
  return sellerGoal.value
})

const initDates = () => {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const formatDate = (d: Date): string => d.toISOString().split('T')[0] ?? ''
  dateRange.value.from = formatDate(firstDay)
  dateRange.value.to = formatDate(now)
}

const fetchStats = async () => {
  isLoading.value = true
  try {
    const data = await AnalyticsService.getSalesByResponsible(dateRange.value.from, dateRange.value.to, selectedSource.value ?? undefined)
    stats.value = data.stats
    totalSales.value = data.stats.reduce((acc: number, curr: any) => acc + curr.totalSales, 0)
    if (data.commissionTiers) {
      commissionTiers.value = [...data.commissionTiers]
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    isLoading.value = false
  }
}

const addTier = () => {
  const highest = commissionTiers.value.reduce((acc, curr) => Math.max(acc, curr.threshold), 0)
  commissionTiers.value.push({ threshold: highest + 5000, rate: 0 })
  commissionTiers.value.sort((a, b) => a.threshold - b.threshold)
}

const removeTier = (index: number) => {
  if (commissionTiers.value.length > 1) {
    commissionTiers.value.splice(index, 1)
  }
}

const saveGoals = async () => {
  isSavingGoals.value = true
  goalSaveStatus.value = 'idle'
  try {
    await GoalSettingsService.updateGoals({
      managerGoal: managerGoal.value,
      sellerGoal: sellerGoal.value,
      individualGoals: { ...individualGoals.value },
      commissionTiers: commissionTiers.value,
    })
    goalSaveStatus.value = 'success'
    setTimeout(() => { goalSaveStatus.value = 'idle' }, 2500)
  } catch {
    goalSaveStatus.value = 'error'
    setTimeout(() => { goalSaveStatus.value = 'idle' }, 3000)
  } finally {
    isSavingGoals.value = false
  }
}

const openEditor = () => {
  buildEditorDraft()
  showGoalEditor.value = true
}

// Live commission example for the editor: picks a value just above the last tier
const commissionExampleSales = computed(() => {
  if (!commissionTiers.value.length) return 0
  const sorted = [...commissionTiers.value].sort((a, b) => a.threshold - b.threshold)
  return sorted[sorted.length - 1]!.threshold + 1000
})

const commissionExampleBreakdown = computed(() => {
  if (!commissionTiers.value.length) return []
  const sorted = [...commissionTiers.value].sort((a, b) => a.threshold - b.threshold)

  // As requested, always show a clear, static example of $14,000 in sales
  const exampleSalesValue = 14000

  return sorted.reduce((acc: any[], tier, i) => {
    if (exampleSalesValue > tier.threshold) {
      const next = sorted[i + 1]
      const inTier = Math.min(exampleSalesValue - tier.threshold, next ? next.threshold - tier.threshold : Infinity)
      acc.push({
        from: tier.threshold,
        to: next ? next.threshold : exampleSalesValue,
        rate: tier.rate,
        salesInTier: inTier,
        amount: Math.round(inTier * (tier.rate / 100) * 100) / 100
      })
    }
    return acc
  }, [])
})

const commissionExampleTotal = computed(() =>
  commissionExampleBreakdown.value.reduce((acc, b) => acc + b.amount, 0)
)

onMounted(async () => {
  initDates()
  try {
    const goals = await GoalSettingsService.getGoals()
    managerGoal.value = goals.managerGoal
    sellerGoal.value = goals.sellerGoal
    individualGoals.value = { ...goals.individualGoals }
    if (goals.commissionTiers) {
      commissionTiers.value = [...goals.commissionTiers]
    }
  } catch {
    // Defaults already set via ref initialization
  }
  fetchStats()
})
</script>

<template>
  <div class="page-layout">

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    </Transition>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-head">
        <div class="sidebar-brand">
          <i class="fas fa-chart-line"></i>
          <span>Ventas</span>
        </div>
        <button class="btn-close-sidebar" @click="sidebarOpen = false">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-top">

          <div class="nav-section">
            <span class="section-label">Tienda</span>
            <div class="source-toggle source-toggle--vertical">
              <button
                class="source-btn"
                :class="{ active: selectedSource === null }"
                @click="selectedSource = null; fetchStats()"
              >Ambas</button>
              <button
                class="source-btn nicole"
                :class="{ active: selectedSource === 'nicole' }"
                @click="selectedSource = 'nicole'; fetchStats()"
              >Nicole</button>
              <button
                class="source-btn sucree"
                :class="{ active: selectedSource === 'sucree' }"
                @click="selectedSource = 'sucree'; fetchStats()"
              >Sucree</button>
            </div>
          </div>

          <div class="nav-section">
            <span class="section-label">Período</span>
            <div class="date-field">
              <span class="date-label">Desde</span>
              <CustomDatePicker v-model="dateRange.from" @update:modelValue="fetchStats" />
            </div>
            <div class="date-field">
              <span class="date-label">Hasta</span>
              <CustomDatePicker v-model="dateRange.to" @update:modelValue="fetchStats" />
            </div>
            <button @click="fetchStats; sidebarOpen = false" class="btn-update" :disabled="isLoading">
              <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
              Actualizar
            </button>
          </div>

          <div class="nav-section">
            <span class="section-label">Herramientas</span>
            <button
              v-if="isManager"
              class="nav-pill"
              :class="{ active: showGoalEditor }"
              @click="showGoalEditor ? showGoalEditor = false : openEditor()"
            >
              <i class="fas fa-sliders-h"></i> Configurar Metas
            </button>
          </div>

        </div>

        <div class="nav-bottom">
          <router-link v-if="isManager" to="/admin/users" class="btn-nav-link">
            <i class="fa-solid fa-users-gear"></i>
            <span>Gestionar Equipo</span>
          </router-link>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="main-content">

      <!-- Topbar -->
      <div class="topbar">
        <button class="btn-menu" @click="sidebarOpen = true" title="Filtros">
          <i class="fas fa-sliders-h"></i>
        </button>
        <div class="topbar-title">
          <h1>Ventas & Comisiones</h1>
          <p v-if="!isLoading && stats.length > 0">
            {{ stats.length }} vendedores · {{ dateRange.from }} → {{ dateRange.to }} · solo pedidos con cobro
          </p>
        </div>
        <button @click="fetchStats" class="btn-refresh" :disabled="isLoading" title="Actualizar">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        </button>
      </div>

      <!-- Desktop inline filter bar -->
      <div class="desktop-filters">
        <div class="filter-group">
          <span class="filter-label">Desde</span>
          <CustomDatePicker v-model="dateRange.from" @update:modelValue="fetchStats" />
        </div>
        <div class="filter-group">
          <span class="filter-label">Hasta</span>
          <CustomDatePicker v-model="dateRange.to" @update:modelValue="fetchStats" />
        </div>
        <div class="filter-group">
          <span class="filter-label">Tienda</span>
          <div class="source-toggle">
            <button
              class="source-btn"
              :class="{ active: selectedSource === null }"
              @click="selectedSource = null; fetchStats()"
            >Ambas</button>
            <button
              class="source-btn nicole"
              :class="{ active: selectedSource === 'nicole' }"
              @click="selectedSource = 'nicole'; fetchStats()"
            >Nicole</button>
            <button
              class="source-btn sucree"
              :class="{ active: selectedSource === 'sucree' }"
              @click="selectedSource = 'sucree'; fetchStats()"
            >Sucree</button>
          </div>
        </div>

        <div class="filter-actions">
          <button @click="fetchStats" class="btn-update-inline" :disabled="isLoading">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
            Actualizar
          </button>
          <button
            v-if="isManager"
            class="btn-goal-inline"
            :class="{ active: showGoalEditor }"
            @click="showGoalEditor ? showGoalEditor = false : openEditor()"
          >
            <i class="fas fa-sliders-h"></i>
            Configurar Metas
          </button>
          <router-link v-if="isManager" to="/admin/users" class="btn-manage-inline">
            <i class="fa-solid fa-users-gear"></i>
            Gestionar Equipo
          </router-link>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Calculando estadísticas...</span>
      </div>

      <template v-else>

      <!-- Goal Editor Panel -->
      <div v-if="showGoalEditor" class="goal-editor-panel">
        <div class="goal-editor-header">
          <div class="editor-title">
            <i class="fas fa-sliders-h"></i>
            <span>Configurar Metas Individuales</span>
          </div>
          <button class="btn-close-editor" @click="showGoalEditor = false">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- How it works -->
        <div class="how-it-works">
          <div class="how-steps">
            <div class="how-step">
              <div class="step-icon step-lock"><i class="fas fa-lock"></i></div>
              <div class="step-content">
                <strong>Sin comisión</strong>
                <span>Si el vendedor no alcanza su meta, gana $0 de comisión.</span>
              </div>
            </div>
            <div class="step-arrow"><i class="fas fa-arrow-right"></i></div>
            <div class="how-step">
              <div class="step-icon step-unlock"><i class="fas fa-unlock"></i></div>
              <div class="step-content">
                <strong>Al alcanzar la meta</strong>
                <span>Las escalas se activan y se aplican desde $0 sobre el total.</span>
              </div>
            </div>
            <div class="step-arrow"><i class="fas fa-arrow-right"></i></div>
            <div class="how-step">
              <div class="step-icon step-money"><i class="fas fa-coins"></i></div>
              <div class="step-content">
                <strong>Comisión progresiva</strong>
                <span>Cada tramo se calcula por separado y se suman al total.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Role defaults -->
        <div class="editor-section-label">Metas por defecto (por rol)
          <span class="section-hint">· Monto mínimo para desbloquear comisión</span>
        </div>
        <div class="goal-editor-fields">
          <div class="goal-field">
            <label><i class="fas fa-user-tie"></i> Jefe de Ventas (default)</label>
            <div class="input-prefix">
              <span>$</span>
              <input type="number" v-model.number="managerGoal" min="0" step="500" />
            </div>
          </div>
          <div class="goal-field">
            <label><i class="fas fa-user"></i> Vendedor (default)</label>
            <div class="input-prefix">
              <span>$</span>
              <input type="number" v-model.number="sellerGoal" min="0" step="500" />
            </div>
          </div>
        </div>

        <!-- Per-person overrides -->
        <div class="editor-section-label" style="margin-top: 1.25rem;">
          <span>Meta por persona</span>
          <span class="section-hint">Sobreescribe el default para cada vendedor</span>
        </div>
        <div class="person-goals-list">
          <div v-for="stat in stats" :key="stat._id" class="person-goal-row">
            <div class="person-info">
              <span class="person-avatar">{{ stat._id.charAt(0) }}</span>
              <div class="person-details">
                <span class="person-name">{{ stat._id }}</span>
                <span class="person-role-chip" :class="stat.role.toLowerCase()">{{ stat.role }}</span>
                <span class="person-current-sales">
                  <i class="fas fa-dollar-sign"></i>
                  {{ stat.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 }) }} vendidos
                  <span
                    v-if="stat.goalReached"
                    class="goal-status-badge reached"
                  ><i class="fas fa-check-circle"></i> Meta alcanzada</span>
                  <span v-else class="goal-status-badge pending">
                    Falta ${{ (getIndividualGoal(stat) - stat.totalSales).toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
                  </span>
                </span>
              </div>
            </div>
            <div class="person-right">
              <label class="person-goal-label">Meta</label>
              <div class="input-prefix person-input">
                <span>$</span>
                <input
                  type="number"
                  :value="individualGoals[stat._id]"
                  @input="individualGoals[stat._id] = Number(($event.target as HTMLInputElement).value)"
                  min="0"
                  step="500"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Commission Tiers -->
        <div class="editor-section-label" style="margin-top: 1.25rem;">
          <span>Escalas de Comisión</span>
          <span class="section-hint">Define los % que aplican según las metas</span>
        </div>
        <div class="commission-tiers-editor">
          <div v-for="(tier, index) in commissionTiers" :key="index" class="tier-row">
            <div class="tier-col">
              <label>Desde</label>
              <div class="input-prefix">
                <span>$</span>
                <input type="number" v-model.number="tier.threshold" min="0" step="500" />
              </div>
            </div>
            <div class="tier-col">
              <label>Tasa</label>
              <div class="input-postfix">
                <input type="number" v-model.number="tier.rate" min="0" max="100" step="1" />
                <span>%</span>
              </div>
            </div>
            <button class="btn-remove-tier" @click="removeTier(index)" title="Eliminar escala" :disabled="commissionTiers.length <= 1">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <button class="btn-add-tier" @click="addTier">
            <i class="fas fa-plus"></i> Añadir Escala
          </button>
        </div>

        <!-- Live commission example -->
        <div v-if="commissionExampleBreakdown.length" class="commission-example">
          <div class="example-header">
            <i class="fas fa-calculator"></i>
            <span>Ejemplo con <strong>$14,000</strong> en ventas (meta = <strong>${{ sellerGoal.toLocaleString() }}</strong>):</span>
          </div>
          <div class="example-rows">
            <div v-for="(bracket, i) in commissionExampleBreakdown" :key="i" class="example-row">
              <span class="example-range">${{ bracket.from.toLocaleString() }} → ${{ bracket.to.toLocaleString() }}</span>
              <span class="example-calc">${{ bracket.salesInTier.toLocaleString() }} × {{ bracket.rate }}%</span>
              <span class="example-result">= <strong>${{ bracket.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</strong></span>
            </div>
            <div class="example-total">
              <span>Comisión total estimada:</span>
              <strong>${{ commissionExampleTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</strong>
            </div>
          </div>
        </div>

        <!-- Footer: computed total + save -->
        <div class="editor-footer">
          <div class="goal-total-preview">
            <span class="preview-label">Meta Total del Equipo</span>
            <span class="computed-total">${{ teamGoal.toLocaleString() }}</span>
          </div>
          <button
            class="btn-save-goals"
            :class="{ saving: isSavingGoals, saved: goalSaveStatus === 'success', error: goalSaveStatus === 'error' }"
            :disabled="isSavingGoals"
            @click="saveGoals"
          >
            <i v-if="isSavingGoals" class="fas fa-spinner fa-spin"></i>
            <i v-else-if="goalSaveStatus === 'success'" class="fas fa-check"></i>
            <i v-else-if="goalSaveStatus === 'error'" class="fas fa-times"></i>
            <i v-else class="fas fa-save"></i>
            <span v-if="isSavingGoals">Guardando...</span>
            <span v-else-if="goalSaveStatus === 'success'">¡Guardado!</span>
            <span v-else-if="goalSaveStatus === 'error'">Error al guardar</span>
            <span v-else>Guardar cambios</span>
          </button>
        </div>
      </div>

      <div v-else class="content-body">
      <div class="results-grid">
        <!-- Goal Progress Card -->
        <div class="summary-card goal-card">
          <div class="goal-header">
            <h3>Meta del Equipo</h3>
            <div class="goal-header-right">
              <span class="goal-value">${{ teamGoal.toLocaleString() }}</span>
              <button v-if="isManager" class="btn-edit-goal" @click="openEditor" title="Editar metas">
                <i class="fas fa-pen"></i>
              </button>
            </div>
          </div>
          <div class="progress-container">
            <div
              class="progress-bar"
              :style="{ width: Math.min((totalSales / teamGoal) * 100, 100) + '%' }"
              :class="{ 'success': totalSales >= teamGoal }"
            ></div>
          </div>
          <div class="goal-details">
            <span>Progreso: <strong>{{ ((totalSales / teamGoal) * 100).toFixed(1) }}%</strong></span>
            <span>Faltante: <strong>${{ Math.max(teamGoal - totalSales, 0).toLocaleString() }}</strong></span>
          </div>
          <div class="goal-breakdown">
            <span class="breakdown-item">
              <i class="fas fa-user-tie"></i>
              Jefe de Ventas: <strong>${{ managerGoal.toLocaleString() }}</strong>
            </span>
            <span class="breakdown-sep">+</span>
            <span class="breakdown-item">
              <i class="fas fa-users"></i>
              Vendedores: <strong>${{ (teamGoal - managerGoal).toLocaleString() }}</strong>
            </span>
          </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-card total">
          <h3>Venta Total</h3>
          <p class="value">${{ totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>

        <div class="summary-card commission">
          <h3>Comisión Total Estimada</h3>
          <p class="value total-commission">${{ totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>

        <div class="summary-card count">
          <h3>Total Pedidos</h3>
          <p class="value">{{stats.reduce((acc, curr) => acc + curr.count, 0)}}</p>
        </div>
      </div>

      <!-- Tiers Explanation -->
      <div v-if="commissionTiers.length" class="commission-info-bar">
        <div class="info-item">
          <i class="fas fa-lock"></i>
          <span class="info-rule-label">Se desbloquea al alcanzar la meta individual:</span>
          <span v-for="(tier, index) in commissionTiers" :key="index" class="tier">
            <template v-if="index < commissionTiers.length - 1">
              ${{ (tier.threshold / 1000).toFixed(0) }}k–${{ ((commissionTiers[index + 1]?.threshold ?? 0) / 1000).toFixed(0) }}k: <strong>{{ tier.rate }}%</strong>
            </template>
            <template v-else>
              &gt;${{ (tier.threshold / 1000).toFixed(0) }}k: <strong>{{ tier.rate }}%</strong>
            </template>
          </span>
        </div>
      </div>

      <!-- Live commission example shown for everyone -->
      <div v-if="commissionExampleBreakdown.length && !isManager" class="commission-example public-view">
        <div class="example-header">
          <i class="fas fa-calculator"></i>
          <span>Ejemplo de cómo se calcula la comisión con <strong>$14,000</strong> en ventas (tu meta = <strong>${{ currentUserGoal.toLocaleString() }}</strong>):</span>
        </div>
        <div class="example-rows">
          <div v-for="(bracket, i) in commissionExampleBreakdown" :key="i" class="example-row">
            <span class="example-range">${{ bracket.from.toLocaleString() }} → ${{ bracket.to.toLocaleString() }}</span>
            <span class="example-calc">${{ bracket.salesInTier.toLocaleString() }} × {{ bracket.rate }}%</span>
            <span class="example-result">= <strong>${{ bracket.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</strong></span>
          </div>
          <div class="example-total">
            <span>Comisión total estimada en el ejemplo:</span>
            <strong>${{ commissionExampleTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</strong>
          </div>
        </div>
      </div>

      <div v-if="!isLoading" class="table-container" style="margin-top: 0">
        <table>
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Rol</th>
              <th>Pedidos</th>
              <th>Total Ventas</th>
              <th>Meta Individual</th>
              <th>Progreso</th>
              <th>Comisión</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in stats" :key="stat._id">
              <td class="responsible-name">
                <span class="avatar-circle">{{ stat._id.charAt(0) }}</span>
                {{ stat._id }}
              </td>
              <td>
                <span class="role-badge" :class="stat.role.toLowerCase()">{{ stat.role }}</span>
              </td>
              <td>{{ stat.count }}</td>
              <td class="amount">${{ stat.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</td>
              <td class="individual-goal">
                ${{ getIndividualGoal(stat).toLocaleString() }}
              </td>
              <td class="progress-cell">
                <div class="mini-progress-wrap">
                  <div class="mini-progress-bar">
                    <div
                      class="mini-progress-fill"
                      :style="{ width: Math.min((stat.totalSales / getIndividualGoal(stat)) * 100, 100) + '%' }"
                      :class="{ 'done': stat.totalSales >= getIndividualGoal(stat) }"
                    ></div>
                  </div>
                  <span class="mini-progress-pct">
                    {{ ((stat.totalSales / getIndividualGoal(stat)) * 100).toFixed(0) }}%
                  </span>
                </div>
              </td>
              <td class="commission-cell">
                <span v-if="stat.commission > 0" class="commission-value">
                  ${{ stat.commission.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
                </span>
                <span v-else-if="!stat.goalReached" class="commission-locked" :title="`Falta $${(getIndividualGoal(stat) - stat.totalSales).toLocaleString(undefined, { maximumFractionDigits: 2 })} para desbloquear`">
                  <i class="fas fa-lock"></i>
                  Falta ${{ (getIndividualGoal(stat) - stat.totalSales).toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
                </span>
                <span v-else class="no-commission">—</span>
              </td>
            </tr>
            <tr v-if="stats.length === 0">
              <td colspan="7" class="empty-cell">No hay datos en este rango de fechas</td>
            </tr>
          </tbody>
        </table>
      </div>
      </div> <!-- /content-body -->

      </template>
    </div> <!-- /main-content -->
  </div> <!-- /page-layout -->
</template>

<style lang="scss" scoped>
// ── Two-panel layout ────────────────────────────────────
.page-layout {
  display: flex;
  min-height: 100vh;
  background: $NICOLE-CREAM;
  position: relative;
}

// ── Sidebar (mobile-only) ────────────────────────────────
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid $border-light;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;

  @media (min-width: 768px) { display: none; }

  @media (max-width: 767px) {
    position: fixed;
    left: 0;
    top: 52px;
    height: calc(100% - 52px);
    z-index: 300;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
    &.sidebar-open { transform: translateX(0); }
  }
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 299;
  @media (min-width: 768px) { display: none; }
  backdrop-filter: blur(2px);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1rem 0.9rem;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: $NICOLE-PURPLE;
    font-weight: 800;
    font-size: 0.95rem;
    i { font-size: 0.95rem; }
  }

  .btn-close-sidebar {
    width: 28px;
    height: 28px;
    border: none;
    background: $gray-100;
    border-radius: 6px;
    color: $text-light;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    transition: all 0.15s;
    &:hover { background: $gray-200; color: $text-dark; }
    @media (min-width: 1024px) { display: none; }
  }
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 1rem 0.85rem 1.1rem;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.nav-top { display: flex; flex-direction: column; }

.nav-bottom {
  padding-top: 0.9rem;
  border-top: 1px solid $border-light;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
}

.section-label {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: $gray-500;
  padding: 0 0.2rem;
  margin-bottom: 0.1rem;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  .date-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: $text-light;
    padding: 0 0.1rem;
  }
}

.btn-update {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: opacity 0.2s;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.nav-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: $text-light;
  font-size: 0.87rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  i { width: 13px; text-align: center; font-size: 0.78rem; }
  &:hover { background: $gray-100; color: $text-dark; }
  &.active { background: rgba($NICOLE-PURPLE, 0.08); color: $NICOLE-PURPLE; font-weight: 700; }
}

.btn-nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 0.65rem;
  border-radius: 7px;
  border: 1px solid $border-light;
  background: $gray-50;
  color: $text-dark;
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
  &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; background: rgba($NICOLE-PURPLE, 0.04); }
  i { font-size: 0.88rem; }
}

// ── Desktop filter bar ───────────────────────────────────
.desktop-filters {
  display: none;

  @media (min-width: 768px) {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 1.25rem;
    background: white;
    border: 1px solid $border-light;
    border-radius: 14px;
    padding: 1rem 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  }
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 0 0 210px;
}

.filter-label {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: $gray-500;
}

.filter-actions {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
  margin-left: auto;
  flex-shrink: 0;
  flex-wrap: wrap;
  padding-left: 1.25rem;
  border-left: 1px solid $border-light;
}

.btn-update-inline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  height: 42px;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.87rem;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.btn-goal-inline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  height: 42px;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: $gray-50;
  color: $text-dark;
  font-size: 0.87rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; background: rgba($NICOLE-PURPLE, 0.04); }
  &.active { background: rgba($NICOLE-PURPLE, 0.09); color: $NICOLE-PURPLE; border-color: rgba($NICOLE-PURPLE, 0.3); }
}

.btn-manage-inline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  height: 42px;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: $gray-50;
  color: $text-dark;
  font-size: 0.87rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.15s;
  &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; background: rgba($NICOLE-PURPLE, 0.04); }
}

// ── Main content ─────────────────────────────────────────
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 1.5rem));
  gap: 1.25rem;
  @media (min-width: 1024px) {
    padding: 2rem;
    padding-bottom: max(2rem, env(safe-area-inset-bottom, 2rem));
  }
}

// ── Topbar ───────────────────────────────────────────────
.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 1px solid $border-light;
  border-radius: 14px;
  padding: 0.9rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);

  .btn-menu {
    width: 38px; height: 38px;
    border: 1px solid $border-light;
    background: white;
    border-radius: 9px;
    color: $NICOLE-PURPLE;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover { background: rgba($NICOLE-PURPLE, 0.06); border-color: rgba($NICOLE-PURPLE, 0.3); }
    @media (min-width: 768px) { display: none; }
  }

  .topbar-title {
    flex: 1;
    h1 { margin: 0; font-size: 1.2rem; font-weight: 800; color: $NICOLE-PURPLE; }
    p { margin: 0; font-size: 0.78rem; color: $gray-500; font-weight: 500; }
  }

  .btn-refresh {
    width: 38px; height: 38px;
    border-radius: 9px;
    border: 1px solid $border-light;
    background: white;
    color: $text-light;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.95rem;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover { color: $NICOLE-PURPLE; border-color: rgba($NICOLE-PURPLE, 0.3); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

// ── Content body ─────────────────────────────────────────
.content-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.commission-info-bar {
  background: #fdf2f8;
  border: 1px solid #fbcfe8;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;

  .info-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    color: $NICOLE-PURPLE;
    font-size: 0.9rem;

    i {
      font-size: 1.1rem;
    }

    .tier {
      background: white;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      border: 1px solid #f9a8d4;
      font-family: monospaced;
    }
  }
}

.summary-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid $border-light;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: $text-light;
    font-weight: 500;
  }

  .value {
    font-size: 2rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    margin: 0;
  }

  &.commission {
    border-left: 4px solid #f59e0b; // Amber highlight for commission

    .total-commission {
      color: #b45309;
    }
  }

  /* Goal Card Specifics */
  &.goal-card {
    grid-column: span 2;
    gap: 0.75rem;

    @media(max-width: 768px) {
      grid-column: span 1;
    }

    .goal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0;
      }

      .goal-header-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .goal-value {
        font-weight: 700;
        color: $text-dark;
        font-size: 1.1rem;
      }

      .btn-edit-goal {
        background: rgba($NICOLE-PURPLE, 0.08);
        border: 1px solid rgba($NICOLE-PURPLE, 0.2);
        color: $NICOLE-PURPLE;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s ease;

        &:hover {
          background: rgba($NICOLE-PURPLE, 0.15);
          transform: scale(1.05);
        }
      }
    }

    .progress-container {
      height: 12px;
      background: #f1f5f9;
      border-radius: 6px;
      overflow: hidden;
      width: 100%;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #a855f7, $NICOLE-PURPLE);
      border-radius: 6px;
      transition: width 0.6s ease;

      &.success {
        background: linear-gradient(90deg, #22c55e, #16a34a);
      }
    }

    .goal-details {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      color: $text-light;

      strong {
        color: $text-dark;
      }
    }

    .goal-breakdown {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-top: 0.5rem;
      border-top: 1px dashed $border-light;
      font-size: 0.8rem;
      color: $text-light;
      flex-wrap: wrap;

      .breakdown-item {
        display: flex;
        align-items: center;
        gap: 0.35rem;

        i {
          color: $NICOLE-PURPLE;
          font-size: 0.75rem;
        }

        strong {
          color: $text-dark;
        }
      }

      .breakdown-sep {
        font-weight: 700;
        color: $text-light;
      }
    }
  }
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  table {
    width: 100%;
    min-width: 620px;
    border-collapse: collapse;

    thead {
      background: $gray-50;

      th {
        padding: 1rem;
        text-align: left;
        font-family: $font-secondary;
        font-weight: 600;
        color: $text-light;
        font-size: 0.9rem;
        border-bottom: 1px solid $border-light;
      }

      th:last-child {
        text-align: right;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid $border-light;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: $gray-50;
        }
      }

      td {
        padding: 1rem;
        font-size: 1rem;
        color: $text-dark;

        &.amount {
          font-weight: 600;
          color: $NICOLE-SECONDARY;
        }

        &.commission-cell {
          text-align: right;
          font-weight: 700;

          .commission-value {
            color: #b45309;
            background: #fef3c7;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
          }

          .no-commission {
            color: $text-light;
            font-weight: 400;
          }

          .commission-locked {
            color: #92400e;
            font-size: 0.8rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;

            i {
              font-size: 0.75rem;
              color: #d97706;
            }
          }
        }

        &:last-child {
          text-align: right;
        }
      }
    }
  }
}

.responsible-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;

  .avatar-circle {
    width: 32px;
    height: 32px;
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 700;
  }
}

.role-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;

  &.digital {
    background: #e0f2fe;
    color: #0369a1;
  }

  &.comercial {
    background: #f0fdf4;
    color: #15803d;
  }

  &.vendedor {
    background: #f3f4f6;
    color: #4b5563;
  }
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 1rem;
  gap: 1rem;
  color: $text-light;

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.2);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-cell {
  text-align: center;
  padding: 2rem !important;
  color: $text-light;
}

// --- Live Commission Example (Shared) ---
.commission-example {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.9rem 1rem;
  margin-bottom: 1.5rem;

  &.public-view {
    margin: 0 0 1.5rem 0; // Removed horizontal margin to align with table/grid
  }

  .example-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
    color: #92400e;
    margin-bottom: 0.75rem;

    i { color: #d97706; }
  }

  .example-rows {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .example-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: $text-dark;
    padding: 0.3rem 0.5rem;
    background: rgba(255,255,255,0.6);
    border-radius: 6px;

    .example-range { color: $text-light; }
    .example-calc { text-align: center; color: #b45309; }
    .example-result { text-align: right; }
  }

  .example-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed #fbbf24;
    font-size: 0.85rem;
    color: #92400e;
    font-weight: 600;

    strong {
      font-size: 1rem;
      color: #d97706;
    }
  }
}

// --- Goal Editor Panel ---
.goal-editor-panel {
  background: white;
  border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  border-radius: 14px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 24px rgba($NICOLE-PURPLE, 0.09);

  .goal-editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    .editor-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      color: $NICOLE-PURPLE;
      font-size: 0.95rem;

      i {
        font-size: 1rem;
      }
    }

    .btn-close-editor {
      background: $gray-50;
      border: 1px solid $border-light;
      color: $text-light;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;

      &:hover {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #dc2626;
      }
    }
  }

  .editor-section-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: $text-light;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.75rem;

    .section-hint {
      font-size: 0.78rem;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: $text-light;
      font-style: italic;
    }
  }

  .goal-editor-fields {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: flex-end;
    padding-bottom: 1.25rem;
    border-bottom: 1px dashed $border-light;
  }

  .goal-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: $text-light;
      display: flex;
      align-items: center;
      gap: 0.35rem;

      i {
        color: $NICOLE-PURPLE;
      }
    }
  }

  .input-prefix {
    display: flex;
    align-items: center;
    border: 1px solid $border-light;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }

    span {
      padding: 0.6rem 0.75rem;
      background: $gray-50;
      color: $text-light;
      font-weight: 600;
      font-size: 0.95rem;
      border-right: 1px solid $border-light;
    }

    input {
      border: none;
      outline: none;
      padding: 0.6rem 0.75rem;
      font-family: $font-secondary;
      font-size: 0.95rem;
      color: $text-dark;
      width: 120px;
      background: white;
    }
  }

  // Per-person list
  .person-goals-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .person-goal-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background: $gray-50;
    border: 1px solid $border-light;
    transition: border-color 0.2s;

    &:hover {
      border-color: rgba($NICOLE-PURPLE, 0.2);
    }

    .person-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .person-avatar {
        width: 36px;
        height: 36px;
        background: rgba($NICOLE-PURPLE, 0.12);
        color: $NICOLE-PURPLE;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.95rem;
        flex-shrink: 0;
      }

      .person-name {
        font-weight: 700;
        color: $text-dark;
        font-size: 0.95rem;
        display: block;
      }

      .person-role-chip {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 0.15rem 0.5rem;
        border-radius: 100px;
        margin-top: 0.15rem;
        display: inline-block;

        &.sales_manager {
          background: #eff6ff;
          color: #2563eb;
        }

        &.sales_rep {
          background: #f0fdf4;
          color: #16a34a;
        }
      }
    }

    .person-input {
      input {
        width: 100px;
      }
    }
  }

  // Commission Tiers Editor
  .commission-tiers-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;

    .tier-row {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      padding: 0.75rem;
      background: $gray-50;
      border-radius: 8px;
      border: 1px solid $border-light;

      .tier-col {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        label {
          font-size: 0.75rem;
          font-weight: 700;
          color: $text-light;
          text-transform: uppercase;
        }

        .input-postfix {
          display: flex;
          align-items: center;
          border: 1px solid $border-light;
          border-radius: 8px;
          overflow: hidden;
          background: white;
          transition: border-color 0.2s;

          &:focus-within {
            border-color: $NICOLE-PURPLE;
            box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
          }

          input {
            border: none;
            outline: none;
            padding: 0.6rem 0.75rem;
            width: 70px;
            font-family: $font-secondary;
            font-size: 0.95rem;
            color: $text-dark;
          }

          span {
            padding: 0.6rem 0.75rem;
            background: $gray-50;
            color: $text-light;
            font-weight: 600;
            font-size: 0.95rem;
            border-left: 1px solid $border-light;
          }
        }

        .input-prefix input {
          width: 90px;
        }
      }

      .btn-remove-tier {
        background: transparent;
        border: 1px solid transparent;
        color: $text-light;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover:not(:disabled) {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }
    }

    .btn-add-tier {
      align-self: flex-start;
      background: transparent;
      border: 1px dashed rgba($text-light, 0.4);
      color: $text-dark;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;

      &:hover {
        background: rgba($NICOLE-PURPLE, 0.05);
        border-color: $NICOLE-PURPLE;
        color: $NICOLE-PURPLE;
      }
    }
  }

  // How it works box
  .how-it-works {
    background: #f5f3ff;
    border: 1px solid rgba($NICOLE-PURPLE, 0.2);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    margin-bottom: 1.25rem;

    .how-steps {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .how-step {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      flex: 1;
      min-width: 140px;

      .step-icon {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        flex-shrink: 0;

        &.step-lock { background: #fee2e2; color: #dc2626; }
        &.step-unlock { background: #dcfce7; color: #16a34a; }
        &.step-money { background: #fef3c7; color: #d97706; }
      }

      .step-content {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;

        strong {
          font-size: 0.8rem;
          color: $text-dark;
        }

        span {
          font-size: 0.75rem;
          color: $text-light;
          line-height: 1.3;
        }
      }
    }

    .step-arrow {
      color: rgba($NICOLE-PURPLE, 0.4);
      font-size: 0.75rem;
      padding-top: 0.45rem;
      flex-shrink: 0;
    }
  }

  // Per-person detail in editor rows
  .person-goal-row {
    .person-details {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .person-current-sales {
      font-size: 0.75rem;
      color: $text-light;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;

      i { font-size: 0.65rem; }
    }

    .goal-status-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 100px;

      &.reached {
        background: #dcfce7;
        color: #15803d;
        i { margin-right: 0.2rem; }
      }

      &.pending {
        background: #fff7ed;
        color: #c2410c;
      }
    }

    .person-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }

    .person-goal-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: $text-light;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
  }


  // Footer with total + save
  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1.25rem;
    border-top: 1px solid $border-light;
    flex-wrap: wrap;
    gap: 1rem;

    .goal-total-preview {
      display: flex;
      flex-direction: column;

      .preview-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: $text-light;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .computed-total {
        font-size: 1.75rem;
        font-weight: 800;
        color: $NICOLE-PURPLE;
        line-height: 1.2;
      }
    }

    .btn-save-goals {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      border: none;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.25s ease;
      background: $NICOLE-PURPLE;
      color: white;

      &:hover:not(:disabled) {
        background: $purple-hover;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba($NICOLE-PURPLE, 0.3);
      }

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      &.saved {
        background: #16a34a;
      }

      &.error {
        background: #dc2626;
      }
    }
  }
}

// --- Per-row progress cell ---
.individual-goal {
  font-weight: 600;
  color: $text-light;
  font-size: 0.9rem;
}

.progress-cell {
  min-width: 120px;
}

.mini-progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .mini-progress-bar {
    flex: 1;
    height: 6px;
    background: #f1f5f9;
    border-radius: 4px;
    overflow: hidden;

    .mini-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #a855f7, $NICOLE-PURPLE);
      border-radius: 4px;
      transition: width 0.5s ease;

      &.done {
        background: linear-gradient(90deg, #22c55e, #16a34a);
      }
    }
  }

  .mini-progress-pct {
    font-size: 0.78rem;
    font-weight: 700;
    color: $text-light;
    white-space: nowrap;
  }
}

// ── Store source toggle ───────────────────────────────────
.source-toggle {
  display: flex;
  gap: 0;
  border: 1px solid $border-light;
  border-radius: 8px;
  overflow: hidden;
  height: 42px;

  &--vertical {
    height: auto;
    flex-direction: column;
    border-radius: 8px;

    .source-btn {
      border-radius: 0;
      border-right: none;
      border-bottom: 1px solid $border-light;
      height: 38px;
      &:last-child { border-bottom: none; }
    }
  }
}

.source-btn {
  flex: 1;
  border: none;
  border-right: 1px solid $border-light;
  background: white;
  color: $text-light;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0 0.85rem;
  transition: all 0.15s;
  white-space: nowrap;

  &:last-child { border-right: none; }

  &:hover:not(.active) {
    background: $gray-50;
    color: $text-dark;
  }

  &.active {
    background: $gray-100;
    color: $text-dark;
    font-weight: 700;
  }

  &.nicole.active {
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
  }

  &.sucree.active {
    background: #fffbeb;
    color: #b45309;
  }
}
</style>
