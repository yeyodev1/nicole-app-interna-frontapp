import { computed, watch, type Ref } from 'vue'
import ProductService from '@/services/product.service'
import type { CartItem, Product } from '@/types/order'

/**
 * Un solo lugar para el envío: el valor que escribe el asesor ES la línea
 * "Delivery" del carrito (la que se factura). Antes se escribía el valor y
 * además había que agregar el producto a mano; ahora una cosa mueve la otra.
 *
 * - Escribir un valor > 0 agrega o actualiza la línea (precio IVA incluido).
 * - Borrar el valor (o apagar la entrega) quita la línea.
 * - Cambiar o quitar la línea desde el carrito actualiza el valor.
 */

export const isDeliveryLine = (item: { name?: string }) => {
  const name = String(item.name || '').toLowerCase()
  return name.includes('delivery') || name.includes('envío') || name.includes('envio')
}

// Producto "Delivery" de cada cuenta de Contífico, cacheado por sesión.
const deliveryProductCache: Partial<Record<'nicole' | 'sucree', Product | null>> = {}

async function findDeliveryProduct(source: 'nicole' | 'sucree'): Promise<Product | null> {
  if (source in deliveryProductCache) return deliveryProductCache[source] ?? null
  const results = await ProductService.getProducts({ filtro: 'delivery', page: 1, limit: 20 })
  const candidates = results.filter(p => isDeliveryLine({ name: p.nombre }) && (p.source || 'nicole') === source)
  const product = candidates.find(p => p.pvp_manual) || candidates[0] || null
  deliveryProductCache[source] = product
  return product
}

export function useDeliveryLine(options: {
  cart: Ref<CartItem[]>
  /** Valor del envío que escribe el asesor (IVA incluido). */
  value: Ref<number | undefined | null>
  /** Solo hay línea de envío cuando el pedido es delivery. */
  enabled: Ref<boolean>
  source: Ref<'nicole' | 'sucree' | null>
  onError?: (message: string) => void
}) {
  const { cart, value, enabled, source, onError } = options

  const deliveryLine = computed(() => cart.value.find(isDeliveryLine))

  let timer: ReturnType<typeof setTimeout> | null = null

  const removeLines = () => {
    const idx = cart.value.findIndex(isDeliveryLine)
    if (idx >= 0) cart.value.splice(idx, 1)
  }

  const apply = async () => {
    const amount = Number(value.value || 0)
    if (!enabled.value || !(amount > 0)) {
      if (deliveryLine.value) removeLines()
      return
    }

    const rounded = Number(amount.toFixed(2))
    const existing = deliveryLine.value
    if (existing) {
      if (existing.price !== rounded || existing.quantity !== 1) {
        existing.price = rounded
        existing.quantity = 1
      }
      return
    }

    try {
      const product = await findDeliveryProduct(source.value || 'nicole')
      if (!product) {
        onError?.('No encontré el producto "Delivery" en Contífico. Agrégalo desde el catálogo.')
        return
      }
      // Pudo cambiar mientras se buscaba el producto
      if (!enabled.value || !(Number(value.value || 0) > 0) || deliveryLine.value) return
      cart.value.push({
        id: product.id,
        contifico_id: product.id,
        name: product.nombre,
        price: Number(Number(value.value).toFixed(2)),
        quantity: 1,
        isCourtesy: false,
        source: product.source
      })
    } catch (e) {
      console.error('Error buscando el producto Delivery:', e)
      onError?.('No se pudo cargar el producto "Delivery" de Contífico.')
    }
  }

  watch([value, enabled], () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(apply, 350)
  })

  // Cambios hechos desde el carrito (precio del producto manual o quitar la línea).
  watch(
    () => deliveryLine.value ? { price: deliveryLine.value.price, qty: deliveryLine.value.quantity } : null,
    (line, prev) => {
      if (line) {
        // Producto Delivery agregado desde el catálogo con precio $0: manda el valor escrito.
        if (line.price === 0 && Number(value.value || 0) > 0) {
          deliveryLine.value!.price = Number(Number(value.value).toFixed(2))
          deliveryLine.value!.quantity = 1
          return
        }
        const total = Number((line.price * line.qty).toFixed(2))
        if (Number(value.value || 0) !== total) value.value = total
      } else if (prev && enabled.value && Number(value.value || 0) > 0) {
        // El asesor quitó la línea desde el carrito: el envío queda en 0.
        value.value = 0
      }
    }
  )

  return { deliveryLine }
}
