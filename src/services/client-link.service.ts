import APIBase from './httpBase'

/** Desglose que pide Payphone: todo en centavos y la suma es el total cobrado. */
export interface PayphoneLinkRequest {
  amountWithTaxCents: number
  taxCents: number
  amountWithoutTaxCents: number
  reference: string
  clientTransactionId?: string
}

/**
 * Venta con link (contrato v8): el asesor cobra y el cliente gestiona su entrega
 * y su factura en la tienda, con el link que devuelve `POST /orders`.
 */
class ClientLinkService extends APIBase {
  /** Extiende el link 7 días más. Si el cliente ya lo completó, el backend responde 409. */
  async renew(orderId: string): Promise<{ order: any; clientLinkUrl?: string }> {
    const response = await this.post<any>(`orders/${orderId}/client-link/renew`, {})
    return response.data
  }

  /** Link de pago de Payphone por el total del carrito. */
  async createPayphoneLink(body: PayphoneLinkRequest): Promise<{ url: string }> {
    const response = await this.post<{ url: string }>('payphone/links', body)
    return response.data
  }
}

export default new ClientLinkService()
