<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import NotificationBell from '@/components/NotificationBell.vue'

const router = useRouter()
const mobileOpen = ref(false)
const userRole = ref<string | null>(null)
const userName = ref('')
const showLogoutConfirm = ref(false)

const requestLogout = () => {
  showLogoutConfirm.value = true
}

const confirmLogout = () => {
  showLogoutConfirm.value = false
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  router.push('/login')
}

onMounted(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (userInfoStr) {
    try {
      const user = JSON.parse(userInfoStr)
      userRole.value = user.role
      userName.value = user.name || user.email?.split('@')[0] || 'Usuario'
    } catch { }
  }
})

const isRetail = computed(() => userRole.value?.toUpperCase() === 'RETAILMANAGER')
const isProduction = computed(() => userRole.value?.toLowerCase() === 'production')
const isSupplyChain = computed(() => userRole.value?.toUpperCase() === 'SUPPLY_CHAIN_MANAGER')
const isSalesManager = computed(() => {
  const role = userRole.value?.toUpperCase()
  return role === 'SALES_MANAGER' || role === 'ADMIN' || role === 'SALES'
})
const isSuperAdmin = computed(() => userRole.value?.toLowerCase() === 'superadmin')
const isSales = computed(() => !isRetail.value && !isProduction.value && !isSupplyChain.value && !isSuperAdmin.value)
// Avisos de ventas (link del cliente, facturas): asesores, jefes de ventas y superadmin.
const showNotifications = computed(() => !!userRole.value && (isSales.value || isSuperAdmin.value))

const closePanel = () => { mobileOpen.value = false }
</script>

