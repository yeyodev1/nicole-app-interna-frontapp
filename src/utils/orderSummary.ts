export function generateOrderSummary(order: any): string {
  const productsString = order.products
    .map((p: any) => `- ${p.quantity}x ${p.name}${(p.features && p.features.length > 0) ? ` (${p.features.join(', ')})` : ''}`)
    .join("\n");

  // Venta con link: la fecha la elige el cliente, puede no existir todavía.
  const dateObj = order.deliveryDate ? new Date(order.deliveryDate) : null;
  const dateFormatted = dateObj ? dateObj.toLocaleDateString('es-EC') : 'Por definir (cliente)';
  const timeFormatted = order.deliveryTime || (dateObj ? dateObj.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--');

  // Location logic
  let locationInfo = "";
  if (order.deliveryType === 'retiro') {
    locationInfo = `Retiro en local - ${order.branch || 'Principal'}`;
  } else {
    const address = order.deliveryAddress || 'Dirección no especificada';
    const link = order.googleMapsLink ? `\nLink: ${order.googleMapsLink}` : '';
    locationInfo = `${address}${link}`;
  }

  // Delivery/Retiro label
  const deliveryTypeLabel = order.deliveryType === 'delivery' ? 'Entrega a domicilio' : 'Retiro en local';

  return `*⚜Confirmado su pedido⚜* 
Nombre: ${order.customerName}
Dirección factura: ${order.invoiceData?.address || "N/A"}
Retiro/Entrega: ${deliveryTypeLabel}
Pedido: 
${productsString}
Fecha y Hora: ${dateFormatted}, ${timeFormatted}
Celular: ${order.customerPhone || "N/A"}
Cédula o RUC: ${order.invoiceData?.ruc || "N/A"}
Correo: ${order.invoiceData?.email || "N/A"}
Ubicación: ${locationInfo}`.trim();
}
