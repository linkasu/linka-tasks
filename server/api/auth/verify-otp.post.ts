import { verifyOtpSchema } from '#shared/schemas'
import type { OtpRecord, UserRecord } from '../../domain/models'
import { otpTransitions, transition } from '../../domain/fsm'
import { createSession } from '../../services/auth'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { bodyAs } from '../../utils/http'
import { verifySecret } from '../../utils/security'

export default defineEventHandler(async (event) => {
  const { username, code } = await bodyAs(event, verifyOtpSchema)
  const candidates = (await useStorage().list<OtpRecord>('otp'))
    .filter(item => item.username === username && item.state === 'issued')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const otp = candidates[0]
  if (!otp || Date.parse(otp.expiresAt) <= Date.now())
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired code' })

  if (!verifySecret(code, otp.codeHash)) {
    otp.attempts += 1
    if (otp.attempts >= 5)
      otp.state = transition(otpTransitions, otp.state, 'locked')
    await useStorage().put('otp', otp)
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired code' })
  }

  otp.state = transition(otpTransitions, otp.state, 'consumed')
  await useStorage().put('otp', otp)
  const user = await useStorage().get<UserRecord>('users', otp.userId)
  if (!user || user.state !== 'active')
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired code' })
  await createSession(event, user)
  await recordChange(user, 'login', 'session', otp.id)
  return { user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, state: user.state, timezone: user.timezone } }
})
