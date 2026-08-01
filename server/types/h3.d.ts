import type { UserRecord } from '../domain/models'

declare module 'h3' {
  interface H3EventContext {
    auth?: UserRecord
  }
}

export {}
