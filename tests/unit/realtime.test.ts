import { describe, expect, it } from 'vitest'
import { gatewayMessageResponse, parseGatewayWebSocketEvent } from '../../server/utils/realtime'

describe('API Gateway WebSocket helpers', () => {
  it('reads lifecycle headers case-insensitively', () => {
    expect(parseGatewayWebSocketEvent({
      'X-Yc-Apigateway-Websocket-Connection-Id': ' connection-1 ',
      'X-Yc-Apigateway-Websocket-Event-Type': 'connect',
    })).toEqual({ connectionId: 'connection-1', eventType: 'CONNECT' })
  })

  it('rejects incomplete and unsupported lifecycle headers', () => {
    expect(parseGatewayWebSocketEvent(new Headers({
      'X-Yc-Apigateway-Websocket-Event-Type': 'MESSAGE',
    }))).toBeNull()
    expect(parseGatewayWebSocketEvent({
      'x-yc-apigateway-websocket-connection-id': 'connection-1',
      'x-yc-apigateway-websocket-event-type': 'UNKNOWN',
    })).toBeNull()
  })

  it('returns a text pong for message events', () => {
    expect(gatewayMessageResponse()).toBe('{"type":"pong"}')
  })
})
