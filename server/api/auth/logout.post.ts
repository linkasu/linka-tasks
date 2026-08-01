import { destroySession } from '../../services/auth'

export default defineEventHandler(async (event) => {
  await destroySession(event)
  return { ok: true }
})
