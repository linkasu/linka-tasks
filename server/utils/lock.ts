let queue = Promise.resolve()

export async function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const previous = queue
  let release!: () => void
  queue = new Promise<void>(resolve => release = resolve)
  await previous
  try {
    return await operation()
  }
  finally {
    release()
  }
}
