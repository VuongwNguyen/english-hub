import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI as string

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI')
}

type CachedMongoose = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: CachedMongoose
}

const cached: CachedMongoose = globalWithMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
}
globalWithMongoose.mongooseCache = cached

export async function connectMongo() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongooseInstance) => {
      return mongooseInstance
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
