/** Decode WebSocket frames (string, Blob, ArrayBuffer). */
export async function decodeChartWsMessage(raw) {
  if (typeof raw === 'string') return raw
  if (raw instanceof Blob) return raw.text()
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw)
  if (ArrayBuffer.isView(raw)) return new TextDecoder().decode(raw.buffer)
  return null
}
