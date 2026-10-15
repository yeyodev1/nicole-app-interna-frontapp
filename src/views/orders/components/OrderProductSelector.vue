<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
}>()

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

const fetchProducts = async (isNewSearch = true) => {
  if (isNewSearch) {
    currentPage.value = 1
    products.value = []
    hasMore.value = true
    contificoDown.value = false
  }

  if (!hasMore.value || isLoading.value) return

  isLoading.value = true
  try {
    // Apply mapping to search term (e.g. "Tarta Vasca" -> "Tarta de Queso")
    const query = getOfficialName(searchTerm.value)

    const data = await ProductService.getProducts({
      filtro: query,
      page: currentPage.value,
      limit: pageSize
    })

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
    console.error(e)
    // httpBase transforma el error a { status, message, data } — NO usa e.response
    const status: number = e?.status ?? e?.response?.status
    const msg: string = e?.data?.error || e?.data?.message || e?.response?.data?.error || e?.response?.data?.message || ''
    if (status === 503 || msg.toLowerCase().includes('contifico') || msg === 'contifico_unavailable') {
      contificoDown.value = true
    }
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  fetchProducts(true)
}

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
    <div class="search-bar">
      <input
        v-model="searchTerm"
        @keyup.enter="handleSearch"
        placeholder="Buscar productos..."
        type="text"
      />
      <button @click="handleSearch" class="btn-search">Buscar</button>
    </div>

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
      <div v-if="isLoading && products.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando productos...</p>
      </div>

      <div v-else-if="products.length > 0 && compact" class="products-list">
        <OrderProductRow
          v-for="product in products"
          :key="`${product.source}-${product.id}`"
          :product="product"
          :is-blocked="isProductBlocked(product)"
          @add="handleAddAttempt"
        />
      </div>

      <div v-else-if="products.length > 0" class="products-grid">
        <OrderProductCard
          v-for="product in products"
          :key="`${product.source}-${product.id}`"
          :product="product"
          :is-blocked="isProductBlocked(product)"
          @add="handleAddAttempt"
        />
      </div>

      <div v-if="isLoading && products.length > 0" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando más...</span>
      </div>

      <div v-if="hasMore && products.length > 0 && !isLoading" class="load-more-container">
        <button @click="loadMore" class="btn-secondary">Cargar más productos</button>
      </div>

      <div v-if="!isLoading && products.length === 0 && !contificoDown" class="empty-state">
        No se encontraron productos.
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
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: $font-secondary;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }

  .btn-search {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    padding: 0 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;

    &:hover {
      background: $purple-hover;
    }
  }
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
