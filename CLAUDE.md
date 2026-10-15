# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `pnpm dev`
- **Build:** `pnpm build` (runs type-check + vite build in parallel)
- **Type-check only:** `pnpm run type-check` (uses `vue-tsc --build`)
- **Format:** `pnpm format` (Prettier on `src/`)
- **No test runner is configured.**

## Tech Stack

- Vue 3 (Composition API with `<script setup>`) + TypeScript + Vite 7
- Pinia for state management
- Vue Router with role-based access control
- Axios via a shared `APIBase` class (`src/services/httpBase.ts`)
- SCSS with global variables/mixins auto-injected via `@/styles/index.scss`
- `xlsx-js-style` for Excel export, `vuedraggable` for drag-and-drop
- pnpm as package manager (Node >=20.19.0 or >=22.12.0)

## Architecture

### Routing & Roles

The router (`src/router/index.ts`) enforces role-based access. Four roles exist:
- **sales** (default) — `/orders/*`, `/reports/*`
- **production** — `/production/*`
- **RetailManager** — `/pos/*`
- **SUPPLY_CHAIN_MANAGER** — `/supply-chain/*`

Auth tokens and user info are stored in `localStorage` (`access_token`, `user_info`). The `App.vue` listens for a custom `auth:token-expired` event to handle forced logout.

### Services Layer

All API services extend `APIBase` (`src/services/httpBase.ts`), which:
- Builds URLs from `VITE_NICOLE_API` env var (defaults to `http://localhost:8101/api`)
- Attaches Bearer token from `localStorage`
- Handles 401 → dispatches `auth:token-expired` event
- Detects slow connections and shows warnings

Individual services (e.g., `order.service.ts`, `production.service.ts`, `delivery.service.ts`) inherit from `APIBase`.

### Styles

Global SCSS is auto-imported into every component via Vite's `css.preprocessorOptions`. The entry point `src/styles/index.scss` forwards:
- `colorVariables.module.scss` — color CSS custom properties
- `fonts.modules.scss` — font declarations

### Dual-Contifico Architecture (Nicole + Sucree)

The platform integrates **two separate Contifico accounts** — one per business entity:

| Source | Business | Env vars |
|--------|----------|----------|
| `nicole` | Nicole Pastry Arts | `CONTIFICO_API_KEY` + `CONTIFICO_TOKEN` |
| `sucree` | Sucree | `CONTIFICO_SUCREE_API_KEY` + `CONTIFICO_SUCREE_TOKEN` |

**Backend (`nicole-order-backapp`):**
- `ContificoService` accepts a `source: 'nicole' | 'sucree'` constructor param — each instance has its own product/category cache.
- `product.controller.ts` creates `nicoleService` and `sucreeService` instances; routes product fetches based on `req.user.contificoSource` from the JWT.
- Products are tagged with `{ source: 'nicole' | 'sucree' }` before being returned to the frontend.
- The product routes require `authMiddleware` so the user's source is available.

**Frontend:**
- `User.contificoSource: 'nicole' | 'sucree' | 'both'` — defaults to `'nicole'`. Set in **Gestión de Equipo** by `admin` or `SALES_MANAGER`.
- `Product.source` and `CartItem.source` track which Contifico each item belongs to.
- `OrderProductSelector` computes `activeCartSource` from the first cart item and blocks products from the other source with a clear message.
- `OrderProductCard` shows a colored brand badge (purple = Nicole, amber = Sucree) and a lock overlay when blocked.
- **Mixing restriction**: A single order can only contain products from one Contifico. Attempting to add from the other brand shows an error: "Para eso son dos pedidos — son dos empresas distintas."

### Contifico Invoice Payload — Reglas Críticas

**1. `subtotal_12` es la base gravable (siempre)**
El payload usa `subtotal_12` (no `subtotal_15`) como base imponible para IVA, sin importar si la tasa es 12% o 15%. Si `subtotal_12 = 0` → SRI rechaza con "ERROR EN DIFERENCIAS".

**2. `tipoIdentificacionComprador` — derivar solo del largo del ID**
- 13 dígitos → RUC (`tipoIdentificacionComprador = "04"`): enviar `ruc = rawId`, `cedula = ""`
- 10 dígitos → Cédula (`tipoIdentificacionComprador = "05"`): enviar `cedula = rawId`, `ruc = rawId + "001"`
- Contifico requiere `ruc` no vacío incluso para cédulas — enviar `ruc = ""` impide que el documento se firme
- NUNCA enviar ambos `cedula` y `ruc` — Contifico genera `tipoIdentificacionComprador = "None"` → SRI rechaza con "ARCHIVO NO CUMPLE ESTRUCTURA XML"
  - **EXCEPCIÓN**: `ruc = cedula + "001"` sí es aceptado porque Contifico lo trata como RUC de persona natural derivado de cédula
- `personType` del frontend NO se usa para este cálculo en el backend
- `tipo: "C"` en `clientePayload` es un tipo INVÁLIDO para el SRI. Contifico acepta la factura y la firma, pero SRI rechaza la autorización silenciosamente. La persona queda en Contifico con `tipo: "C"` de forma permanente (no se puede actualizar vía REST). La solución es crear una nueva factura usando los datos de **Consumidor Final** (`ruc: "9999999999"`) en lugar de los datos del cliente.
- **Consumidor Final en Contifico**: `persona_id: "NO8bYRVq3HX9xd7j"`, `tipo: "N"`, `ruc: "9999999999999"`, `cedula: "9999999999"`. Pasar `invoiceData.ruc = "9999999999"` es suficiente para que el backend use esta persona.
- **Blindaje automático en `createInvoice`**: Antes de crear cada factura, `ensurePersonaTipo(rawId, correctTipo)` busca la persona por RUC/cédula en Contifico (`GET /persona/?identificacion=<rawId>`). Si tiene `tipo: "C"`, intenta corregirla via `PUT /persona/`. Si el PUT falla, usa Consumidor Final automáticamente como fallback. Esto garantiza que nuevas facturas nunca queden bloqueadas por `tipo: "C"`.

