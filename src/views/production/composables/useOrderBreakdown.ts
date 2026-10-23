import { computed, type Ref } from 'vue';

export interface BreakdownLine {
  name: string;
  pedido: number;
  hecho: number;
  enviado: number;
  cerrado: boolean; // resto eliminado: la fila se cerró produciendo menos
  estado: { label: string; class: string };
}

/**
 * Cuadre de una orden de producción: lo pedido, lo que realmente se hizo y lo
 * que ya salió, para confirmar antes (y después) de marcar enviado.
 */
export function useOrderBreakdown(order: Ref<any>) {
  const sentByProduct = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const d of order.value?.dispatches || []) {
      for (const item of d.items || []) {
        const key = String(item.name || '');
        map.set(key, (map.get(key) || 0) + (item.quantitySent || 0));
      }
    }
    return map;
  });

  const lines = computed<BreakdownLine[]>(() =>
    (order.value?.products || []).map((p: any) => {
      const pedido = p.quantity || 0;
      const hecho = p.produced || 0;
      const enviado = sentByProduct.value.get(String(p.name)) || 0;
      const cerrado = p.productionStatus === 'COMPLETED' && hecho < pedido;

      // Si la fila se cerró con menos, lo exigible es lo que se hizo.
      const exigible = cerrado ? hecho : pedido;

      let estado = { label: 'Todo cuadra', class: 'ok' };
      if (hecho < pedido && !cerrado) {
        estado = { label: `Falta producir ${pedido - hecho}`, class: 'warn' };
      } else if (enviado < exigible) {
        estado = { label: `Falta enviar ${exigible - enviado}`, class: 'pending' };
      } else if (enviado > pedido) {
        estado = { label: `Se envió ${enviado - pedido} de más`, class: 'bad' };
      } else if (cerrado) {
        estado = { label: `Cerrado con ${pedido - hecho} menos`, class: 'closed' };
      }

      return { name: p.name, pedido, hecho, enviado, cerrado, estado };
    })
  );

  const totals = computed(() =>
    lines.value.reduce(
      (acc, l) => ({
        pedido: acc.pedido + l.pedido,
        hecho: acc.hecho + l.hecho,
        enviado: acc.enviado + l.enviado,
      }),
      { pedido: 0, hecho: 0, enviado: 0 }
    )
  );

  const veredicto = computed(() => {
    const count = (c: string) => lines.value.filter(l => l.estado.class === c).length;
    if (count('bad')) return { label: 'Hay producto enviado de más', class: 'bad' };
    if (count('warn')) return { label: `${count('warn')} producto(s) sin terminar de producir`, class: 'warn' };
    if (count('pending')) return { label: `${count('pending')} producto(s) por enviar`, class: 'pending' };
    return { label: 'Todo cuadra: lo que se hizo ya salió', class: 'ok' };
  });

  const fmt = (d: string | Date) =>
    new Date(d).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const receptionLabel = (status: string) =>
    status === 'RECEIVED' ? 'Recibido' : status === 'PROBLEM' ? 'Recibido con novedad' : 'Pendiente de recibir';

  return { lines, totals, veredicto, fmt, receptionLabel };
}