<template>
  <!-- Mobile topbar -->
  <header class="mobile-topbar">
    <button class="hamburger-btn" @click="mobileOpen = !mobileOpen" :class="{ open: mobileOpen }">
      <span></span><span></span><span></span>
    </button>
    <router-link to="/" class="brand-link" @click="closePanel">
      <span class="brand-dot"></span>
      Nicole <span class="thin">Pastry Arts</span>
    </router-link>
    <NotificationBell v-if="showNotifications" class="topbar-bell" placement="topbar" />
  </header>

  <!-- Overlay (mobile) -->
  <Transition name="fade-overlay">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="closePanel" />
  </Transition>

  <!-- Logout confirmation -->
  <ConfirmationModal
    :isOpen="showLogoutConfirm"
    title="Cerrar Sesión"
    message="¿Estás seguro que deseas cerrar sesión?"
    confirmText="Cerrar Sesión"
    cancelText="Cancelar"
    :isDangerous="true"
    @close="showLogoutConfirm = false"
    @confirm="confirmLogout"
  />

  <!-- Sidebar panel -->
  <aside class="app-sidebar" :class="{ 'mobile-open': mobileOpen }">
    <!-- Brand -->
    <div class="sidebar-brand">
      <router-link to="/" class="brand-link" @click="closePanel">
        <span class="brand-dot"></span>
        Nicole <span class="thin">Pastry Arts</span>
      </router-link>
      <NotificationBell v-if="showNotifications" class="sidebar-bell" placement="sidebar" />
    </div>

    <!-- Nav links -->
    <nav class="sidebar-nav">

      <!-- Retail -->
      <template v-if="isRetail">
        <router-link to="/pos/shipments" active-class="active" @click="closePanel">
          <i class="fa-solid fa-store"></i> Gestión Sucursal
        </router-link>
      </template>

      <!-- Production -->
      <template v-else-if="isProduction">
        <span class="nav-group-label">Producción</span>
        <router-link to="/production/summary" active-class="active" @click="closePanel">
          <i class="fa-solid fa-chart-pie"></i> Resumen
        </router-link>
        <router-link to="/production/orders" active-class="active" @click="closePanel">
          <i class="fa-solid fa-list-check"></i> Órdenes
        </router-link>
      </template>

      <!-- Supply Chain -->
      <template v-else-if="isSupplyChain">
        <span class="nav-group-label">Supply Chain</span>
        <router-link to="/supply-chain/summary" active-class="active" @click="closePanel">
          <i class="fa-solid fa-chart-bar"></i> Inventario
        </router-link>
        <router-link to="/supply-chain/orders" active-class="active" @click="closePanel">
          <i class="fa-solid fa-cart-shopping"></i> Compras
        </router-link>
        <router-link to="/supply-chain/providers" active-class="active" @click="closePanel">
          <i class="fa-solid fa-truck"></i> Proveedores
        </router-link>
        <router-link to="/supply-chain/materials" active-class="active" @click="closePanel">
          <i class="fa-solid fa-box-open"></i> Materia Prima
        </router-link>
        <router-link to="/supply-chain/categories" active-class="active" @click="closePanel">
          <i class="fa-solid fa-tags"></i> Categorías
        </router-link>
        <router-link to="/supply-chain/warehouse" active-class="active" @click="closePanel">
          <i class="fa-solid fa-warehouse"></i> Bodega
        </router-link>
        <router-link to="/supply-chain/invoices" active-class="active" @click="closePanel">
          <i class="fa-solid fa-file-invoice-dollar"></i> Facturas
        </router-link>
        <span class="nav-group-label">Configuración</span>
        <router-link to="/supply-chain/points" active-class="active" @click="closePanel">
          <i class="fa-solid fa-location-dot"></i> Puntos de Entrega
        </router-link>
      </template>

      <!-- Super Admin / Gerencia -->
      <template v-else-if="isSuperAdmin">
        <span class="nav-group-label">Gerencia</span>
        <router-link to="/admin/dashboard" active-class="active" @click="closePanel">
          <i class="fa-solid fa-gauge-high"></i> Panel de Control
        </router-link>
        <router-link to="/reports/sales-by-responsible" active-class="active" @click="closePanel">
          <i class="fa-solid fa-chart-line"></i> Ventas &amp; Comisiones
        </router-link>
        <router-link to="/reports/delivery" active-class="active" @click="closePanel">
          <i class="fa-solid fa-motorcycle"></i> Transporte
        </router-link>
        <span class="nav-group-label">Administración</span>
        <router-link to="/admin/users" active-class="active" @click="closePanel">
          <i class="fa-solid fa-users"></i> Gestión de Equipo
        </router-link>
        <router-link to="/settings/branches" active-class="active" @click="closePanel">
          <i class="fa-solid fa-store"></i> Puntos de Venta
        </router-link>
      </template>

      <!-- Sales / Default -->
      <template v-else>
        <span class="nav-group-label">Pedidos</span>
        <router-link to="/orders" active-class="active" @click="closePanel">
          <i class="fa-solid fa-basket-shopping"></i> Lista de Pedidos
        </router-link>
        <router-link to="/orders/link/new" active-class="active" class="nav-primary" @click="closePanel">
          <i class="fa-solid fa-link"></i> Venta con link
        </router-link>
        <router-link to="/orders/new" exact-active-class="active" @click="closePanel">
          <i class="fa-solid fa-plus"></i> Pedido manual
        </router-link>

        <span class="nav-group-label">Reportes</span>
        <router-link to="/reports/sales-by-responsible" active-class="active" @click="closePanel">
          <i class="fa-solid fa-chart-line"></i> Ventas &amp; Comisiones
        </router-link>
        <router-link to="/reports/delivery" active-class="active" @click="closePanel">
          <i class="fa-solid fa-motorcycle"></i> Transporte
        </router-link>

        <template v-if="isSalesManager">
          <span class="nav-group-label">Administración</span>
          <router-link to="/admin/users" active-class="active" @click="closePanel">
            <i class="fa-solid fa-users"></i> Gestión de Equipo
          </router-link>
          <router-link to="/settings/branches" active-class="active" @click="closePanel">
            <i class="fa-solid fa-store"></i> Puntos de Venta
          </router-link>
        </template>
      </template>

    </nav>

    <!-- User footer -->
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">{{ userName.charAt(0).toUpperCase() }}</div>
        <span class="user-name">{{ userName }}</span>
      </div>
      <button class="btn-logout" @click="requestLogout" title="Cerrar Sesión">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
      </button>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
