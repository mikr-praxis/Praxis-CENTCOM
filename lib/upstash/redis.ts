import { Redis } from '@upstash/redis'
import { getConfig } from '@/lib/config'

let _redis: Redis | null = null
let _redisUrl: string | null = null

export async function getRedis(): Promise<Redis> {
  const url = await getConfig('UPSTASH_REDIS_REST_URL')
  const token = await getConfig('UPSTASH_REDIS_REST_TOKEN')

  if (!url || !token) {
    throw new Error('Upstash Redis is not configured. Set it up at /config.')
  }

  // Re-create client if credentials changed (hot-swap after config edit)
  if (!_redis || _redisUrl !== url) {
    _redis = new Redis({ url, token })
    _redisUrl = url
  }
  return _redis
}
