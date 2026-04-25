import crypto from 'crypto'

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}
