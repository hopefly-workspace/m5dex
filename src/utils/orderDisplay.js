/**
 * User-facing order number from normalized row or API raw object.
 * Never falls back to internal id / orderId.
 */
export function resolveOrderNo(order) {
  if (!order) return '';
  const direct = order.orderNo ?? order.orderno;
  if (direct != null && String(direct).trim() !== '') {
    return String(direct).trim();
  }
  const raw = order.raw;
  if (raw && typeof raw === 'object') {
    const fromRaw = raw.orderno ?? raw.orderNo ?? raw.order_no;
    if (fromRaw != null && String(fromRaw).trim() !== '') {
      return String(fromRaw).trim();
    }
  }
  return '';
}
