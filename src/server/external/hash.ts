import crypto from 'crypto'

export function createContentHash(input: string) {
  return crypto
    .createHash('sha256')
    .update(input.trim().toLowerCase())
    .digest('hex')
}
