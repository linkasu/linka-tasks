import { createStorage, setStorage } from '../storage'
import { seedOwner } from '../services/seed'

export default defineNitroPlugin(async (nitroApp) => {
  const storage = createStorage(useRuntimeConfig())
  await storage.migrate()
  await seedOwner(storage)
  setStorage(storage)
  nitroApp.hooks.hook('close', () => storage.close())
})
