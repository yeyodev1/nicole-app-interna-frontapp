import { shallowRef } from 'vue'
import OrderService from '@/services/order.service'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

/** Acciones sobre una reserva, compartidas por el panel y el detalle del pedido. */
export function useReservaActions(onChanged: () => void | Promise<void>) {
  const { success, error: showError, warning } = useToast()
  const dialog = useDialog()
  const busyId = shallowRef<string | null>(null)

  async function run(id: string, task: () => Promise<unknown>, message: string) {
    busyId.value = id
    try {
      await task()
      success(message)
      await onChanged()
    } catch (err: any) {
      showError(err.data?.message || err.message || 'No se pudo guardar el cambio.')
    } finally {
      busyId.value = null
    }
  }

  const contact = (order: any) =>
    run(order._id, () => OrderService.contactReserva(order._id), 'Reserva marcada como contactada.')

  const undoContact = (order: any) =>
    run(order._id, () => OrderService.undoReservaContact(order._id), 'Contacto deshecho.')

  const restore = (order: any) =>
    run(order._id, () => OrderService.restoreReserva(order._id), 'Reserva recuperada.')

  /** Otro intento de contacto: queda en el historial de la reserva. */
  async function newContact(order: any) {
    const note = await dialog.prompt('¿Qué pasó en este contacto?', {
      title: 'Registrar otro contacto',
      placeholder: 'Ej.: no contesta, volver a llamar',
      confirmLabel: 'Registrar'
    })
    if (note === null) return
    await run(order._id, () => OrderService.contactReserva(order._id, note), 'Contacto registrado.')
  }

  async function editNote(order: any) {
    const log = order.webOrder?.contactLog || []
    const current = log[log.length - 1]?.note || ''
    const note = await dialog.prompt('Nota del último contacto:', {
      title: 'Nota del contacto',
      placeholder: 'Ej.: paga mañana por transferencia',
      defaultValue: current,
      confirmLabel: 'Guardar'
    })
    if (note === null) return
    await run(order._id, () => OrderService.setReservaContactNote(order._id, note), 'Nota guardada.')
  }

  async function markManaged(order: any) {
    const confirmed = await dialog.confirm('La reserva ya tiene su cobro registrado y pasará a contar como venta.', {
      title: 'Marcar como gestionada',
      confirmLabel: 'Sí, gestionada',
      cancelLabel: 'Cancelar',
      variant: 'info'
    })
    if (!confirmed) return
    await run(order._id, () => OrderService.markWebOrderManaged(order._id), 'Reserva gestionada.')
  }

  /** Devuelve true si se pudo llamar al servidor (aunque alguna reserva se haya omitido). */
  async function discard(ids: string[], payload: { reason?: string; note?: string }): Promise<boolean> {
    busyId.value = ids[0] ?? null
    try {
      const { discarded, skipped } = await OrderService.discardReservas(ids, payload)
      if (discarded.length > 0) {
        success(discarded.length === 1 ? 'Reserva eliminada de la lista.' : `${discarded.length} reservas eliminadas de la lista.`)
      }
      const [firstSkipped] = skipped
      if (skipped.length === 1 && firstSkipped) warning(`No se eliminó: ${firstSkipped.reason}`)
      else if (skipped.length > 1) warning(`${skipped.length} reservas no se eliminaron: ya tienen cobro, comprobante o entraron a producción.`)
      await onChanged()
      return true
    } catch (err: any) {
      showError(err.data?.message || err.message || 'No se pudo eliminar.')
      return false
    } finally {
      busyId.value = null
    }
  }

  return { busyId, contact, undoContact, restore, newContact, editNote, markManaged, discard }
}
