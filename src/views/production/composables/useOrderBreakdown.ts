import { computed, type Ref } from 'vue';

export interface BreakdownLine {
  name: string;
  pedido: number;
  enviado: number;
  estado: { label: string; class: string };
}

/**
 * Detalle de un pedido en Órdenes: por producto, lo pedido y lo enviado.
 * Verde = completo, amarillo = parcial, morado = de más.
 */
export function useOrderBreakdown(order: Ref<any>) {
  // Por productId (como el servidor); si un despacho viejo no lo trae, por nombre.
  const sentOf = (p: any): number => {
    let sent = 0;
    for (const d of order.value?.dispatches || []) {
      for (const item of d.items || []) {
        const match = item.productId ? String(item.productId) === String(p._id) : String(item.name || '') === String(p.name);
        if (match) sent += Number(item.quantitySent) || 0;
      }
    }
    return sent;
  };

  // Ya no se exige "marcar producido": el detalle compara lo pedido con lo enviado.
  const lines = computed<BreakdownLine[]>(() =>
    (order.value?.products || []).map((p: any) => {
      const pedido = p.quantity || 0;
      const enviado = sentOf(p);

      let estado = { label: 'Sin enviar', class: 'none' };
      if (enviado > pedido) estado = { label: `+${enviado - pedido} de más`, class: 'over' };
      else if (enviado >= pedido) estado = { label: 'Completo', class: 'ok' };
      else if (enviado > 0) estado = { label: `Faltan ${pedido - enviado}`, class: 'partial' };

      return { name: p.name, pedido, enviado, estado };
    })
  );

  const totals = computed(() =>
    lines.value.reduce(
      (acc, l) => ({ pedido: acc.pedido + l.pedido, enviado: acc.enviado + l.enviado }),
      { pedido: 0, enviado: 0 }
    )
  );

  const veredicto = computed(() => {
    const count = (c: string) => lines.value.filter(l => l.estado.class === c).length;
    if (count('none') || count('partial')) return { label: `${count('none') + count('partial')} producto(s) por enviar`, class: 'partial' };
    if (count('over')) return { label: 'Completo, con producto enviado de más', class: 'over' };
    return { label: 'Todo enviado', class: 'ok' };
  });

  const fmt = (d: string | Date) =>
    new Date(d).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const receptionLabel = (status: string) =>
    status === 'RECEIVED' ? 'Recibido' : status === 'PROBLEM' ? 'Recibido con novedad' : 'Pendiente de recibir';

  return { lines, totals, veredicto, fmt, receptionLabel };
}
