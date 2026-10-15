<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import ProductService from '@/services/product.service'
import OrderProductCard from './OrderProductCard.vue'
import OrderProductRow from './OrderProductRow.vue'
import type { Product } from '@/types/order'
import { getOfficialName } from '@/services/productMapping.service'

const props = defineProps<{
  // Fuente activa del carrito (null = carrito vacío, sin restricción)
  activeCartSource?: 'nicole' | 'sucree' | null
  /** Lista compacta (sin fotos), para la venta con link. */
  compact?: boolean
  /** Oculta el producto "Delivery": en la venta con link el envío va en su propio paso. */
  hideDelivery?: boolean
}>()

/** Sin tildes ni mayúsculas, para comparar "cafe" con "Café". */
const normalize = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const visibleProducts = computed(() => {
  let list = props.hideDelivery
    ? products.value.filter(p => !/delivery|env[ií]o/i.test(p.nombre || ''))
    : products.value
  // Mientras llega la respuesta de Contífico, se filtra al instante lo que ya está cargado.
  const words = normalize(searchTerm.value).split(/\s+/).filter(Boolean)
  if (words.length && pendingSearch.value) {
    list = list.filter(p => {
      const name = normalize(p.nombre || '')
      return words.every(w => name.includes(w))
    })
  }
  return list
})

const emit = defineEmits<{
  (e: 'add-to-cart', product: Product): void
}>()

// Estado
const isLoading = ref(false)
const searchTerm = ref('')
const products = ref<Product[]>([])
const currentPage = ref(1)
const hasMore = ref(true)
const pageSize = 20
const contificoDown = ref(false)
// Mensaje de intento de mezcla de marcas
const mixAttemptSource = ref<'nicole' | 'sucree' | null>(null)
// Búsqueda en vivo: hay texto nuevo que todavía no respondió Contífico.
const pendingSearch = ref(false)
// Solo cuenta la última búsqueda: una respuesta vieja que llega tarde se descarta.
let requestId = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const SEARCH_DEBOUNCE_MS = 250

const fetchProducts = async (isNewSearch = true) => {
  if (isNewSearch) {
    currentPage.value = 1
    // La lista anterior se queda (filtrada al instante) hasta que llegue la nueva.
    hasMore.value = true
    contificoDown.value = false
  }

  // Una búsqueda nueva siempre sale; "cargar más" espera a que termine la anterior.
  if (!hasMore.value || (!isNewSearch && isLoading.value)) return

  const myRequest = ++requestId
  isLoading.value = true
  try {
    // Apply mapping to search term (e.g. "Tarta Vasca" -> "Tarta de Queso")
    const query = getOfficialName(searchTerm.value)

    const data = await ProductService.getProducts({
      filtro: query,
      page: currentPage.value,
      limit: pageSize
    })

    if (myRequest !== requestId) return

    if (data.length < pageSize) {
      hasMore.value = false
    }

    if (isNewSearch) {
      products.value = data as Product[]
    } else {
      products.value = [...products.value, ...data as Product[]]
    }

    currentPage.value++
  } catch (e: any) {
    if (myRequest !== requestId) return
    console.error(e)
    // httpBase transforma el error a { status, message, data } — NO usa e.response
    const status: number = e?.status ?? e?.response?.status
    const msg: string = e?.data?.error || e?.data?.message || e?.response?.data?.error || e?.response?.data?.message || ''
    if (status === 503 || msg.toLowerCase().includes('contifico') || msg === 'contifico_unavailable') {
      contificoDown.value = true
    }
  } finally {
    if (myRequest === requestId) {
      isLoading.value = false
      pendingSearch.value = false
    }
  }
}

const handleSearch = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  fetchProducts(true)
}

// Busca mientras escribes: filtra al instante y consulta Contífico al dejar de teclear.
watch(searchTerm, () => {
  pendingSearch.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchProducts(true), SEARCH_DEBOUNCE_MS)
})

