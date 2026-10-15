import { isPrecioIvaIncluido } from '@/constants/pricing'
import type { CartItem } from '@/types/order'

/**
 * Desglose del carrito para el link de pago de Payphone, en centavos.
 * - Productos con IVA: base (precio × cantidad, con descuento) y 15% de IVA aparte.
 * - Productos con precio final (Delivery, TORT-001): van en `amountWithoutTax` tal cual,
 *   porque su precio ya trae el IVA dentro.
 * La suma de los tres siempre cierra en el total del pedido (`totalValue`).
 */
export function payphoneBreakdown(
  cart: CartItem[],
  opts: { globalDiscountPercentage?: number; isGlobalCourtesy?: boolean; totalValue: number }
) {
  if (opts.isGlobalCourtesy) return { amountWithTaxCents: 0, taxCents: 0, amountWithoutTaxCents: 0 }

  let base = 0
  let finalPrice = 0
  for (const item of cart) {
    let discount = item.isCourtesy ? 100 : 0
    if (opts.globalDiscountPercentage && opts.globalDiscountPercentage > 0 && discount < 100) {
      discount = opts.globalDiscountPercentage
    }
    const line = item.price * item.quantity * ((100 - discount) / 100)
    if (isPrecioIvaIncluido(item)) {
      finalPrice += line
    } else {
      base += line
    }
  }

  const amountWithTaxCents = Math.round(base * 100)
  const amountWithoutTaxCents = Math.round(finalPrice * 100)
  // El IVA absorbe el redondeo para que la suma sea exactamente el total.
  const totalCents = Math.round(opts.totalValue * 100)
  const taxCents = Math.max(0, totalCents - amountWithTaxCents - amountWithoutTaxCents)
  return { amountWithTaxCents, taxCents, amountWithoutTaxCents }
}

/** Teléfono ecuatoriano a formato internacional para wa.me (09… → 5939…). */
export function toWhatsAppNumber(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('593')) return digits
  if (digits.startsWith('0')) return `593${digits.slice(1)}`
  if (digits.length === 9) return `593${digits}`
  return digits
}

export function whatsappUrl(phone: string | undefined, text: string): string {
  const number = toWhatsAppNumber(phone)
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
