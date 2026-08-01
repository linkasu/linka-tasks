import { requestOtpSchema } from '#shared/schemas'
import type { OtpRecord, UserRecord } from '../../domain/models'
import { useStorage } from '../../storage'
import { bodyAs } from '../../utils/http'
import { hashSecret, hashToken, randomOtp } from '../../utils/security'
import { sendTelegramOtp, verifyTelegramChat } from '../../services/telegram'

export default defineEventHandler(async (event) => {
  const { username } = await bodyAs(event, requestOtpSchema)
  const config = useRuntimeConfig()
  const token = String(config.telegramBotToken || '')
  if (!token)
    throw createError({ statusCode: 503, statusMessage: 'Telegram authentication is not configured' })

  const requesterHash = hashToken(getRequestIP(event, { xForwardedFor: true }) || 'unknown')
  const recent = (await useStorage().list<OtpRecord>('otp')).filter(otp =>
    (otp.username === username || otp.requesterHash === requesterHash)
    && Date.parse(otp.createdAt) > Date.now() - 10 * 60 * 1000,
  )
  if (recent.length >= 5)
    throw createError({ statusCode: 429, statusMessage: 'Too many OTP requests' })

  const user = (await useStorage().list<UserRecord>('users')).find(item => item.username === username)
  if (!user || user.state !== 'active' || !user.telegramChatId)
    return { accepted: true }
  if (!await verifyTelegramChat(token, user.telegramChatId, username))
    return { accepted: true }

  const code = randomOtp()
  const otp: OtpRecord = {
    id: crypto.randomUUID(), username, userId: user.id, codeHash: hashSecret(code), state: 'issued', attempts: 0,
    requesterHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), createdAt: new Date().toISOString(),
  }
  await useStorage().put('otp', otp)
  try {
    await sendTelegramOtp(token, user.telegramChatId, code)
  }
  catch {
    await useStorage().remove('otp', otp.id)
    throw createError({ statusCode: 502, statusMessage: 'Telegram delivery failed' })
  }
  return { accepted: true }
})