const clearSearch = () => {
  searchTerm.value = ''
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const loadMore = () => {
  fetchProducts(false)
}

// Determina si un producto está bloqueado porque su marca no coincide con el carrito activo
const isProductBlocked = (product: Product): boolean => {
  if (!props.activeCartSource) return false // Carrito vacío = sin restricción
  const productSource = product.source || 'nicole'
  return productSource !== props.activeCartSource
}

// Intento de añadir producto bloqueado: mostrar aviso en lugar de emitir
const handleAddAttempt = (product: Product) => {
  if (isProductBlocked(product)) {
    // Registrar qué fuente intentaron mezclar para el mensaje
    mixAttemptSource.value = product.source || 'nicole'
    // Limpiar el aviso después de 4s
    setTimeout(() => { mixAttemptSource.value = null }, 4000)
    return
  }
  emit('add-to-cart', product)
}

// Nombre de marca legible
const getBrandName = (source: 'nicole' | 'sucree' | undefined) =>
  source === 'sucree' ? 'Sucree' : 'Nicole Pastry Arts'

onMounted(() => {
  fetchProducts(true)
})
</script>

<template>
  <section class="products-section" :class="{ compact }">
    <div class="search-bar" role="search">
      <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
      <input
        v-model="searchTerm"
        type="search"
        placeholder="Escribe para buscar: torta, café, combo…"
        aria-label="Buscar productos"
        autocomplete="off"
        @keyup.enter="handleSearch"
        @keydown.esc="clearSearch"
      />
      <span v-if="isLoading" class="search-spinner" aria-hidden="true"></span>
      <button v-else-if="searchTerm" type="button" class="search-clear" aria-label="Borrar búsqueda" @click="clearSearch">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <p class="search-status" aria-live="polite">
      <template v-if="searchTerm && !isLoading && !pendingSearch">
        {{ visibleProducts.length }}{{ hasMore ? '+' : '' }} resultado{{ visibleProducts.length === 1 ? '' : 's' }} para «{{ searchTerm.trim() }}»
      </template>
    </p>

    <!-- Banner: Contífico caído -->
    <div v-if="contificoDown" class="contifico-error-banner">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div class="contifico-error-content">
        <strong>Contífico no está disponible</strong>
        <p>No se pueden cargar los productos. El servicio externo no responde. Intenta de nuevo en unos minutos.</p>
      </div>
      <button @click="fetchProducts(true)" class="btn-retry">
        <i class="fa-solid fa-rotate-right"></i>
        Reintentar
      </button>
    </div>

    <!-- Banner: Intento de mezclar marcas -->
    <Transition name="slide-down">
      <div v-if="mixAttemptSource" class="mix-warning-banner">
        <i class="fa-solid fa-ban"></i>
        <div class="mix-warning-content">
          <strong>No se puede mezclar productos de dos empresas</strong>
          <p>
            Tu carrito ya tiene productos de <strong>{{ getBrandName(activeCartSource!) }}</strong>.
            Para agregar productos de <strong>{{ getBrandName(mixAttemptSource) }}</strong>,
            debes crear un pedido separado — cada empresa genera su propia factura.
          </p>
        </div>
      </div>
    </Transition>

    <!-- Indicador de marca activa en el carrito -->
    <div v-if="activeCartSource" class="active-source-indicator">
      <span class="source-dot" :class="activeCartSource"></span>
      Carrito activo: <strong>{{ getBrandName(activeCartSource) }}</strong>
      <span class="muted">— Productos de la otra marca están deshabilitados</span>
    </div>

    <div v-if="!contificoDown" class="products-container">
      <div v-if="isLoading && visibleProducts.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando productos...</p>
      </div>

      <div v-else-if="visibleProducts.length > 0 && compact" class="products-list">
        <OrderProductRow
          v-for="product in visibleProducts"
          :key="`${product.source}-${product.id}`"
          :product="product"
          :highlight="searchTerm"
          :is-blocked="isProductBlocked(product)"
          @add="handleAddAttempt"
        />
      </div>

      <div v-else-if="visibleProducts.length > 0" class="products-grid">
        <OrderProductCard
          v-for="product in visibleProducts"
          :key="`${product.source}-${product.id}`"
          :product="product"
          :is-blocked="isProductBlocked(product)"
          @add="handleAddAttempt"
        />
      </div>

      <div v-if="isLoading && !pendingSearch && visibleProducts.length > 0" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando más...</span>
      </div>

      <div v-if="hasMore && visibleProducts.length > 0 && !isLoading && !pendingSearch" class="load-more-container">
        <button @click="loadMore" class="btn-secondary">Cargar más productos</button>
      </div>

      <div v-if="!isLoading && !pendingSearch && visibleProducts.length === 0 && !contificoDown" class="empty-state">
        {{ searchTerm.trim() ? `No encontramos «${searchTerm.trim()}». Prueba con otra palabra.` : 'No se encontraron productos.' }}
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.products-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.compact {
  padding: 0;

  .search-bar {
    margin-bottom: 0.75rem;
  }
}

.products-section {
  padding: 1.5rem;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 0.35rem;

  .search-icon {
    position: absolute;
    left: 1rem;
    color: #94a3b8;
    pointer-events: none;
  }

  input {
    flex: 1;
    width: 100%;
    padding: 0.85rem 2.75rem 0.85rem 2.6rem;
    border: 1.5px solid $border-light;
    border-radius: 12px;
    font-size: 1rem;
    font-family: $font-secondary;
    background: white;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::-webkit-search-cancel-button {
      display: none;
    }

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.15);
    }
  }

  &:focus-within .search-icon {
    color: $NICOLE-PURPLE;
  }
}

