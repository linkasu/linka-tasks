export default defineNuxtRouteMiddleware(async (to) => {
  const { user, ready, refresh } = useAuth()
  if (!ready.value) await refresh()
  if (!user.value && to.path !== '/login') return navigateTo('/login')
  if (user.value && to.path === '/login') return navigateTo('/')
})
