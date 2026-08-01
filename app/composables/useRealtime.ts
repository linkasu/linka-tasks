import type { Ref } from 'vue'

export interface RealtimeInvalidation {
  type: string
  entityId?: string
  data?: Record<string, unknown>
  source: 'websocket' | 'polling'
}

type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

const PING_INTERVAL_MS = 8 * 60 * 1000
const PONG_TIMEOUT_MS = 30 * 1000
const CONNECTION_LIFETIME_MS = 55 * 60 * 1000
const POLLING_INTERVAL_MS = 30 * 1000
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 5 * 60 * 1000

export function useRealtime(enabled: Readonly<Ref<boolean>>) {
  const config = useRuntimeConfig()
  const status = ref<RealtimeStatus>('idle')
  let socket: WebSocket | null = null
  let reconnectAttempt = 0
  let running = false
  let reconnectTimer: number | null = null
  let pingTimer: number | null = null
  let pongTimer: number | null = null
  let connectionTimer: number | null = null
  let pollingTimer: number | null = null

  function clearTimer(timer: number | null) {
    if (timer !== null) window.clearTimeout(timer)
  }

  function clearConnectionTimers() {
    clearTimer(pingTimer)
    clearTimer(pongTimer)
    clearTimer(connectionTimer)
    pingTimer = null
    pongTimer = null
    connectionTimer = null
  }

  function invalidate(message: Omit<RealtimeInvalidation, 'source'>, source: RealtimeInvalidation['source']) {
    const detail: RealtimeInvalidation = { ...message, source }
    window.dispatchEvent(new CustomEvent<RealtimeInvalidation>('linka:invalidate', { detail }))
    void refreshNuxtData().catch(() => {})
  }

  function startPolling() {
    if (pollingTimer !== null) return
    pollingTimer = window.setInterval(() => {
      invalidate({ type: 'poll' }, 'polling')
    }, POLLING_INTERVAL_MS)
  }

  function stopPolling() {
    clearTimer(pollingTimer)
    pollingTimer = null
  }

  function resolveWebSocketUrl() {
    const configuredUrl = config.public.websocketUrl.trim()
    if (!configuredUrl) return null

    const url = new URL(configuredUrl, window.location.href)
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol === 'https:') url.protocol = 'wss:'
    return url.toString()
  }

  function scheduleReconnect() {
    if (!running || reconnectTimer !== null || !navigator.onLine) return

    const exponentialDelay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS)
    const delay = exponentialDelay * (0.75 + Math.random() * 0.5)
    reconnectAttempt = Math.min(reconnectAttempt + 1, 16)
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect() {
    if (!running || socket || !navigator.onLine) return

    const url = resolveWebSocketUrl()
    if (!url) {
      status.value = 'disconnected'
      startPolling()
      return
    }

    status.value = 'connecting'
    startPolling()

    let nextSocket: WebSocket
    try {
      // Browser WebSockets send matching cookies automatically; credentials never enter the URL.
      nextSocket = new WebSocket(url)
    } catch {
      status.value = 'disconnected'
      scheduleReconnect()
      return
    }
    socket = nextSocket

    nextSocket.addEventListener('open', () => {
      if (socket !== nextSocket) return
      status.value = 'connected'
      reconnectAttempt = 0
      stopPolling()

      pingTimer = window.setInterval(() => {
        if (nextSocket.readyState !== WebSocket.OPEN) return
        nextSocket.send('ping')
        clearTimer(pongTimer)
        pongTimer = window.setTimeout(() => nextSocket.close(4001, 'Heartbeat timeout'), PONG_TIMEOUT_MS)
      }, PING_INTERVAL_MS)
      connectionTimer = window.setTimeout(() => nextSocket.close(4000, 'Scheduled reconnect'), CONNECTION_LIFETIME_MS)
    })

    nextSocket.addEventListener('message', (event) => {
      if (socket !== nextSocket || typeof event.data !== 'string') return

      let message: unknown
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (!message || typeof message !== 'object' || !('type' in message) || typeof message.type !== 'string') return
      if (message.type === 'pong') {
        clearTimer(pongTimer)
        pongTimer = null
        return
      }
      if (message.type === 'ready') return

      const realtimeMessage = message as { type: string, entityId?: string, data?: Record<string, unknown> }
      invalidate(realtimeMessage, 'websocket')
    })

    nextSocket.addEventListener('error', () => nextSocket.close())
    nextSocket.addEventListener('close', () => {
      if (socket !== nextSocket) return
      socket = null
      clearConnectionTimers()
      status.value = 'disconnected'
      startPolling()
      scheduleReconnect()
    })
  }

  function start() {
    if (!import.meta.client || running) return
    running = true
    startPolling()
    connect()
  }

  function stop() {
    if (!import.meta.client) return
    running = false
    clearTimer(reconnectTimer)
    reconnectTimer = null
    clearConnectionTimers()
    stopPolling()
    reconnectAttempt = 0
    status.value = 'idle'

    const activeSocket = socket
    socket = null
    activeSocket?.close(1000, 'Client stopped')
  }

  function reconnectWhenOnline() {
    if (!running) return
    clearTimer(reconnectTimer)
    reconnectTimer = null
    connect()
  }

  function disconnectWhenOffline() {
    if (!running) return
    status.value = 'disconnected'
    startPolling()
    socket?.close()
  }

  watch(enabled, value => value ? start() : stop())
  onMounted(() => {
    window.addEventListener('online', reconnectWhenOnline)
    window.addEventListener('offline', disconnectWhenOffline)
    if (enabled.value) start()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', reconnectWhenOnline)
    window.removeEventListener('offline', disconnectWhenOffline)
    stop()
  })

  return { status: readonly(status) }
}