**3. `sendToSriWhenReady` — timing asíncrono**
Contifico firma documentos de forma asíncrona, típicamente en 2-10 minutos. `sendToSriWhenReady` hace polling cada 15s hasta max 10 min. Si `firmado` nunca llega a `true` (Contifico a veces firma internamente sin actualizar el flag en el GET), igual intenta `sendToSri` al final del timeout.

**IMPORTANTE**: `firmado: false` en el GET de Contifico NO significa que el documento no esté listo para SRI. Contifico puede haber firmado internamente sin actualizar ese campo. Siempre intentar `sendToSri` después de 2+ minutos aunque `firmado` siga en `false`.

**Estados Contifico → SRI:** No Firmado → Firmado → Enviado SRI → Autorizado

**Flujo de facturación:**
- `POST /orders/:id/invoice/generate` — crea factura en Contifico y envía al SRI
- `POST /orders/:id/invoice/regenerate` — repara doc roto (PUT) y reenvía
- `POST /orders/:id/invoice/authorize` — reenvía doc existente al SRI (fix para timing)
- `GET /orders/:id/invoice/auth-status` — estado de autorización SRI

### Batch Invoice Scripts (nicole-order-backapp)

Scripts para operaciones masivas sobre facturas históricas. Ejecutar desde `nicole-order-backapp/`:

| Comando | Script | Propósito |
|---------|--------|-----------|
| `pnpm regen:invoices` | `scripts/regenerate-invoices.ts` | Crea facturas NUEVAS para todas las órdenes sin autorización SRI |
| `pnpm verify:invoices` | `scripts/verify-invoices.ts` | Verifica estado SRI y guarda números de autorización en DB |
| `pnpm auth:consumidor` | `scripts/authorize-consumidor-final.ts` | Crea facturas nuevas con Consumidor Final para órdenes con `tipo: "C"` bloqueadas |
| `pnpm auth:consumidor -- --order <id>` | ídem | Para una sola orden específica |

**Flujo de reparación masiva (órdenes con `tipo: "C"`):**
1. `pnpm auth:consumidor` — crea facturas nuevas con Consumidor Final, espera firma (15 min), envía al SRI
2. Esperar 5-10 min para que SRI procese
3. `pnpm verify:invoices` — recoge autorizaciones y las guarda en DB
4. Repetir paso 3 hasta que WAITING_SRI = 0

**Flujo estándar (órdenes con datos de identificación válidos):**
1. `pnpm regen:invoices` — crea facturas nuevas y envía al SRI (CHUNK_SIZE=3 para no saturar API)
2-4. Mismo flujo que arriba.

**Regla crítica:** Siempre crear factura **nueva** (`createInvoice`) para órdenes históricas con errores. No intentar reparar con PUT porque los documentos viejos acumulan errores de datos.

### Key Patterns

- **Composables** (`src/composables/`) — reusable logic (order filtering, batch operations, toast notifications, Excel export)
- **Path alias:** `@` maps to `src/`
- **Lazy loading:** Most route components use dynamic `import()` except `LoginView` and `OrderCreateView`
- **NavBar selection:** `App.vue` conditionally renders `ProductionNavBar`, `SupplyChainNavBar`, or the default `NavBar` based on `route.meta.role`
- **Build chunking:** Vite config splits vendor bundles into `vendor-xlsx`, `vendor-vue-core`, `vendor-axios`, and a generic `vendor` chunk

### Venta con link (contrato v8)

- `/orders/link/new` (`OrderLinkCreateView.vue`) es la acción principal de ventas: el asesor arma el carrito, elige "Entrega a domicilio" (con **envío estimado**) o "Retiro en isla", registra el cobro (TRA, Payphone o tarjeta; crédito, isla y cortesía siguen disponibles) y guarda. `POST /orders` con `clientLink` devuelve `clientLinkUrl` + `clientWhatsappMessage`; el cliente llena fecha, hora, dirección/isla y factura en la tienda (`/pedido/<token>`).
- Link de pago: `PayphoneLinkPanel` → `POST /payphone/links` con el desglose de `utils/payphone.ts` (base con IVA + 15%; los productos de precio final van en `amountWithoutTax`). Después el asesor solo escribe el número de transacción (cobro TC · Datafast).
- Envío en un solo campo: `useDeliveryLine` sincroniza el valor de envío con la línea "Delivery" del carrito (en la venta con link y en el pedido manual).
- Mientras el cliente no completa el link, el pedido no tiene `deliveryDate` y `productionStage = AWAITING_CLIENT`. Usa `utils/clientLink.ts` (`clientLinkState`, `DATE_PENDING_LABEL`) para mostrarlo; cualquier vista que formatee `deliveryDate` debe tolerar `null`.
- Regla de fechas (`useScheduleRules`): sale de la tienda (`VITE_TIENDA_API` → `GET /api/settings/public`, `minLeadDays` + `timeSlots`). Por defecto, desde mañana y de 11h00 a 18h00. Se aplica al crear pedidos manuales y al cambiar la fecha en edición.
- Avisos: `NotificationBell` en `AppSidebar` (`GET /notifications` cada 60 s y al volver a la pestaña, estado compartido en `useNotifications`).
- Vendedor por defecto = usuario logueado (`useDefaultSeller`, comparación por nombre porque el usuario no guarda cédula).