// ─── Mobile topbar (hidden on desktop) ───────────────────────────────────────
.mobile-topbar {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 52px;
  background: white;
  border-bottom: 1px solid $border-light;
  z-index: 500;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;

  .brand-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.05rem;
    font-weight: 800;
    color: #1e293b;
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .brand-dot {
    width: 9px;
    height: 9px;
    background: $NICOLE-PURPLE;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .thin {
    font-weight: 300;
    color: #64748b;
  }
}

.hamburger-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  background: #f8fafc;
  border: 1px solid $border-light;
  border-radius: 8px;
  cursor: pointer;
  padding: 7px;
  flex-shrink: 0;

  span {
    display: block;
    height: 2px;
    background: #475569;
    border-radius: 2px;
    transition: all 0.25s;
    transform-origin: center;
  }

  &.open {
    span:nth-child(1) {
      transform: translateY(7px) rotate(45deg);
    }

    span:nth-child(2) {
      opacity: 0;
    }

    span:nth-child(3) {
      transform: translateY(-7px) rotate(-45deg);
    }
  }
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  z-index: 499;
}

// ─── Sidebar panel ───────────────────────────────────────────────────────────
.app-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 220px;
  height: 100vh;
  background: white;
  border-right: 1px solid $border-light;
  display: flex;
  flex-direction: column;
  z-index: 501;
  flex-shrink: 0;
}

.sidebar-brand {
  padding: 1.2rem 1.1rem 1rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;

  .brand-link {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 800;
    color: #1e293b;
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .brand-dot {
    width: 9px;
    height: 9px;
    background: $NICOLE-PURPLE;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .thin {
    font-weight: 300;
    color: #64748b;
  }
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.7rem;
    border-radius: 8px;
    text-decoration: none;
    color: #475569;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;

    i {
      width: 15px;
      text-align: center;
      font-size: 0.82rem;
      color: #94a3b8;
      flex-shrink: 0;
      transition: color 0.15s;
    }

    &:hover {
      background: #f8fafc;
      color: #1e293b;

      i {
        color: #64748b;
      }
    }

    &.active {
      background: rgba($NICOLE-PURPLE, 0.09);
      color: $NICOLE-PURPLE;
      font-weight: 700;

      i {
        color: $NICOLE-PURPLE;
      }
    }
  }
}

.sidebar-nav a.nav-primary {
  background: $NICOLE-PURPLE;
  color: white;
  font-weight: 700;
  margin: 0.15rem 0 0.25rem;

  i {
    color: white;
  }

  &:hover,
  &.active {
    background: darken($NICOLE-PURPLE, 6%);
    color: white;

    i {
      color: white;
    }
  }
}

.topbar-bell {
  margin-left: auto;
}

.nav-group-label {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #94a3b8;
  padding: 0.6rem 0.7rem 0.2rem;
  display: block;

  &:first-child {
    padding-top: 0;
  }
}

.sidebar-footer {
  padding: 0.85rem 0.9rem;
  border-top: 1px solid $border-light;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 1;
  min-width: 0;
}

.user-avatar {
  width: 30px;
  height: 30px;
  background: $NICOLE-PURPLE;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  flex-shrink: 0;
}

.user-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-logout {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  font-size: 1rem;
  padding: 0.4rem;
  border-radius: 7px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;

  &:hover {
    color: $error;
    background: rgba($error, 0.06);
  }
}

// ─── Transitions ─────────────────────────────────────────────────────────────
.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: opacity 0.25s;
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
}

// ─── Mobile ──────────────────────────────────────────────────────────────────
@media (max-width: 1023px) {
  .mobile-topbar {
    display: flex;
  }

  .sidebar-overlay {
    display: block;
  }

  .app-sidebar {
    top: 0;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.1);

    &.mobile-open {
      transform: translateX(0);
    }

    .sidebar-brand {
      display: none;
    }
  }
}

// ─── Desktop ─────────────────────────────────────────────────────────────────
@media (min-width: 1024px) {
  .mobile-topbar {
    display: none;
  }

  .sidebar-overlay {
    display: none !important;
  }

  .app-sidebar {
    position: sticky;
    top: 0;
    transform: none !important;
    box-shadow: none;
  }
}
</style>
