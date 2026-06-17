import type mongoose from 'mongoose'

declare global {
  var mongooseCache:
    | {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
      }
    | undefined
}

export {}
