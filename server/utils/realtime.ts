export const gatewayConnectionIdHeader = 'x-yc-apigateway-websocket-connection-id'
export const gatewayEventTypeHeader = 'x-yc-apigateway-websocket-event-type'

export type GatewayEventType = 'CONNECT' | 'MESSAGE' | 'DISCONNECT'

export interface GatewayWebSocketEvent {
  connectionId: string
  eventType: GatewayEventType
}

type HeaderSource = Headers | Record<string, string | string[] | undefined>

function headerValue(headers: HeaderSource, name: string): string | undefined {
  if (headers instanceof Headers)
    return headers.get(name)?.trim() || undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  const value = entry?.[1]
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined
}

export function parseGatewayWebSocketEvent(headers: HeaderSource): GatewayWebSocketEvent | null {
  const connectionId = headerValue(headers, gatewayConnectionIdHeader)
  const eventType = headerValue(headers, gatewayEventTypeHeader)?.toUpperCase()
  if (!connectionId || (eventType !== 'CONNECT' && eventType !== 'MESSAGE' && eventType !== 'DISCONNECT'))
    return null
  return { connectionId, eventType }
}

export function gatewayMessageResponse(): string {
  return JSON.stringify({ type: 'pong' })
}
