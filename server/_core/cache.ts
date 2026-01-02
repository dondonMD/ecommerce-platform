let redisClient: any | null = null;

/**
 * Initialize Redis client
 */
export async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      // Dynamic import to avoid issues in test environments
      const { createClient } = await import('redis');
      redisClient = createClient({ url: redisUrl });
      redisClient.on('error', (err: any) => console.warn('[Redis] Client error:', err));
      redisClient.on('connect', () => console.log('[Redis] Connected'));
      await redisClient.connect();
    } catch (error) {
      console.warn('[Redis] Failed to connect:', error);
      redisClient = null;
    }
  }
  return redisClient;
}

/**
 * Cache wrapper with TTL
 */
export class Cache {
  private static instance: Cache;
  private client: any | null = null;

  private constructor() {}

  static async getInstance(): Promise<Cache> {
    if (!Cache.instance) {
      Cache.instance = new Cache();
      Cache.instance.client = await getRedisClient();
    }
    return Cache.instance;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      console.warn('[Cache] Get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.warn('[Cache] Set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.warn('[Cache] Del error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('[Cache] Exists error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.warn('[Cache] Invalidate pattern error:', error);
    }
  }
}

/**
 * Cache keys
 */
export const CACHE_KEYS = {
  PRODUCTS_LIST: (params: any) => `products:list:${JSON.stringify(params)}`,
  PRODUCT_DETAIL: (id: number) => `products:detail:${id}`,
  USER_CART: (userId: number) => `cart:user:${userId}`,
  PRODUCT_INVENTORY: (productId: number) => `inventory:product:${productId}`,
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  PRODUCTS_LIST: 300, // 5 minutes
  PRODUCT_DETAIL: 600, // 10 minutes
  USER_CART: 1800, // 30 minutes
  PRODUCT_INVENTORY: 60, // 1 minute
} as const;