import { ref, computed } from 'vue'
import BranchService, { type Branch, type BranchCompany } from '@/services/branch.service'

export const isCdpBranchName = (name: string) => /centro|producc/i.test(name || '')

// Module-level singleton — shared across all components
const _branches = ref<Branch[]>([])
const _loaded = ref(false)
const _loading = ref(false)

export function useBranches() {
  const load = async (force = false) => {
    if (_loaded.value && !force) return
    _loading.value = true
    try {
      _branches.value = await BranchService.getBranches()
      _loaded.value = true
    } catch (e) {
      console.error('Error loading branches:', e)
    } finally {
      _loading.value = false
    }
  }

  const activeBranches = computed(() =>
    _branches.value.filter(b => b.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const branchNames = computed(() =>
    activeBranches.value.map(b => b.name)
  )

  /**
   * Puntos de venta activos (sin el Centro de Producción), de cualquier empresa.
   * Es la lista de Gestión de Sucursal y de los locales a los que el CDP despacha reposición:
   * un local nuevo creado en Puntos de Venta (p. ej. Entre Ríos de Sucrée) aparece solo.
   */
  const posBranches = computed(() => activeBranches.value.filter(b => !isCdpBranchName(b.name)))
  const posBranchNames = computed(() => posBranches.value.map(b => b.name))

  /** Empresa de una sucursal por nombre (sin distinguir mayúsculas). Sin dato: 'nicole'. */
  const companyOf = (name: string): BranchCompany => {
    const key = (name || '').trim().toLowerCase()
    return _branches.value.find(b => b.name.trim().toLowerCase() === key)?.company || 'nicole'
  }

  return {
    branches: _branches,
    activeBranches,
    branchNames,
    posBranches,
    posBranchNames,
    companyOf,
    isLoading: _loading,
    load,
  }
}
