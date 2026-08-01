import { useStorage } from '../storage'

export default defineEventHandler(() => ({ ok: true, storage: useStorage().kind }))
