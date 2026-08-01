import type { WsConnectionRecord } from '../domain/models'
import { useStorage } from '../storage'

export interface RealtimeMessage {
  type: string
  entityId?: string
  data?: Record<string, unknown>
}

const metadataTokenUrl = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token'
const connectionSendUrl = 'https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections'
let cachedIamToken: { value: string, expiresAt: number } | undefined

export async function connectPeer(id: string, userId: string): Promise<void> {
  const now = new Date()
  const record: WsConnectionRecord = {
    id, userId, connectedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  }
  await useStorage().put('ws_connections', record)
}

export async function disconnectPeer(id: string): Promise<void> {
  await useStorage().remove('ws_connections', id)
}

export async function broadcast(message: RealtimeMessage): Promise<void> {
  const storage = useStorage()
  const connections = await storage.list<WsConnectionRecord>('ws_connections')
  const active: WsConnectionRecord[] = []
  for (const connection of connections) {
    if (Date.parse(connection.expiresAt) <= Date.now())
      await storage.remove('ws_connections', connection.id)
    else
      active.push(connection)
  }
  if (active.length === 0)
    return

  const encoded = JSON.stringify(message)
  const token = await runtimeIamToken()
  await Promise.all(active.map(async (connection) => {
    try {
      const response = await fetch(`${connectionSendUrl}/${encodeURIComponent(connection.id)}:send`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ data: Buffer.from(encoded, 'utf8').toString('base64'), type: 'TEXT' }),
      })
      if (response.status === 404 || response.status === 410) {
        await storage.remove('ws_connections', connection.id)
        return
      }
      if (!response.ok)
        throw new Error(`Connection.Send failed with HTTP ${response.status}`)
    }
    catch (error) {
      console.error(`Realtime delivery to ${connection.id} failed`, error)
    }
  }))
}

async function runtimeIamToken(): Promise<string> {
  if (cachedIamToken && cachedIamToken.expiresAt > Date.now())
    return cachedIamToken.value
  const response = await fetch(metadataTokenUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(3_000),
  })
  if (!response.ok)
    throw new Error(`IAM metadata token request failed with HTTP ${response.status}`)
  const payload = await response.json() as { access_token?: unknown, expires_in?: unknown }
  if (typeof payload.access_token !== 'string' || !payload.access_token)
    throw new Error('IAM metadata token response has no access_token')
  const expiresIn = Number(payload.expires_in)
  cachedIamToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (Number.isFinite(expiresIn) ? expiresIn : 300) - 60) * 1000,
  }
  return cachedIamToken.value
}
