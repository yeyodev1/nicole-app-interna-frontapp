export interface User {
  _id: string
  name: string
  email: string
  role: 'admin' | 'sales' | 'production' | 'SALES_REP' | 'SALES_MANAGER' | 'RetailManager' | 'SUPPLY_CHAIN_MANAGER' | 'superadmin' | 'KITCHEN_DISPLAY' | 'WAREHOUSE_RECEIVER' | 'OPERATIONS_MANAGER'
  password?: string
  // Fuente de Contífico asignada. Define qué catálogo de productos puede ver/operar el usuario.
  // 'nicole' = solo Nicole (default), 'sucree' = solo Sucree, 'both' = ambas marcas
  contificoSource?: 'nicole' | 'sucree' | 'both'
  createdAt?: string
  updatedAt?: string
}

export interface LoginResponse {
  token: string
  user: User
}
