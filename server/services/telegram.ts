interface TelegramResult<T> { ok: boolean, result?: T, description?: string }
interface TelegramChat { id: number, username?: string }

async function telegramCall<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const response = await $fetch<TelegramResult<T>>(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', body, retry: 0,
  })
  if (!response.ok || response.result === undefined)
    throw new Error(`Telegram ${method} failed: ${response.description || 'unknown error'}`)
  return response.result
}

export async function verifyTelegramChat(token: string, chatId: string, username: string): Promise<boolean> {
  const chat = await telegramCall<TelegramChat>(token, 'getChat', { chat_id: chatId })
  return chat.id.toString() === chatId && chat.username?.toLowerCase() === username
}

export async function sendTelegramOtp(token: string, chatId: string, code: string): Promise<void> {
  await sendTelegramMessage(token, chatId, `Код входа в Задачи Линки: ${code}\nКод действует 10 минут. Никому его не сообщайте.`)
}

export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  await telegramCall(token, 'sendMessage', { chat_id: chatId, text })
}
