import { resolveSessionToken, sessionCookie } from '../../services/auth'
import { connectPeer, disconnectPeer } from '../../services/realtime'
import { gatewayMessageResponse, parseGatewayWebSocketEvent } from '../../utils/realtime'

export default defineEventHandler(async (event) => {
  const gatewayEvent = parseGatewayWebSocketEvent(getRequestHeaders(event))
  if (!gatewayEvent)
    throw createError({ statusCode: 426, statusMessage: 'Direct WebSocket connections are not supported' })

  if (gatewayEvent.eventType === 'CONNECT') {
    const user = await resolveSessionToken(getCookie(event, sessionCookie))
    if (!user)
      throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
    await connectPeer(gatewayEvent.connectionId, user.id)
    return ''
  }

  if (gatewayEvent.eventType === 'DISCONNECT') {
    await disconnectPeer(gatewayEvent.connectionId)
    return ''
  }

  await readRawBody(event)
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return gatewayMessageResponse()
})