.search-clear {
  position: absolute;
  right: 0.6rem;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    background: #e2e8f0;
  }
}

.search-spinner {
  position: absolute;
  right: 0.9rem;
  width: 18px;
  height: 18px;
  border: 2px solid rgba($NICOLE-PURPLE, 0.2);
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: search-spin 0.7s linear infinite;
}

@keyframes search-spin {
  to {
    transform: rotate(360deg);
  }
}

.search-status {
  min-height: 1.1rem;
  margin: 0 0 0.6rem 0.25rem;
  font-size: 0.8rem;
  color: #64748b;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: $text-light;
  gap: 1rem;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;

  button {
    background: $gray-100;
    border: 1px solid $border-light;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    color: $NICOLE-PURPLE;
    transition: all 0.2s;

    &:hover {
      background: $NICOLE-PURPLE;
      color: white;
    }
  }
}

// --- Banners ---

.contifico-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background-color: #fff7ed;
  border: 1px solid #fed7aa;
  border-left: 4px solid #f97316;
  color: #c2410c;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;

  i.fa-triangle-exclamation {
    font-size: 1.25rem;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .contifico-error-content {
    flex: 1;

    strong {
      display: block;
      font-size: 0.95rem;
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      font-size: 0.85rem;
      opacity: 0.9;
    }
  }

  .btn-retry {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #f97316;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: #ea6c0a;
    }
  }
}

// Banner de intento de mezcla de marcas
.mix-warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 4px solid #ef4444;
  color: #991b1b;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;

  i.fa-ban {
    font-size: 1.25rem;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .mix-warning-content {
    flex: 1;

    strong {
      display: block;
      font-size: 0.95rem;
      margin-bottom: 0.35rem;
    }

    p {
      margin: 0;
      font-size: 0.85rem;
      line-height: 1.5;
    }
  }
}

// Indicador de fuente activa en el carrito
.active-source-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  margin-bottom: 1rem;

  strong {
    color: #1e293b;
  }

  .muted {
    color: #94a3b8;
    font-size: 0.8rem;
  }

  .source-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;

    &.nicole { background: $NICOLE-PURPLE; }
    &.sucree { background: #f59e0b; }
  }
}

// Transición del banner de mezcla
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
