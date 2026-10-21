import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import OrderCreateView from '../views/orders/OrderCreateView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: (to) => {
        // Redirect based on stored role or default to login
        const userInfoStr = localStorage.getItem('user_info')
        if (userInfoStr) {
          try {
            const user = JSON.parse(userInfoStr)
            if (user?.role === 'production') return { name: 'production-summary' }
            if (user?.role === 'KITCHEN_DISPLAY') return { name: 'kitchen-display' }
            if (user?.role === 'RetailManager') return { name: 'pos-shipments' }
            if (user?.role === 'OPERATIONS_MANAGER') return { name: 'operations-report' }
            if (user?.role === 'SUPPLY_CHAIN_MANAGER') return { name: 'providers-list' }
            if (user?.role === 'WAREHOUSE_RECEIVER') return { name: 'supply-receptions' }
            if (user?.role === 'superadmin') return { name: 'superadmin-dashboard' }
            return { name: 'create-order' }
          } catch (e) {
            return { name: 'login' }
          }
        }
        return { name: 'login' }
      }
    },
    {
      path: '/orders',
      name: 'list-orders',
      component: () => import('../views/orders/OrderListView.vue'), // Lazy load
      meta: { requiresAuth: true, title: 'Lista de Pedidos' }
    },
    {
      path: '/orders/create',
      redirect: to => ({ name: 'create-order', query: to.query })
    },
    {
      path: '/orders/new',
      name: 'create-order',
      component: OrderCreateView,
      meta: { requiresAuth: true, title: 'Nuevo Pedido' }
    },
    {
      path: '/orders/link/new',
      name: 'create-link-order',
      component: () => import('../views/orders/OrderLinkCreateView.vue'),
      meta: { requiresAuth: true, title: 'Venta con link' }
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../views/orders/OrderDetailView.vue'),
      meta: { requiresAuth: true, title: 'Detalle de Pedido' },
      beforeEnter: (to, from, next) => {
        if (to.params.id === 'create' || to.params.id === 'new') {
          next({ name: 'create-order', query: to.query });
        } else {
          next();
        }
      }
    },
    {
      path: '/reports/sales-by-responsible',
      name: 'sales-by-responsible',
      component: () => import('../views/reports/SalesByResponsibleView.vue'),
      meta: { requiresAuth: true, title: 'Reporte de Ventas' }
    },
    {
      path: '/reports/delivery',
      name: 'delivery-report',
      component: () => import('../views/reports/DeliveryReportView.vue'),
      meta: { requiresAuth: true, title: 'Reporte de Transporte' }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: 'Iniciar Sesión' }
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
      meta: { title: 'Restablecer Contraseña' }
    },
    {
      path: '/production',
      redirect: '/production/summary'
    },
    {
      path: '/production/summary',
      name: 'production-summary',
      component: () => import('../views/production/ProductionItemsSummaryView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Resumen de Producción' }
    },
    {
      path: '/production/orders',
      name: 'production-orders',
      component: () => import('../views/production/ProductionOrdersView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Órdenes de Producción' }
    },
    {
      path: '/production/reports',
      name: 'production-reports',
      component: () => import('../views/production/ProductionReportsView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Reportes de Producción' }
    },
    {
      path: '/production/kitchen',
      name: 'kitchen-display',
      component: () => import('../views/production/KitchenDisplayView.vue'),
      meta: { requiresAuth: true, role: 'KITCHEN_DISPLAY', title: 'Pantalla Cocina' }
    },
    // Supply Chain Routes
    {
      path: '/supply-chain',
      redirect: '/supply-chain/summary',
    },
    {
      path: '/supply-chain/summary',
      name: 'inventory-summary',
      component: () => import('../views/SupplyChain/InventorySummaryView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Resumen de Inventario' }
    },
    {
      path: '/supply-chain/providers',
      name: 'providers-list',
      component: () => import('../views/SupplyChain/ProvidersView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Proveedores' }
    },
    {
      path: '/supply-chain/providers/:id',
      name: 'provider-detail',
      component: () => import('../views/SupplyChain/ProviderDetailView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Detalle de Proveedor' }
    },
    {
      path: '/supply-chain/materials',
      name: 'materials-list',
      component: () => import('../views/SupplyChain/RawMaterialsView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Materia Prima' }
    },
    {
      path: '/supply-chain/categories',
      name: 'supply-categories',
      component: () => import('../views/SupplyChain/CategoriesView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Categorías' }
    },
    {
      path: '/supply-chain/warehouse',
      name: 'warehouse',
      component: () => import('../views/SupplyChain/WarehouseView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Bodega' }
    },
    {
      path: '/supply-chain/points',
      name: 'warehouse-points',
      component: () => import('../views/SupplyChain/LocationPointsView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Puntos de Entrega' }
    },
    {
      path: '/supply-chain/orders',
      name: 'supplier-orders-history',
      component: () => import('../views/SupplyChain/SupplierOrderHistoryView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Historial de Pedidos' }
    },
    {
      path: '/supply-chain/invoices',
      name: 'supply-chain-invoices',
      component: () => import('../views/SupplyChain/InvoicesView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Facturas de Compra' }
    },
    {
      path: '/supply-chain/payables',
      name: 'supply-payables',
      component: () => import('../views/SupplyChain/PayablesView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Cuentas por Pagar' }
    },
    {
      path: '/supply-chain/receptions',
      name: 'supply-receptions',
      component: () => import('../views/SupplyChain/ReceptionsView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Recepción de Mercadería' }
    },
    {
      path: '/supply-chain/requisitions',
      name: 'supply-requisitions',
      component: () => import('../views/SupplyChain/RequisitionsView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Requerimientos Internos' }
    },
    {
      path: '/supply-chain/loans',
      name: 'supply-loans',
      component: () => import('../views/SupplyChain/LoansView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Préstamos entre Bodegas' }
    },
    {
      path: '/supply-chain/reports',
      name: 'supply-reports',
      component: () => import('../views/SupplyChain/WarehouseReportsView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Reportes de Bodega' }
    },
    {
      path: '/supply-chain/team',
      name: 'supply-team',
      component: () => import('../views/admin/ManagementUsersView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Equipo de Bodega' }
    },
    {
      path: '/production/requisitions',
      name: 'production-requisitions',
      component: () => import('../views/production/RequisitionCreateView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Pedir a Bodega' }
    },
    // Operations Manager Routes
    {
      path: '/operations/report',
      name: 'operations-report',
      component: () => import('../views/operations/OperationsReportView.vue'),
      meta: { requiresAuth: true, role: 'OPERATIONS_MANAGER', title: 'Resumen del Día' }
    },
    {
      path: '/operations/sales',
      name: 'operations-sales',
      component: () => import('../views/operations/OperationsSalesView.vue'),
      meta: { requiresAuth: true, role: 'OPERATIONS_MANAGER', title: 'Ventas del Día' }
    },
    {
      path: '/operations/losses',
      name: 'operations-losses',
      component: () => import('../views/operations/OperationsLossesView.vue'),
      meta: { requiresAuth: true, role: 'OPERATIONS_MANAGER', title: 'Bajas del Día' }
    },
    {
      path: '/operations/discrepancies',
      name: 'operations-discrepancies',
      component: () => import('../views/operations/OperationsDiscrepanciesView.vue'),
      meta: { requiresAuth: true, role: 'OPERATIONS_MANAGER', title: 'Descuadres' }
    },
    // POS / RetailManager Routes
    {
      path: '/pos/shipments',
      name: 'pos-shipments',
      component: () => import('../views/pos/IncomingShipmentsView.vue'),
      meta: { requiresAuth: true, role: 'RetailManager', title: 'Recepción de Pedidos' }
    },
    {
      path: '/pos/restock-form',
      name: 'pos-restock-form',
      component: () => import('../views/pos/RestockDailyForm.vue'),
      meta: { requiresAuth: true, role: 'RetailManager', title: 'Cierre de Producción' }
    },
    {
      path: '/pos/restock-management',
      name: 'pos-restock-management',
      component: () => import('../views/pos/RestockManagementView.vue'),
      meta: { requiresAuth: true, role: 'RetailManager', title: 'Configuración Stock' }
    },
    {
      path: '/admin/users',
      name: 'manage-users',
      component: () => import('../views/admin/ManagementUsersView.vue'),
      meta: { requiresAuth: true, role: 'SALES_MANAGER', title: 'Gestión de Equipo' }
    },
    {
      path: '/settings/branches',
      name: 'settings-branches',
      component: () => import('../views/settings/BranchManagementView.vue'),
      meta: { requiresAuth: true, role: 'SALES_MANAGER', title: 'Puntos de Venta' }
    },
    {
      path: '/admin/dashboard',
      name: 'superadmin-dashboard',
      component: () => import('../views/admin/SuperAdminDashboard.vue'),
      meta: { requiresAuth: true, role: 'superadmin', title: 'Panel de Gerencia' }
    }
  ],
})

