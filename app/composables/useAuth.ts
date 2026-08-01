import type { PublicUser } from '#shared/types'

export function useAuth() {
  const user = useState<PublicUser | null>('auth-user', () => null)
  const ready = useState('auth-ready', () => false)
  const loading = useState('auth-loading', () => false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      const response = await $fetch<{ user: PublicUser }>('/api/auth/me')
      user.value = response.user
    } catch {
      user.value = null
    } finally {
      ready.value = true
      loading.value = false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    ready.value = true
  }

  return { user, ready, loading, refresh, logout }
}
