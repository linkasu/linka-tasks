import { publicUser } from '../../services/auth'
import { requireUser } from '../../utils/http'

export default defineEventHandler(event => ({ user: publicUser(requireUser(event)) }))
