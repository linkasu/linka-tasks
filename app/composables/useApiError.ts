export function useApiError() {
  const message = ref('')

  function capture(cause: unknown, fallback = 'Не удалось выполнить запрос') {
    const error = cause as { data?: { message?: string, statusMessage?: string }, message?: string }
    message.value = error.data?.message || error.data?.statusMessage || error.message || fallback
    return message.value
  }

  function clear() {
    message.value = ''
  }

  return { message, capture, clear }
}