router.beforeEach((to, from, next) => {
  // Update Document Title
  const appTitle = 'Nicole Pastry Arts'
  document.title = to.meta.title ? `${to.meta.title} | ${appTitle}` : appTitle

  const isAuthenticated = localStorage.getItem('access_token')
  const userInfoStr = localStorage.getItem('user_info')
  let user: any = null

  if (userInfoStr) {
    try {
      user = JSON.parse(userInfoStr)
    } catch (e) {
      console.error('Error parsing user info', e)
    }
  }

  const role = user?.role

  // 1. Check Authentication for protected routes
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
    return
  }

  // 2. Redirect authenticated users away from login page
  if (to.name === 'login' && isAuthenticated) {
    if (role === 'production') next({ name: 'production-summary' })
    else if (role === 'KITCHEN_DISPLAY') next({ name: 'kitchen-display' })
    else if (role === 'RetailManager') next({ name: 'pos-shipments' })
    else if (role === 'OPERATIONS_MANAGER') next({ name: 'operations-report' })
    else if (role === 'SUPPLY_CHAIN_MANAGER') next({ name: 'providers-list' })
    else if (role === 'WAREHOUSE_RECEIVER') next({ name: 'supply-receptions' })
    else if (role === 'superadmin') next({ name: 'superadmin-dashboard' })
    else next({ name: 'create-order' })
    return
  }

  // 3. Role-Based Access Control logic
  if (isAuthenticated) {
    // Superadmin guard - Priority
    if (role === 'superadmin') {
      if (!to.path.startsWith('/admin') && !to.path.startsWith('/reports') && !to.path.startsWith('/settings')) {
        next({ name: 'superadmin-dashboard' })
        return
      }
      next()
      return
    }

    // Sales Manager user
    if (role === 'SALES_MANAGER' && (!to.path.startsWith('/orders') && !to.path.startsWith('/admin') && !to.path.startsWith('/reports') && !to.path.startsWith('/settings'))) {
      next({ name: 'create-order' })
      return
    }

    // Sales Rep user
    if (role === 'SALES_REP' && (!to.path.startsWith('/orders') && !to.path.startsWith('/reports'))) {
      next({ name: 'create-order' })
      return
    }

    // legacy sales role
    if (role === 'sales' && (to.path.startsWith('/production') || to.path.startsWith('/pos') || to.path.startsWith('/supply-chain'))) {
      next({ name: 'create-order' })
      return
    }

    // Production guard
    if (role === 'production' && !to.path.startsWith('/production')) {
      next({ name: 'production-summary' })
      return
    }

    // Kitchen Display guard — only /production/kitchen
    if (role === 'KITCHEN_DISPLAY' && to.name !== 'kitchen-display') {
      next({ name: 'kitchen-display' })
      return
    }

    // Retail Manager guard
    if (role === 'RetailManager' && !to.path.startsWith('/pos')) {
      next({ name: 'pos-shipments' })
      return
    }

    // Operations Manager guard — solo reportería
    if (role === 'OPERATIONS_MANAGER' && !to.path.startsWith('/operations')) {
      next({ name: 'operations-report' })
      return
    }

    // Supply Chain Manager guard
    if (role === 'SUPPLY_CHAIN_MANAGER' && !to.path.startsWith('/supply-chain')) {
      next({ name: 'inventory-summary' })
      return
    }

    // Warehouse Receiver guard — solo recepciones y requerimientos
    if (role === 'WAREHOUSE_RECEIVER' && !['/supply-chain/receptions', '/supply-chain/requisitions'].includes(to.path)) {
      next({ name: 'supply-receptions' })
      return
    }
  }

  next()
})

export default router
