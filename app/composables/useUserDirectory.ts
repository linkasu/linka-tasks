import type { PublicUser } from '#shared/types'

export function useUserDirectory() {
  const { user } = useAuth()

  async function fetchUsers() {
    try {
      const response = await $fetch<{ users: PublicUser[] }>('/api/users')
      return response.users
    } catch {
      if (user.value?.role !== 'member') {
        try {
          const response = await $fetch<{ users: PublicUser[] }>('/api/admin/users')
          return response.users
        } catch {
          // The public directory is optional for deployments with restricted member visibility.
        }
      }
      return user.value ? [user.value] : []
    }
  }

  return { fetchUsers }
}
